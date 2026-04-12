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

  const { data: task } = await adminSupabase
    .from('tasks')
    .select('apartment_id, title, due_date, due_time')
    .eq('id', id)
    .single();

  if (!task) return redirect('/zadatci?error=' + encodeURIComponent('Zadatak nije pronađen.'));

  const { data: roleRow } = await adminSupabase
    .from('apartment_users')
    .select('role')
    .eq('apartment_id', task.apartment_id)
    .eq('user_id', user.id)
    .single();

  if (roleRow?.role !== 'admin') {
    return redirect('/zadatci?error=Nemate+prava+za+brisanje+zadatka.');
  }

  // Dohvati assignee-je (i regularne i vanjske) PRIJE brisanja
  const [{ data: assigneeRows }, { data: apt }] = await Promise.all([
    adminSupabase.from('task_assignees').select('user_id, external_member_id').eq('task_id', id),
    adminSupabase.from('apartments').select('name').eq('id', task.apartment_id).single(),
  ]);

  const userIds = (assigneeRows ?? []).filter((r: any) => r.user_id).map((r: any) => r.user_id as string);
  const extIds = (assigneeRows ?? []).filter((r: any) => r.external_member_id).map((r: any) => r.external_member_id as string);

  const [{ data: userProfiles }, { data: extMembers }] = await Promise.all([
    userIds.length > 0
      ? adminSupabase.from('profiles').select('id, full_name, email').in('id', userIds)
      : Promise.resolve({ data: [] }),
    extIds.length > 0
      ? adminSupabase.from('external_members').select('id, name, email').in('id', extIds)
      : Promise.resolve({ data: [] }),
  ]);

  // Briši
  await adminSupabase.from('task_assignees').delete().eq('task_id', id);
  await adminSupabase.from('tasks').delete().eq('id', id);

  // Pošalji email notifikacije
  if (apt) {
    const dueDate = task.due_date.split('-').reverse().join('.');
    const emailPromises: Promise<any>[] = [];

    for (const p of userProfiles ?? []) {
      emailPromises.push(sendTaskCancelledEmail({
        to: p.email, assigneeName: p.full_name,
        apartmentName: apt.name, taskTitle: task.title,
        dueDate, dueTime: task.due_time,
      }).catch(() => {}));
    }
    for (const em of extMembers ?? []) {
      emailPromises.push(sendTaskCancelledEmail({
        to: (em as any).email, assigneeName: (em as any).name,
        apartmentName: apt.name, taskTitle: task.title,
        dueDate, dueTime: task.due_time,
      }).catch(() => {}));
    }

    await Promise.all(emailPromises);
  }

  return redirect('/zadatci?success=deleted');
};
