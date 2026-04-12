import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../../lib/supabase';
import { sendTaskCompletedEmail } from '../../../lib/resend';

export const GET: APIRoute = async ({ url, redirect }) => {
  const token = url.searchParams.get('token');
  if (!token) return redirect('/task-complete?status=invalid');

  const adminSupabase = createSupabaseAdminClient();

  // Pronađi assignee red po completion_token
  const { data: assigneeRow } = await adminSupabase
    .from('task_assignees')
    .select('id, task_id, external_member_id, completed_at')
    .eq('completion_token', token)
    .maybeSingle();

  if (!assigneeRow) return redirect('/task-complete?status=invalid');

  // Dohvati zadatak
  const { data: task } = await adminSupabase
    .from('tasks')
    .select('id, title, apartment_id, due_date, due_time, is_completed')
    .eq('id', assigneeRow.task_id)
    .single();

  if (!task) return redirect('/task-complete?status=invalid');

  if (assigneeRow.completed_at) {
    return redirect('/task-complete?status=already_done&task=' + encodeURIComponent(task.title));
  }

  // Dohvati external member za ime
  const { data: extMember } = assigneeRow.external_member_id
    ? await adminSupabase
        .from('external_members')
        .select('name')
        .eq('id', assigneeRow.external_member_id)
        .single()
    : { data: null };

  const completedByName = extMember?.name ?? 'Pomoćno osoblje';

  // Označi assignee row kao završen
  await adminSupabase
    .from('task_assignees')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', assigneeRow.id);

  // Označi cijeli zadatak kao završen
  await adminSupabase
    .from('tasks')
    .update({ is_completed: true, completed_at: new Date().toISOString() })
    .eq('id', task.id);

  // Obavijesti admine
  const { data: adminRows } = await adminSupabase
    .from('apartment_users')
    .select('user_id')
    .eq('apartment_id', task.apartment_id)
    .eq('role', 'admin');

  const adminIds = (adminRows ?? []).map((r) => r.user_id);
  if (adminIds.length > 0) {
    const [{ data: adminProfiles }, { data: apt }] = await Promise.all([
      adminSupabase.from('profiles').select('id, full_name, email').in('id', adminIds),
      adminSupabase.from('apartments').select('name').eq('id', task.apartment_id).single(),
    ]);

    await Promise.all(
      (adminProfiles ?? []).map((p) =>
        sendTaskCompletedEmail({
          to: p.email,
          adminName: p.full_name,
          completedByName,
          taskTitle: task.title,
          apartmentName: apt?.name ?? '',
        }).catch(() => {})
      )
    );
  }

  return redirect('/task-complete?status=success&task=' + encodeURIComponent(task.title));
};
