import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';
import { sendTaskAssignedEmail, sendTaskCancelledEmail, sendTaskAssignedExternalEmail, getAppUrl } from '../../../lib/resend';
import { createNotificationsForMany } from '../../../lib/notifications';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const formData = await request.formData();
  const id = formData.get('id')?.toString();
  if (!id) return redirect('/zadatci?error=ID+zadatka+nedostaje.');

  const adminSupabase = createSupabaseAdminClient();

  const { data: existingTask } = await adminSupabase
    .from('tasks')
    .select('apartment_id')
    .eq('id', id)
    .single();

  if (!existingTask) return redirect('/zadatci?error=' + encodeURIComponent('Zadatak nije pronađen.'));

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
  const external_assignee_ids_raw = formData.get('external_assignee_ids')?.toString();

  if (!title || !due_date || !apartment_id) {
    return redirect('/zadatci?error=Naziv,+apartman+i+datum+su+obavezni.');
  }

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
    .update({ title, due_date, due_time: due_time || null, apartment_id })
    .eq('id', id);

  if (error) {
    return redirect('/zadatci?error=' + encodeURIComponent('Greška pri ažuriranju zadatka.'));
  }

  // Dohvati stare assignee-je
  const { data: oldAssigneeRows } = await adminSupabase
    .from('task_assignees')
    .select('user_id, external_member_id')
    .eq('task_id', id);

  const oldUserIds = new Set((oldAssigneeRows ?? []).filter((r: any) => r.user_id).map((r: any) => r.user_id as string));
  const oldExtIds = new Set((oldAssigneeRows ?? []).filter((r: any) => r.external_member_id).map((r: any) => r.external_member_id as string));

  // Obrisi sve stare assignee-je
  await adminSupabase.from('task_assignees').delete().eq('task_id', id);

  let new_assignee_ids: string[] = [];
  try { new_assignee_ids = JSON.parse(assignee_ids_raw ?? '[]'); } catch { new_assignee_ids = []; }

  let new_external_ids: string[] = [];
  try { new_external_ids = JSON.parse(external_assignee_ids_raw ?? '[]'); } catch { new_external_ids = []; }

  if (new_assignee_ids.length > 0) {
    await adminSupabase.from('task_assignees').insert(
      new_assignee_ids.map((uid) => ({ task_id: id, user_id: uid }))
    );
  }

  if (new_external_ids.length > 0) {
    await adminSupabase.from('task_assignees').insert(
      new_external_ids.map((eid) => ({ task_id: id, external_member_id: eid }))
    );
  }

  // Diff za email notifikacije
  const newUserSet = new Set(new_assignee_ids);
  const newExtSet = new Set(new_external_ids);
  const addedUserIds = new_assignee_ids.filter((uid) => !oldUserIds.has(uid));
  const removedUserIds = [...oldUserIds].filter((uid) => !newUserSet.has(uid));
  const addedExtIds = new_external_ids.filter((eid) => !oldExtIds.has(eid));
  const removedExtIds = [...oldExtIds].filter((eid) => !newExtSet.has(eid));

  const hasChanges = addedUserIds.length > 0 || removedUserIds.length > 0 || addedExtIds.length > 0 || removedExtIds.length > 0;
  if (!hasChanges) return redirect('/zadatci?success=updated');

  const [{ data: apt }, { data: taskData }] = await Promise.all([
    adminSupabase.from('apartments').select('name').eq('id', apartment_id).single(),
    adminSupabase.from('tasks').select('title, due_date, due_time').eq('id', id).single(),
  ]);

  const dueDate = taskData?.due_date?.split('-').reverse().join('.') ?? '';
  const aptName = apt?.name ?? '';
  const appUrl = getAppUrl();

  const emailPromises: Promise<any>[] = [];

  // In-app notifikacije
  if (addedUserIds.length > 0) {
    await createNotificationsForMany(addedUserIds, {
      type: 'task_assigned',
      title: 'Novi zadatak',
      body: `Dodijeljen ti je zadatak "${taskData?.title}" u apartmanu ${aptName}.`,
      link: '/zadatci',
    });
  }
  if (removedUserIds.length > 0) {
    await createNotificationsForMany(removedUserIds, {
      type: 'task_cancelled',
      title: 'Zadatak otkazan',
      body: `Uklonjen/a si s zadatka "${taskData?.title}".`,
      link: '/zadatci',
    });
  }

  // Regular users
  if (addedUserIds.length > 0 || removedUserIds.length > 0) {
    const allUserIds = [...addedUserIds, ...removedUserIds];
    const { data: profiles } = await adminSupabase.from('profiles').select('id, full_name, email').in('id', allUserIds);
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    for (const uid of addedUserIds) {
      const p = profileMap.get(uid);
      if (p) emailPromises.push(sendTaskAssignedEmail({ to: p.email, assigneeName: p.full_name, apartmentName: aptName, taskTitle: taskData?.title ?? '', dueDate, dueTime: taskData?.due_time }).catch(() => {}));
    }
    for (const uid of removedUserIds) {
      const p = profileMap.get(uid);
      if (p) emailPromises.push(sendTaskCancelledEmail({ to: p.email, assigneeName: p.full_name, apartmentName: aptName, taskTitle: taskData?.title ?? '', dueDate, dueTime: taskData?.due_time }).catch(() => {}));
    }
  }

  // External members — added
  if (addedExtIds.length > 0) {
    const { data: extMembers } = await adminSupabase.from('external_members').select('id, name, email').in('id', addedExtIds);
    const { data: newExtRows } = await adminSupabase.from('task_assignees').select('external_member_id, completion_token').eq('task_id', id).not('external_member_id', 'is', null);
    const tokenMap = new Map((newExtRows ?? []).map((r: any) => [r.external_member_id, r.completion_token]));

    for (const em of extMembers ?? []) {
      const token = tokenMap.get((em as any).id);
      if (!token) continue;
      emailPromises.push(sendTaskAssignedExternalEmail({
        to: (em as any).email, name: (em as any).name,
        apartmentName: aptName, taskTitle: taskData?.title ?? '',
        dueDate, dueTime: taskData?.due_time,
        completionUrl: `${appUrl}/api/zadatci/complete-token?token=${token}`,
      }).catch(() => {}));
    }
  }

  // External members — removed (send cancellation using base email)
  if (removedExtIds.length > 0) {
    const { data: removedExtMembers } = await adminSupabase.from('external_members').select('id, name, email').in('id', removedExtIds);
    for (const em of removedExtMembers ?? []) {
      emailPromises.push(sendTaskCancelledEmail({
        to: (em as any).email, assigneeName: (em as any).name,
        apartmentName: aptName, taskTitle: taskData?.title ?? '',
        dueDate, dueTime: taskData?.due_time,
      }).catch(() => {}));
    }
  }

  await Promise.all(emailPromises);

  return redirect('/zadatci?success=updated');
};
