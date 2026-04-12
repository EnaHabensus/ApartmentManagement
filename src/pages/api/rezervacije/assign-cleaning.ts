import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';
import { sendTaskAssignedEmail, sendTaskCancelledEmail } from '../../../lib/resend';

export const POST: APIRoute = async ({ request, cookies }) => {
  const json = (data: object, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Niste prijavljeni.' }, 401);

  let body: { reservation_id?: string; user_ids?: string[]; check_out?: string };
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON.' }, 400); }

  const { reservation_id, user_ids = [], check_out } = body;
  if (!reservation_id) return json({ error: 'reservation_id nedostaje.' }, 400);

  const adminSupabase = createSupabaseAdminClient();

  // Dohvati rezervaciju
  const { data: reservation } = await adminSupabase
    .from('reservations')
    .select('apartment_id, check_out')
    .eq('id', reservation_id)
    .single();

  if (!reservation) return json({ error: 'Rezervacija nije pronađena.' }, 404);

  // Provjeri da je korisnik admin apartmana
  const { data: roleRow } = await adminSupabase
    .from('apartment_users')
    .select('role')
    .eq('apartment_id', reservation.apartment_id)
    .eq('user_id', user.id)
    .single();

  if (!roleRow) return json({ error: 'Nemate pristup ovoj rezervaciji.' }, 403);

  // Dohvati apartman (naziv + check_out_time za email i zadatak)
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
    .select('user_id')
    .eq('reservation_id', reservation_id);
  const oldIds = new Set((oldCleaningRows ?? []).map((r) => r.user_id));

  // Obriši sve postojeće dodjele čišćenja i auto-zadatak za ovu rezervaciju
  const { data: existingTasks } = await adminSupabase
    .from('tasks')
    .select('id')
    .eq('reservation_id', reservation_id)
    .eq('source', 'cleaning_auto');

  if (existingTasks && existingTasks.length > 0) {
    const taskIds = existingTasks.map((t) => t.id);
    await adminSupabase.from('task_assignees').delete().in('task_id', taskIds);
    await adminSupabase.from('tasks').delete().in('id', taskIds);
  }

  await adminSupabase.from('reservation_cleaning').delete().eq('reservation_id', reservation_id);

  // Ako nema odabranih čistača, samo ukloni — gotovo
  if (!user_ids || user_ids.length === 0) return json({ success: true });

  // Kreiraj nove dodjele (jedna po čistaču)
  await adminSupabase.from('reservation_cleaning').insert(
    user_ids.map((uid) => ({ reservation_id, user_id: uid }))
  );

  // Kreiraj jedan zadatak čišćenja s više assigneeja
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
    await adminSupabase.from('task_assignees').insert(
      user_ids.map((uid) => ({ task_id: task.id, user_id: uid }))
    );
  }

  // Email notifikacije — samo za promjene (fire-and-forget)
  const newIds = new Set(user_ids);
  const addedIds   = user_ids.filter((uid) => !oldIds.has(uid));
  const removedIds = [...oldIds].filter((uid) => !newIds.has(uid));

  if (addedIds.length > 0 || removedIds.length > 0) {
    const allAffectedIds = [...addedIds, ...removedIds];
    const { data: profiles } = await adminSupabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', allAffectedIds);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const dueDate = reservation.check_out.split('-').reverse().join('.');

    for (const uid of addedIds) {
      const p = profileMap.get(uid);
      if (p) sendTaskAssignedEmail({
        to: p.email, assigneeName: p.full_name,
        apartmentName, taskTitle: 'Čišćenje',
        dueDate, dueTime: checkOutTime,
      }).catch(() => {});
    }
    for (const uid of removedIds) {
      const p = profileMap.get(uid);
      if (p) sendTaskCancelledEmail({
        to: p.email, assigneeName: p.full_name,
        apartmentName, taskTitle: 'Čišćenje',
        dueDate, dueTime: checkOutTime,
      }).catch(() => {});
    }
  }

  return json({ success: true });
};
