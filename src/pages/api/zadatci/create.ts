import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const formData = await request.formData();
  const apartment_id = formData.get('apartment_id')?.toString();
  if (!apartment_id) return redirect('/zadatci?error=Apartman+je+obavezan.');

  // Provjeri admin ulogu na odabranom apartmanu
  const { data: roleRow } = await supabase
    .from('apartment_users')
    .select('role')
    .eq('apartment_id', apartment_id)
    .eq('user_id', user.id)
    .single();

  if (roleRow?.role !== 'admin') {
    return redirect('/zadatci?error=Nemate+prava+za+kreiranje+zadatka.');
  }

  const title = formData.get('title')?.toString()?.trim();
  const due_date = formData.get('due_date')?.toString();
  const due_time = formData.get('due_time')?.toString() || null;
  const assignee_ids_raw = formData.get('assignee_ids')?.toString();

  if (!title || !due_date) {
    return redirect('/zadatci?error=Naziv+i+datum+su+obavezni.');
  }

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      apartment_id,
      title,
      due_date,
      due_time: due_time || null,
      is_completed: false,
      source: 'manual',
      created_by: user.id,
    })
    .select()
    .single();

  if (error || !task) {
    return redirect('/zadatci?error=Greška+pri+kreiranju+zadatka.');
  }

  // Dodaj assignee-je
  if (assignee_ids_raw) {
    let assignee_ids: string[] = [];
    try {
      assignee_ids = JSON.parse(assignee_ids_raw);
    } catch {
      assignee_ids = [];
    }
    if (assignee_ids.length > 0) {
      await supabase.from('task_assignees').insert(
        assignee_ids.map((uid) => ({
          task_id: task.id,
          user_id: uid,
        }))
      );
    }
  }

  return redirect('/zadatci?success=created');
};
