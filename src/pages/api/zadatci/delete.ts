import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const formData = await request.formData();
  const id = formData.get('id')?.toString();
  if (!id) return redirect('/zadatci?error=ID+zadatka+nedostaje.');

  // Dohvati zadatak da znamo apartment_id
  const { data: task } = await supabase
    .from('tasks')
    .select('apartment_id')
    .eq('id', id)
    .single();

  if (!task) return redirect('/zadatci?error=Zadatak+nije+pronađen.');

  // Provjeri admin ulogu
  const { data: roleRow } = await supabase
    .from('apartment_users')
    .select('role')
    .eq('apartment_id', task.apartment_id)
    .eq('user_id', user.id)
    .single();

  if (roleRow?.role !== 'admin') {
    return redirect('/zadatci?error=Nemate+prava+za+brisanje+zadatka.');
  }

  // Briši assignee-je pa zadatak
  await supabase.from('task_assignees').delete().eq('task_id', id);
  await supabase.from('tasks').delete().eq('id', id);

  return redirect('/zadatci?success=deleted');
};
