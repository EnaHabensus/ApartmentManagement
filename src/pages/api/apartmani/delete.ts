import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const formData = await request.formData();
  const id = formData.get('id')?.toString();
  if (!id) return redirect('/apartmani?error=ID+apartmana+nedostaje.');

  // Provjeri je li admin
  const { data: role } = await supabase
    .from('apartment_users')
    .select('role')
    .eq('apartment_id', id)
    .eq('user_id', user.id)
    .single();

  if (role?.role !== 'admin') {
    return redirect('/apartmani?error=Nemate+prava+za+brisanje.');
  }

  // Soft delete apartmana
  await supabase
    .from('apartments')
    .update({ is_deleted: true })
    .eq('id', id);

  // Otkaži sve rezervacije
  await supabase
    .from('reservations')
    .update({ status: 'cancelled' })
    .eq('apartment_id', id)
    .eq('status', 'active');

  return redirect('/apartmani?success=deleted');
};
