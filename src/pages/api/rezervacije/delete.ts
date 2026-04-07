import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  const json = (data: object, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Niste prijavljeni.' }, 401);

  let body: { id?: string };
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON.' }, 400); }

  const { id } = body;
  if (!id) return json({ error: 'ID rezervacije nedostaje.' }, 400);

  const adminSupabase = createSupabaseAdminClient();

  const { data: reservation } = await adminSupabase
    .from('reservations')
    .select('apartment_id')
    .eq('id', id)
    .single();

  if (!reservation) return json({ error: 'Rezervacija nije pronađena.' }, 404);

  const { data: roleRow } = await adminSupabase
    .from('apartment_users')
    .select('role')
    .eq('apartment_id', reservation.apartment_id)
    .eq('user_id', user.id)
    .single();

  if (roleRow?.role !== 'admin') return json({ error: 'Nemate prava za brisanje.' }, 403);

  // Obriši povezane zadatke čišćenja
  const { data: cleaningTasks } = await adminSupabase
    .from('tasks')
    .select('id')
    .eq('reservation_id', id)
    .eq('source', 'cleaning_auto');

  if (cleaningTasks && cleaningTasks.length > 0) {
    const taskIds = cleaningTasks.map((t) => t.id);
    await adminSupabase.from('task_assignees').delete().in('task_id', taskIds);
    await adminSupabase.from('tasks').delete().in('id', taskIds);
  }

  // Obriši reservation_cleaning
  await adminSupabase.from('reservation_cleaning').delete().eq('reservation_id', id);

  // Obriši rezervaciju
  const { error } = await adminSupabase.from('reservations').delete().eq('id', id);
  if (error) return json({ error: 'Greška pri brisanju: ' + error.message }, 500);

  return json({ success: true });
};
