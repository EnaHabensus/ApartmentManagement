import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const adminSupabase = createSupabaseAdminClient();
  const { data: au } = await adminSupabase.from('apartment_users').select('role').eq('user_id', user.id).eq('role', 'admin').limit(1);
  if (!au?.length) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const invoice_id = formData.get('invoice_id')?.toString();
  const reservation_id = formData.get('reservation_id')?.toString();
  const invoice_number_display = formData.get('invoice_number_display')?.toString()?.trim();

  if (!file || !reservation_id) {
    return new Response(JSON.stringify({ error: 'Datoteka i ID rezervacije su obavezni.' }), { status: 400 });
  }

  if (file.type !== 'application/pdf') {
    return new Response(JSON.stringify({ error: 'Dopušteni su samo PDF dokumenti.' }), { status: 400 });
  }

  // Ako nema invoice_id ili je '__new__', kreiraj novi zapis u bazi
  let resolvedInvoiceId = invoice_id && invoice_id !== '__new__' ? invoice_id : null;

  if (!resolvedInvoiceId) {
    if (!invoice_number_display) {
      return new Response(JSON.stringify({ error: 'Broj računa je obavezan.' }), { status: 400 });
    }

    // Provjeri da već ne postoji račun za tu rezervaciju
    const { data: existing } = await adminSupabase
      .from('invoices')
      .select('id')
      .eq('reservation_id', reservation_id)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ error: 'Račun za ovu rezervaciju već postoji.' }), { status: 400 });
    }

    // Dohvati apartment_id iz rezervacije
    const { data: rez } = await adminSupabase
      .from('reservations')
      .select('apartment_id')
      .eq('id', reservation_id)
      .single();
    if (!rez) return new Response(JSON.stringify({ error: 'Rezervacija nije pronađena.' }), { status: 404 });

    const { count } = await adminSupabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('apartment_id', rez.apartment_id);
    const invoice_number = (count ?? 0) + 1;

    const { data: newInvoice, error: createError } = await adminSupabase
      .from('invoices')
      .insert({
        reservation_id,
        apartment_id: rez.apartment_id,
        invoice_number,
        invoice_number_display,
        generated_at: new Date().toISOString(),
        generated_by: user.id,
        pdf_url: null,
      })
      .select('id')
      .single();

    if (createError) return new Response(JSON.stringify({ error: createError.message }), { status: 500 });
    resolvedInvoiceId = newInvoice.id;
  }

  // Upload PDF u Storage
  const arrayBuffer = await file.arrayBuffer();
  const path = `${reservation_id}/${Date.now()}.pdf`;

  const { error: uploadError } = await adminSupabase.storage
    .from('invoices')
    .upload(path, arrayBuffer, { contentType: 'application/pdf', upsert: true });

  if (uploadError) {
    return new Response(JSON.stringify({ error: `Greška pri uploadu: ${uploadError.message}` }), { status: 500 });
  }

  const { data: { publicUrl } } = adminSupabase.storage.from('invoices').getPublicUrl(path);

  const { error: updateError } = await adminSupabase
    .from('invoices')
    .update({ pdf_url: publicUrl })
    .eq('id', resolvedInvoiceId);

  if (updateError) return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });

  return new Response(JSON.stringify({ success: true, pdf_url: publicUrl }), { status: 200 });
};
