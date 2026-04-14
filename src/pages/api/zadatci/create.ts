import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';
import { sendTaskAssignedEmail, sendTaskAssignedExternalEmail, getAppUrl } from '../../../lib/resend';
import { createNotificationsForMany } from '../../../lib/notifications';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const formData = await request.formData();
  const apartment_id = formData.get('apartment_id')?.toString();
  if (!apartment_id) return redirect('/zadatci?error=Apartman+je+obavezan.');

  const adminSupabase = createSupabaseAdminClient();

  // Provjeri admin ulogu
  const { data: roleRow } = await adminSupabase
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
  const external_assignee_ids_raw = formData.get('external_assignee_ids')?.toString();

  if (!title || !due_date) {
    return redirect('/zadatci?error=Naziv+i+datum+su+obavezni.');
  }

  const { data: task, error } = await adminSupabase
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
    return redirect('/zadatci?error=' + encodeURIComponent('Greška pri kreiranju zadatka: ' + (error?.message ?? 'nepoznata greška')));
  }

  let assignee_ids: string[] = [];
  try { assignee_ids = JSON.parse(assignee_ids_raw ?? '[]'); } catch { assignee_ids = []; }

  let external_assignee_ids: string[] = [];
  try { external_assignee_ids = JSON.parse(external_assignee_ids_raw ?? '[]'); } catch { external_assignee_ids = []; }

  // Dodaj regularne assignee-je
  if (assignee_ids.length > 0) {
    await adminSupabase.from('task_assignees').insert(
      assignee_ids.map((uid) => ({ task_id: task.id, user_id: uid }))
    );
  }

  // Dodaj external assignee-je
  if (external_assignee_ids.length > 0) {
    await adminSupabase.from('task_assignees').insert(
      external_assignee_ids.map((eid) => ({ task_id: task.id, external_member_id: eid }))
    );
  }

  // Pošalji emailove
  if (assignee_ids.length > 0 || external_assignee_ids.length > 0) {
    const [{ data: apt }, { data: profiles }, { data: extMembers }, { data: insertedExtRows }, { data: insertedUserRows }] = await Promise.all([
      adminSupabase.from('apartments').select('name').eq('id', apartment_id).single(),
      assignee_ids.length > 0
        ? adminSupabase.from('profiles').select('id, full_name, email').in('id', assignee_ids)
        : Promise.resolve({ data: [] }),
      external_assignee_ids.length > 0
        ? adminSupabase.from('external_members').select('id, name, email').in('id', external_assignee_ids)
        : Promise.resolve({ data: [] }),
      external_assignee_ids.length > 0
        ? adminSupabase.from('task_assignees').select('external_member_id, completion_token').eq('task_id', task.id).not('external_member_id', 'is', null)
        : Promise.resolve({ data: [] }),
      assignee_ids.length > 0
        ? adminSupabase.from('task_assignees').select('user_id, completion_token').eq('task_id', task.id).not('user_id', 'is', null)
        : Promise.resolve({ data: [] }),
    ]);

    const dueDate = due_date.split('-').reverse().join('.');
    const aptName = apt?.name ?? '';
    const tokenMap = new Map((insertedExtRows ?? []).map((r: any) => [r.external_member_id, r.completion_token]));
    const userTokenMap = new Map((insertedUserRows ?? []).map((r: any) => [r.user_id, r.completion_token]));
    const appUrl = getAppUrl();

    // In-app notifikacije za regularne korisnike
    if (assignee_ids.length > 0) {
      await createNotificationsForMany(assignee_ids, {
        type: 'task_assigned',
        title: 'Novi zadatak',
        body: `Dodijeljen ti je zadatak "${title}" u apartmanu ${aptName}.`,
        link: '/zadatci',
      });
    }

    await Promise.all([
      ...(profiles ?? []).map((p) => {
        const token = userTokenMap.get(p.id);
        return sendTaskAssignedEmail({
          to: p.email, assigneeName: p.full_name,
          apartmentName: aptName, taskTitle: title,
          dueDate, dueTime: due_time,
          completionUrl: token ? `${appUrl}/api/zadatci/complete-token?token=${token}` : null,
        }).catch(() => {});
      }),
      ...(extMembers ?? []).map((em: any) => {
        const token = tokenMap.get(em.id);
        if (!token) return Promise.resolve();
        return sendTaskAssignedExternalEmail({
          to: em.email, name: em.name,
          apartmentName: aptName, taskTitle: title,
          dueDate, dueTime: due_time,
          completionUrl: `${appUrl}/api/zadatci/complete-token?token=${token}`,
        }).catch(() => {});
      }),
    ]);
  }

  return redirect('/zadatci?success=created');
};
