import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const formData = await request.formData();
  const external_member_id = formData.get('external_member_id')?.toString();
  const apartment_id = formData.get('apartment_id')?.toString();

  if (!external_member_id || !apartment_id) {
    return redirect('/korisnici?error=' + encodeURIComponent('Nedostaju podaci.'));
  }

  const adminSupabase = createSupabaseAdminClient();

  // Provjeri admin ulogu
  const { data: roleRow } = await adminSupabase
    .from('apartment_users')
    .select('role')
    .eq('apartment_id', apartment_id)
    .eq('user_id', user.id)
    .single();

  if (roleRow?.role !== 'admin') {
    return redirect('/korisnici?error=' + encodeURIComponent('Nemate prava za ovu akciju.'));
  }

  // Ukloni s apartmana
  await adminSupabase
    .from('apartment_external_members')
    .delete()
    .eq('external_member_id', external_member_id)
    .eq('apartment_id', apartment_id);

  // Ako nema više apartmana, obriši i sam zapis
  const { data: remaining } = await adminSupabase
    .from('apartment_external_members')
    .select('id')
    .eq('external_member_id', external_member_id);

  if (!remaining || remaining.length === 0) {
    await adminSupabase.from('external_members').delete().eq('id', external_member_id);
  }

  return redirect('/korisnici?success=external_deleted');
};
