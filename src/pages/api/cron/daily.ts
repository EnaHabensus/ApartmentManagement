import { createSupabaseAdminClient } from '../../../lib/supabase';
import { sendCleaningReminderEmail } from '../../../lib/resend';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
  // Opcionalna provjera secret headera za zaštitu endpointa
  const secret = request.headers.get('x-cron-secret');
  if (import.meta.env.CRON_SECRET && secret !== import.meta.env.CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const results: Record<string, unknown> = {};

  // ─── Job 1: Podsjetnik čišćenje ──────────────────────────────────────────────
  try {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10); // YYYY-MM-DD

    // Dohvati reservation_cleaning zapise gdje checkout = sutra i notified_reminder_at IS NULL
    const { data: cleaningRows, error: cleaningError } = await supabase
      .from('reservation_cleaning')
      .select(`
        id,
        user_id,
        reservation_id,
        reservations!inner (
          check_out,
          status,
          apartments!inner (
            name,
            check_out_time
          )
        )
      `)
      .is('notified_reminder_at', null)
      .eq('reservations.status', 'active')
      .eq('reservations.check_out', tomorrowStr);

    if (cleaningError) throw cleaningError;

    let remindersSent = 0;
    for (const row of cleaningRows ?? []) {
      const reservation = row.reservations as unknown as {
        check_out: string;
        status: string;
        apartments: { name: string; check_out_time: string };
      };

      // Dohvati profil korisnika (email i ime)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', row.user_id)
        .single();

      if (profileError || !profile) continue;

      // Formatiraj datum: DD.MM.YYYY
      const checkOutDate = reservation.check_out
        .split('-')
        .reverse()
        .join('.');

      // Pošalji podsjetnik email
      await sendCleaningReminderEmail({
        to: profile.email,
        assigneeName: profile.full_name,
        apartmentName: reservation.apartments.name,
        checkOutDate,
        checkOutTime: reservation.apartments.check_out_time,
      });

      // Ažuriraj notified_reminder_at
      await supabase
        .from('reservation_cleaning')
        .update({ notified_reminder_at: new Date().toISOString() })
        .eq('id', row.id);

      remindersSent++;
    }

    results.job1_cleaning_reminders = { sent: remindersSent };
  } catch (err) {
    results.job1_cleaning_reminders = { error: String(err) };
  }

  // ─── Job 2: Auto generiranje računa ──────────────────────────────────────────
  try {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10); // YYYY-MM-DD

    // Dohvati sve postavke apartmana s auto_generate = true
    const { data: settingsRows, error: settingsError } = await supabase
      .from('apartment_invoice_settings')
      .select('*')
      .eq('auto_generate', true);

    if (settingsError) throw settingsError;

    let invoicesGenerated = 0;

    for (const settings of settingsRows ?? []) {
      // Ovisno o generate_on, filtriramo po check_in ili check_out
      const dateField = settings.generate_on === 'check_in' ? 'check_in' : 'check_out';

      // Pronađi rezervacije koje danas imaju check_in/check_out i nemaju račun
      const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select('id, guest_name, check_in, check_out, amount_gross, payment_type')
        .eq('apartment_id', settings.apartment_id)
        .eq('status', 'active')
        .eq(dateField, todayStr);

      if (resError || !reservations) continue;

      for (const reservation of reservations) {
        // Provjeri postoji li već račun za ovu rezervaciju
        const { data: existingInvoice } = await supabase
          .from('invoices')
          .select('id')
          .eq('reservation_id', reservation.id)
          .maybeSingle();

        if (existingInvoice) continue;

        // Izračunaj sljedeći broj računa
        const nextNumber = (settings.last_invoice_number ?? 0) + 1;
        const invoiceNumberDisplay = String(nextNumber).padStart(4, '0');

        // Insertiraj račun (generated_by = NULL jer je automatski)
        const { error: insertError } = await supabase
          .from('invoices')
          .insert({
            reservation_id: reservation.id,
            apartment_id: settings.apartment_id,
            invoice_number: nextNumber,
            invoice_number_display: invoiceNumberDisplay,
            generated_at: new Date().toISOString(),
            generated_by: null,
          });

        if (insertError) continue;

        // Ažuriraj last_invoice_number
        await supabase
          .from('apartment_invoice_settings')
          .update({
            last_invoice_number: nextNumber,
            updated_at: new Date().toISOString(),
          })
          .eq('id', settings.id);

        // Ažuriraj lokalni settings objekt za sljedeću iteraciju
        settings.last_invoice_number = nextNumber;

        invoicesGenerated++;
      }
    }

    results.job2_auto_invoices = { generated: invoicesGenerated };
  } catch (err) {
    results.job2_auto_invoices = { error: String(err) };
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
