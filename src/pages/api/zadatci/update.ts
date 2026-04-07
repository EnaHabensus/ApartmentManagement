import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const formData = await request.formData();
  const id = formData.get('id')?.toString();
  if (!id) return redirect('/zadatci?error=ID+zadatka+nedostaje.');

  // Dohvati zadatak da znamo trenutni apartment_id
  const { data: existingTask } = await supabase
    .from('tasks')
    .select('apartment_id')
    .eq('id', id)
    .single();

  if (!existingTask) return redirect('/zadatci?error=Zadatak+nije+pronađen.');

  // Provjeri admin ulogu na trenutnom apartmanu
  const { data: roleRow } = await supabase
    .from('apartment_users')
    .select('role')
    .eq('apartment_id', existingTask.apartment_id)
    .eq('user_id', user.id)
    .single();

  if (roleRow?.role !== 'admin') {
    return redirect('/zadatci?error=Nemate+prava+za+uređivanje+zadatka.');
  }

  const title = formData.get('title')?.toString()?.trim();
  const due_date = formData.get('due_date')?.toString();
  const due_time = formData.get('due_time')?.toString() || null;
  const apartment_id = formData.get('apartment_id')?.toString();
  const assignee_ids_raw = formData.get('assignee_ids')?.toString();

  if (!title || !due_date || !apartment_id) {
    return redirect('/zadatci?error=Naziv,+apartman+i+datum+su+obavezni.');
  }

  // Ako je promijenjen apartman, provjeri da ima admin ulogu i na novom
  if (apartment_id !== existingTask.apartment_id) {
    const { data: newRoleRow } = await supabase
      .from('apartment_users')
      .select('role')
      .eq('apartment_id', apartment_id)
      .eq('user_id', user.id)
      .single();

    if (newRoleRow?.role !== 'admin') {
      return redirect('/zadatci?error=Nemate+admin+prava+na+odabranom+apartmanu.');
    }
  }

  const { error } = await supabase
    .from('tasks')
    .update({
      title,
      due_date,
      due_time: due_time || null,
      apartment_id,
    })
    .eq('id', id);

  if (error) {
    return redirect('/zadatci?error=Greška+pri+ažuriranju+zadatka.');
  }

  // Sync assignee-ji: brišemo stare, unosimo nove
  await supabase.from('task_assignees').delete().eq('task_id', id);

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
          task_id: id,
          user_id: uid,
        }))
      );
    }
  }

  return redirect('/zadatci?success=updated');
};
