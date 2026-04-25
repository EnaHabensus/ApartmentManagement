import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';
import { sendTaskAssignedEmail, sendTaskCancelledEmail, sendTaskAssignedExternalEmail, getAppUrl } from '../../../lib/resend';
import { createNotificationsForMany } from '../../../lib/notifications';

export const POST: APIRoute = async ({ request, cookies }) => {
  const json = (data: object, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Niste prijavljeni.' }, 401);

  let body: { reservation_id?: string; user_ids?: string[]; external_ids?: string[] };
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON.' }, 400); }

  const { reservation_id, user_ids = [], external_ids = [] } = body;
  if (!reservation_id) return json({ error: 'reservation_id nedostaje.' }, 400);

  const adminSupabase = createSupabaseAdminClient();

  const { data: reservation } = await adminSupabase
    .from('reservations')
    .select('apartment_id, check_out')
    .eq('id', reservation_id)
    .single();

  if (!reservation) return json({ error: 'Rezervacija nije pronađena.' }, 404);

  const { data: roleRow } = await adminSupabase
    .from('apartment_users')
    .select('role')
    .eq('apartment_id', reservation.apartment_id)
    .eq('user_id', user.id)
    .single();

  if (!roleRow) return json({ error: 'Nemate pristup ovoj rezervaciji.' }, 403);

  const { data: apt } = await adminSupabase
    .from('apartments')
    .select('name, check_out_time')
    .eq('id', reservation.apartment_id)
    .single();

  const checkOutTime = (apt as any)?.check_out_time ?? null;
  const apartmentName = (apt as any)?.name ?? '';

  // Zapamti stare čistače za email diff
  const { data: oldCleaningRows } = await adminSupabase
    .from('reservation_cleaning')
    .select('user_id, external_member_id')
    .eq('reservation_id', reservation_id);

  const oldUserIds = new Set((oldCleaningRows ?? []).filter((r: any) => r.user_id).map((r: any) => r.user_id as string));
  const oldExtIds = new Set((oldCleaningRows ?? []).filter((r: any) => r.external_member_id).map((r: any) => r.external_member_id as string));

  // Obriši sve postojeće dodjele i auto-zadatak
  const { data: existingTasks } = await adminSupabase
    .from('tasks')
    .select('id')
    .eq('reservation_id', reservation_id)
    .eq('source', 'cleaning_auto');

  if (existingTasks && existingTasks.length > 0) {
    const taskIds = existingTasks.map((t: any) => t.id);
    await adminSupabase.from('task_assignees').delete().in('task_id', taskIds);
    await adminSupabase.from('tasks').delete().in('id', taskIds);
  }

  await adminSupabase.from('reservation_cleaning').delete().eq('reservation_id', reservation_id);

  if (user_ids.length === 0 && external_ids.length === 0) return json({ success: true });

  // Kreiraj nove dodjele čišćenja
  const cleaningInserts: any[] = [
    ...user_ids.map((uid) => ({ reservation_id, user_id: uid })),
    ...external_ids.map((eid) => ({ reservation_id, external_member_id: eid })),
  ];
  await adminSupabase.from('reservation_cleaning').insert(cleaningInserts);

  // Kreiraj jedan zadatak čišćenja
  const { data: task } = await adminSupabase
    .from('tasks')
    .insert({
      apartment_id: reservation.apartment_id,
      title: 'Čišćenje',
      due_date: reservation.check_out,
      due_time: checkOutTime,
      is_completed: false,
      source: 'cleaning_auto',
      reservation_id,
      created_by: user.id,
    })
    .select()
    .single();

  if (task) {
    const assigneeInserts: any[] = [
      ...user_ids.map((uid) => ({ task_id: task.id, user_id: uid })),
      ...external_ids.map((eid) => ({ task_id: task.id, external_member_id: eid })),
    ];
    await adminSupabase.from('task_assignees').insert(assigneeInserts);
  }

  // Email diff
  const newUserSet = new Set(user_ids);
  const newExtSet = new Set(external_ids);
  const addedUserIds = user_ids.filter((uid) => !oldUserIds.has(uid));
  const removedUserIds = [...oldUserIds].filter((uid) => !newUserSet.has(uid));
  const addedExtIds = external_ids.filter((eid) => !oldExtIds.has(eid));
  const removedExtIds = [...oldExtIds].filter((eid) => !newExtSet.has(eid));

  const dueDate = reservation.check_out.split('-').reverse().join('.');
  const emailPromises: Promise<any>[] = [];
  const appUrl = getAppUrl();

  // In-app notifikacije
  if (addedUserIds.length > 0) {
    await createNotificationsForMany(addedUserIds, {
      type: 'cleaning_assigned',
      title: 'Dodjela čišćenja',
      body: `Dodijeljen/a si za čišćenje u apartmanu ${apartmentName} dana ${dueDate}.`,
      link: '/zadatci',
    });
  }
  if (removedUserIds.length > 0) {
    await createNotificationsForMany(removedUserIds, {
      type: 'cleaning_cancelled',
      title: 'Čišćenje otkazano',
      body: `Uklonjen/a si s čišćenja u apartmanu ${apartmentName}.`,
      link: '/zadatci',
    });
  }

  // Regular users
  const allChangedUserIds = [...addedUserIds, ...removedUserIds];
  if (allChangedUserIds.length > 0) {
    const { data: profiles } = await adminSupabase.from('profiles').select('id, full_name, email').in('id', allChangedUserIds);
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    let userTokenMap = new Map<string, string>();
    if (addedUserIds.length > 0 && task) {
      const { data: userTokenRows } = await adminSupabase.from('task_assignees').select('user_id, completion_token').eq('task_id', task.id).not('user_id', 'is', null);
      userTokenMap = new Map((userTokenRows ?? []).map((r: any) => [r.user_id, r.completion_token]));
    }

    for (const uid of addedUserIds) {
      const p = profileMap.get(uid);
      if (p) {
        const token = userTokenMap.get(uid);
        emailPromises.push(sendTaskAssignedEmail({
          to: p.email, assigneeName: p.full_name,
          apartmentName, taskTitle: 'Čišćenje',
          dueDate, dueTime: checkOutTime,
          completionUrl: token ? `${appUrl}/api/zadatci/complete-token?token=${token}` : undefined,
        }).catch(() => {}));
      }
    }
    for (const uid of removedUserIds) {
      const p = profileMap.get(uid);
      if (p) emailPromises.push(sendTaskCancelledEmail({ to: p.email, assigneeName: p.full_name, apartmentName, taskTitle: 'Čišćenje', dueDate, dueTime: checkOutTime }).catch(() => {}));
    }
  }

  // External members
  if (addedExtIds.length > 0 && task) {
    const { data: extMembers } = await adminSupabase.from('external_members').select('id, name, email').in('id', addedExtIds);
    const { data: extRows } = await adminSupabase.from('task_assignees').select('external_member_id, completion_token').eq('task_id', task.id).not('external_member_id', 'is', null);
    const tokenMap = new Map((extRows ?? []).map((r: any) => [r.external_member_id, r.completion_token]));

    for (const em of extMembers ?? []) {
      const token = tokenMap.get((em as any).id);
      if (!token) continue;
      emailPromises.push(sendTaskAssignedExternalEmail({
        to: (em as any).email, name: (em as any).name,
        apartmentName, taskTitle: 'Čišćenje',
        dueDate, dueTime: checkOutTime,
        completionUrl: `${appUrl}/api/zadatci/complete-token?token=${token}`,
      }).catch(() => {}));
    }
  }

  if (removedExtIds.length > 0) {
    const { data: removedExt } = await adminSupabase.from('external_members').select('id, name, email').in('id', removedExtIds);
    for (const em of removedExt ?? []) {
      emailPromises.push(sendTaskCancelledEmail({ to: (em as any).email, assigneeName: (em as any).name, apartmentName, taskTitle: 'Čišćenje', dueDate, dueTime: checkOutTime }).catch(() => {}));
    }
  }

  await Promise.all(emailPromises);

  return json({ success: true });
};
