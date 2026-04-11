import { createSupabaseAdminClient } from '../../../lib/supabase';
import {
  sendCleaningReminderEmail,
  sendDailyAdminDigestEmail,
  sendDailyStaffDigestEmail,
} from '../../../lib/resend';
import type { APIRoute } from 'astro';
import { CRON_SECRET } from 'astro:env/server';

export const GET: APIRoute = async ({ request }) => {
  // Opcionalna provjera secret headera za zaštitu endpointa
  const secret = request.headers.get('x-cron-secret');
  if (CRON_SECRET && secret !== CRON_SECRET) {
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

  // ─── Zajednički podaci za Job 3 i Job 4 ──────────────────────────────────────
  const TZ = 'Europe/Zagreb';
  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: TZ });

  // ─── Job 3: Dnevni digest za admine ──────────────────────────────────────────
  try {
    // Dohvati sve apartmane i njihove admineee
    const { data: allAdminRows } = await supabase
      .from('apartment_users')
      .select('apartment_id, user_id')
      .eq('role', 'admin');

    const adminIds = [...new Set((allAdminRows ?? []).map((r) => r.user_id))];
    const apartmentIds = [...new Set((allAdminRows ?? []).map((r) => r.apartment_id))];

    // Dohvati podatke u paraleli
    const [{ data: aptData }, { data: adminProfiles }, { data: checkoutRez }, { data: checkinRez }, { data: todayTasks }] =
      await Promise.all([
        supabase.from('apartments').select('id, name').in('id', apartmentIds),
        supabase.from('profiles').select('id, full_name, email').in('id', adminIds),
        supabase.from('reservations').select('guest_name, apartment_id').in('apartment_id', apartmentIds).eq('check_out', todayStr).eq('status', 'active'),
        supabase.from('reservations').select('guest_name, apartment_id').in('apartment_id', apartmentIds).eq('check_in', todayStr).eq('status', 'active'),
        supabase.from('tasks').select('id, title, due_date, due_time, apartment_id').in('apartment_id', apartmentIds).eq('due_date', todayStr).eq('is_completed', false),
      ]);

    const aptNameMap = new Map((aptData ?? []).map((a) => [a.id, a.name]));

    // Dohvati assigneeje za zadatke
    const taskIds = (todayTasks ?? []).map((t) => t.id);
    const { data: taskAssigneeRows } = taskIds.length > 0
      ? await supabase.from('task_assignees').select('task_id, user_id').in('task_id', taskIds)
      : { data: [] };
    const allAssigneeIds = [...new Set((taskAssigneeRows ?? []).map((r) => r.user_id))];
    const { data: assigneeProfiles } = allAssigneeIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', allAssigneeIds)
      : { data: [] };
    const assigneeNameMap = new Map((assigneeProfiles ?? []).map((p) => [p.id, p.full_name]));
    const taskAssigneeMap = new Map<string, string | null>();
    for (const row of taskAssigneeRows ?? []) {
      if (!taskAssigneeMap.has(row.task_id)) {
        taskAssigneeMap.set(row.task_id, assigneeNameMap.get(row.user_id) ?? null);
      }
    }

    // Pošalji jedan email po adminu s podacima za NJEGOVE apartmane
    let digestsSent = 0;
    for (const adminRow of (allAdminRows ?? [])) {
      // Grupiraj po adminu — dohvati sve apartmane za ovog admina
      const adminAptIds = (allAdminRows ?? [])
        .filter((r) => r.user_id === adminRow.user_id)
        .map((r) => r.apartment_id);

      // Izbjegni duplikate ako smo već poslali ovom adminu
      if (digestsSent > 0 && adminRow.user_id === (allAdminRows ?? [])[digestsSent - 1]?.user_id) continue;

      const profile = (adminProfiles ?? []).find((p) => p.id === adminRow.user_id);
      if (!profile) continue;

      const checkouts = (checkoutRez ?? [])
        .filter((r) => adminAptIds.includes(r.apartment_id))
        .map((r) => ({ guestName: r.guest_name, apartmentName: aptNameMap.get(r.apartment_id) ?? '' }));
      const checkins = (checkinRez ?? [])
        .filter((r) => adminAptIds.includes(r.apartment_id))
        .map((r) => ({ guestName: r.guest_name, apartmentName: aptNameMap.get(r.apartment_id) ?? '' }));
      const tasks = (todayTasks ?? [])
        .filter((t) => adminAptIds.includes(t.apartment_id))
        .map((t) => ({
          title: t.title,
          apartmentName: aptNameMap.get(t.apartment_id) ?? '',
          dueTime: t.due_time,
          assigneeName: taskAssigneeMap.get(t.id) ?? null,
        }));

      await sendDailyAdminDigestEmail({
        to: profile.email,
        adminName: profile.full_name,
        todayStr,
        checkouts,
        checkins,
        tasks,
      });
      digestsSent++;
    }

    results.job3_admin_digest = { sent: digestsSent };
  } catch (err) {
    results.job3_admin_digest = { error: String(err) };
  }

  // ─── Job 4: Dnevni digest zadataka za staff ───────────────────────────────────
  try {
    // Dohvati sve apartmane
    const { data: allAptRows } = await supabase.from('apartments').select('id, name');
    const allAptNameMap = new Map((allAptRows ?? []).map((a) => [a.id, a.name]));

    // Dohvati zadatke za danas koji su assignani
    const { data: staffTasks } = await supabase
      .from('tasks')
      .select('id, title, due_date, due_time, apartment_id')
      .eq('due_date', todayStr)
      .eq('is_completed', false);

    const staffTaskIds = (staffTasks ?? []).map((t) => t.id);
    const { data: staffAssigneeRows } = staffTaskIds.length > 0
      ? await supabase.from('task_assignees').select('task_id, user_id').in('task_id', staffTaskIds)
      : { data: [] };

    // Grupiraj po user_id
    const tasksByUser = new Map<string, string[]>();
    for (const row of staffAssigneeRows ?? []) {
      if (!tasksByUser.has(row.user_id)) tasksByUser.set(row.user_id, []);
      tasksByUser.get(row.user_id)!.push(row.task_id);
    }

    const staffUserIds = [...tasksByUser.keys()];
    const { data: staffProfiles } = staffUserIds.length > 0
      ? await supabase.from('profiles').select('id, full_name, email').in('id', staffUserIds)
      : { data: [] };

    const taskMap = new Map((staffTasks ?? []).map((t) => [t.id, t]));

    let staffDigestsSent = 0;
    for (const profile of staffProfiles ?? []) {
      const myTaskIds = tasksByUser.get(profile.id) ?? [];
      const myTasks = myTaskIds
        .map((tid) => taskMap.get(tid))
        .filter(Boolean)
        .map((t) => ({
          title: t!.title,
          apartmentName: allAptNameMap.get(t!.apartment_id) ?? '',
          dueTime: t!.due_time,
        }));

      if (myTasks.length === 0) continue;

      await sendDailyStaffDigestEmail({
        to: profile.email,
        staffName: profile.full_name,
        todayStr,
        tasks: myTasks,
      });
      staffDigestsSent++;
    }

    results.job4_staff_digest = { sent: staffDigestsSent };
  } catch (err) {
    results.job4_staff_digest = { error: String(err) };
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
