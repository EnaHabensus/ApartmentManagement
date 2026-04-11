import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';
import { sendTaskCancelledEmail } from '../../../lib/resend';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const formData = await request.formData();
  const id = formData.get('id')?.toString();
  if (!id) return redirect('/zadatci?error=ID+zadatka+nedostaje.');

  const adminSupabase = createSupabaseAdminClient();

  // Dohvati zadatak (title, due_date, due_time, apartment_id)
  const { data: task } = await adminSupabase
    .from('tasks')
    .select('apartment_id, title, due_date, due_time')
    .eq('id', id)
    .single();

  if (!task) return redirect('/zadatci?error=' + encodeURIComponent('Zadatak nije pronađen.'));

  // Provjeri admin ulogu
  const { data: roleRow } = await adminSupabase
    .from('apartment_users')
    .select('role')
    .eq('apartment_id', task.apartment_id)
    .eq('user_id', user.id)
    .single();

  if (roleRow?.role !== 'admin') {
    return redirect('/zadatci?error=Nemate+prava+za+brisanje+zadatka.');
  }

  // Dohvati assigneeje i podatke potrebne za email PRIJE brisanja
  const [{ data: assigneeRows }, { data: apt }] = await Promise.all([
    adminSupabase.from('task_assignees').select('user_id').eq('task_id', id),
    adminSupabase.from('apartments').select('name').eq('id', task.apartment_id).single(),
  ]);

  const assigneeIds = (assigneeRows ?? []).map((r) => r.user_id);
  const { data: assigneeProfiles } = assigneeIds.length > 0
    ? await adminSupabase.from('profiles').select('id, full_name, email').in('id', assigneeIds)
    : { data: [] };

  // Briši assignee-je pa zadatak
  await adminSupabase.from('task_assignees').delete().eq('task_id', id);
  await adminSupabase.from('tasks').delete().eq('id', id);

  // Pošalji email assigneejima da je zadatak otkazan (fire-and-forget)
  if (apt && assigneeProfiles && assigneeProfiles.length > 0) {
    const dueDate = task.due_date.split('-').reverse().join('.');
    for (const profile of assigneeProfiles) {
      sendTaskCancelledEmail({
        to: profile.email,
        assigneeName: profile.full_name,
        apartmentName: apt.name,
        taskTitle: task.title,
        dueDate,
        dueTime: task.due_time,
      }).catch(() => {});
    }
  }

  return redirect('/zadatci?success=deleted');
};
