import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';
import { sendTaskAssignedEmail, sendTaskCancelledEmail } from '../../../lib/resend';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const formData = await request.formData();
  const id = formData.get('id')?.toString();
  if (!id) return redirect('/zadatci?error=ID+zadatka+nedostaje.');

  const adminSupabase = createSupabaseAdminClient();

  // Dohvati zadatak da znamo trenutni apartment_id
  const { data: existingTask } = await adminSupabase
    .from('tasks')
    .select('apartment_id')
    .eq('id', id)
    .single();

  if (!existingTask) return redirect('/zadatci?error=' + encodeURIComponent('Zadatak nije pronađen.'));

  // Provjeri admin ulogu na trenutnom apartmanu
  const { data: roleRow } = await adminSupabase
    .from('apartment_users')
    .select('role')
    .eq('apartment_id', existingTask.apartment_id)
    .eq('user_id', user.id)
    .single();

  if (roleRow?.role !== 'admin') {
    return redirect('/zadatci?error=' + encodeURIComponent('Nemate prava za uređivanje zadatka.'));
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
    const { data: newRoleRow } = await adminSupabase
      .from('apartment_users')
      .select('role')
      .eq('apartment_id', apartment_id)
      .eq('user_id', user.id)
      .single();

    if (newRoleRow?.role !== 'admin') {
      return redirect('/zadatci?error=Nemate+admin+prava+na+odabranom+apartmanu.');
    }
  }

  const { error } = await adminSupabase
    .from('tasks')
    .update({
      title,
      due_date,
      due_time: due_time || null,
      apartment_id,
    })
    .eq('id', id);

  if (error) {
    return redirect('/zadatci?error=' + encodeURIComponent('Greška pri ažuriranju zadatka.'));
  }

  // Dohvati stare assigneeje za diff
  const { data: oldAssigneeRows } = await adminSupabase
    .from('task_assignees').select('user_id').eq('task_id', id);
  const oldIds = new Set((oldAssigneeRows ?? []).map((r) => r.user_id));

  // Sync assignee-ji: brišemo stare, unosimo nove
  await adminSupabase.from('task_assignees').delete().eq('task_id', id);

  let new_assignee_ids: string[] = [];
  if (assignee_ids_raw) {
    try { new_assignee_ids = JSON.parse(assignee_ids_raw); } catch { new_assignee_ids = []; }
    if (new_assignee_ids.length > 0) {
      await adminSupabase.from('task_assignees').insert(
        new_assignee_ids.map((uid) => ({ task_id: id, user_id: uid }))
      );
    }
  }

  // Pošalji email notifikacije (fire-and-forget)
  const newIds = new Set(new_assignee_ids);
  const addedIds   = new_assignee_ids.filter((uid) => !oldIds.has(uid));
  const removedIds = [...oldIds].filter((uid) => !newIds.has(uid));

  if (addedIds.length > 0 || removedIds.length > 0) {
    const allAffectedIds = [...addedIds, ...removedIds];
    const [{ data: apt }, { data: taskData }, { data: profiles }] = await Promise.all([
      adminSupabase.from('apartments').select('name').eq('id', apartment_id).single(),
      adminSupabase.from('tasks').select('title, due_date, due_time').eq('id', id).single(),
      adminSupabase.from('profiles').select('id, full_name, email').in('id', allAffectedIds),
    ]);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const dueDate = taskData?.due_date?.split('-').reverse().join('.') ?? '';

    await Promise.all([
      ...addedIds.map((uid) => {
        const p = profileMap.get(uid);
        return p ? sendTaskAssignedEmail({ to: p.email, assigneeName: p.full_name, apartmentName: apt?.name ?? '', taskTitle: taskData?.title ?? '', dueDate, dueTime: taskData?.due_time }).catch(() => {}) : Promise.resolve();
      }),
      ...removedIds.map((uid) => {
        const p = profileMap.get(uid);
        return p ? sendTaskCancelledEmail({ to: p.email, assigneeName: p.full_name, apartmentName: apt?.name ?? '', taskTitle: taskData?.title ?? '', dueDate, dueTime: taskData?.due_time }).catch(() => {}) : Promise.resolve();
      }),
    ]);

  return redirect('/zadatci?success=updated');
};
