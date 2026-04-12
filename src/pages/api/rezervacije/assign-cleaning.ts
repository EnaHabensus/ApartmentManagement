import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';

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

  // Pronađi check_out_time apartmana
  const { data: apt } = await adminSupabase
    .from('apartments')
    .select('check_out_time')
    .eq('id', reservation.apartment_id)
    .single();

  const checkOutTime = (apt as any)?.check_out_time ?? null;

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

  return json({ success: true });
};
