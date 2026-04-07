import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const formData = await request.formData();
  const id = formData.get('id')?.toString();
  if (!id) return redirect('/rezervacije?error=ID+rezervacije+nedostaje.');

  const adminSupabase = createSupabaseAdminClient();

  const { data: existing } = await adminSupabase
    .from('reservations')
    .select('apartment_id')
    .eq('id', id)
    .single();

  if (!existing) return redirect('/rezervacije?error=' + encodeURIComponent('Rezervacija nije pronađena.'));

  const { data: roleRow } = await adminSupabase
    .from('apartment_users')
    .select('role')
    .eq('apartment_id', existing.apartment_id)
    .eq('user_id', user.id)
    .single();

  if (roleRow?.role !== 'admin') {
    return redirect('/rezervacije?error=' + encodeURIComponent('Nemate prava za otkazivanje rezervacije.'));
  }

  const { error } = await adminSupabase
    .from('reservations')
    .update({ status: 'cancelled' })
    .eq('id', id);

  if (error) {
    return redirect('/rezervacije?error=' + encodeURIComponent('Greška pri otkazivanju: ' + error.message));
  }

  return redirect('/rezervacije?tab=otkazane&success=cancelled');
};
