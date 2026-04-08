import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const adminSupabase = createSupabaseAdminClient();
  const { data: au } = await adminSupabase.from('apartment_users').select('role').eq('user_id', user.id).eq('role', 'admin').limit(1);
  if (!au?.length) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

  const { reservation_id, invoice_number_display } = await request.json();
  if (!reservation_id || !invoice_number_display?.trim()) {
    return new Response(JSON.stringify({ error: 'Rezervacija i broj računa su obavezni.' }), { status: 400 });
  }

  // Dohvati rezervaciju
  const { data: rez } = await adminSupabase.from('reservations').select('id, apartment_id').eq('id', reservation_id).single();
  if (!rez) return new Response(JSON.stringify({ error: 'Rezervacija nije pronađena.' }), { status: 404 });

  // Provjeri da već ne postoji račun za tu rezervaciju
  const { data: existing } = await adminSupabase.from('invoices').select('id').eq('reservation_id', reservation_id).maybeSingle();
  if (existing) return new Response(JSON.stringify({ error: 'Račun za ovu rezervaciju već postoji.' }), { status: 400 });

  // Broj računa (integer) = count postojećih + 1
  const { count } = await adminSupabase.from('invoices').select('id', { count: 'exact', head: true }).eq('apartment_id', rez.apartment_id);
  const invoice_number = (count ?? 0) + 1;

  const { error } = await adminSupabase.from('invoices').insert({
    reservation_id,
    apartment_id: rez.apartment_id,
    invoice_number,
    invoice_number_display: invoice_number_display.trim(),
    generated_at: new Date().toISOString(),
    generated_by: user.id,
    pdf_url: null,
  });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
