import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const formData = await request.formData();
  const id = formData.get('id')?.toString();
  if (!id) return redirect('/apartmani?error=' + encodeURIComponent('ID apartmana nedostaje.'));

  // Provjeri admin ulogu
  const { data: role } = await supabase
    .from('apartment_users')
    .select('role')
    .eq('apartment_id', id)
    .eq('user_id', user.id)
    .single();

  if (role?.role !== 'admin') {
    return redirect('/apartmani?error=' + encodeURIComponent('Nemate prava za brisanje.'));
  }

  const adminSupabase = createSupabaseAdminClient();

  // Soft delete apartmana
  await adminSupabase.from('apartments').update({ is_deleted: true }).eq('id', id);

  // Otkaži sve aktivne rezervacije
  await adminSupabase
    .from('reservations')
    .update({ status: 'cancelled' })
    .eq('apartment_id', id)
    .eq('status', 'active');

  // Ukloni sve korisnike i pomoćno osoblje s apartmana
  await adminSupabase.from('apartment_users').delete().eq('apartment_id', id);
  await adminSupabase.from('apartment_external_members').delete().eq('apartment_id', id);

  // Ukloni zadatke i troškove apartmana
  await adminSupabase.from('tasks').delete().eq('apartment_id', id);
  await adminSupabase.from('expenses').delete().eq('apartment_id', id);

  return redirect('/apartmani?success=deleted');
};
