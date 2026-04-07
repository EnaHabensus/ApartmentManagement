import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';

const ALLOWED_FIELDS = ['documents_received', 'guests_registered', 'is_paid'];

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: { id?: string; field?: string; value?: boolean };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { id, field, value } = body;

  if (!id || !field || !ALLOWED_FIELDS.includes(field) || typeof value !== 'boolean') {
    return new Response(JSON.stringify({ error: 'Nevažeći parametri.' }), { status: 400 });
  }

  const adminSupabase = createSupabaseAdminClient();

  // Provjeri da korisnik ima pristup ovoj rezervaciji (admin apartmana)
  const { data: reservation } = await adminSupabase
    .from('reservations')
    .select('apartment_id')
    .eq('id', id)
    .single();

  if (!reservation) {
    return new Response(JSON.stringify({ error: 'Rezervacija nije pronađena.' }), { status: 404 });
  }

  const { data: roleRow } = await adminSupabase
    .from('apartment_users')
    .select('role')
    .eq('apartment_id', reservation.apartment_id)
    .eq('user_id', user.id)
    .single();

  if (!roleRow) {
    return new Response(JSON.stringify({ error: 'Nemate pristup ovoj rezervaciji.' }), { status: 403 });
  }

  const { error } = await adminSupabase
    .from('reservations')
    .update({ [field]: value })
    .eq('id', id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
