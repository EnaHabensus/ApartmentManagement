import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = body;
  if (!id) {
    return new Response(JSON.stringify({ error: 'ID zadatka nedostaje.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const adminSupabase = createSupabaseAdminClient();

  // Provjeri da korisnik ima pristup zadatku (admin ili assignee)
  const { data: task } = await adminSupabase
    .from('tasks')
    .select('apartment_id, is_completed')
    .eq('id', id)
    .single();

  if (!task) {
    return new Response(JSON.stringify({ error: 'Zadatak nije pronađen.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Provjeri je li korisnik admin ili assignee za ovaj zadatak
  const [{ data: roleRow }, { data: assigneeRow }] = await Promise.all([
    adminSupabase
      .from('apartment_users')
      .select('role')
      .eq('apartment_id', task.apartment_id)
      .eq('user_id', user.id)
      .single(),
    adminSupabase
      .from('task_assignees')
      .select('user_id')
      .eq('task_id', id)
      .eq('user_id', user.id)
      .single(),
  ]);

  if (!roleRow && !assigneeRow) {
    return new Response(JSON.stringify({ error: 'Nemate prava za ažuriranje ovog zadatka.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { error } = await adminSupabase
    .from('tasks')
    .update({
      is_completed: true,
      completed_at: new Date().toISOString(),
      completed_by: user.id,
    })
    .eq('id', id);

  if (error) {
    return new Response(JSON.stringify({ error: 'Greška pri označavanju zadatka.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
