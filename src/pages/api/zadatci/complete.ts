import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';
import { sendTaskCompletedEmail } from '../../../lib/resend';
import { createNotificationsForMany } from '../../../lib/notifications';

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

  // Dohvati zadatak (title + apartment_id)
  const { data: task } = await adminSupabase
    .from('tasks')
    .select('apartment_id, is_completed, title')
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

  // Pošalji email adminima apartmana (fire-and-forget)
  const [{ data: apt }, { data: completerProfile }, { data: adminRows }] = await Promise.all([
    adminSupabase.from('apartments').select('name').eq('id', task.apartment_id).single(),
    adminSupabase.from('profiles').select('full_name').eq('id', user.id).single(),
    adminSupabase.from('apartment_users').select('user_id').eq('apartment_id', task.apartment_id).eq('role', 'admin'),
  ]);

  if (apt && completerProfile && adminRows && adminRows.length > 0) {
    const adminIds = adminRows.map((r) => r.user_id);

    // In-app notifikacije za admine
    await createNotificationsForMany(adminIds, {
      type: 'task_completed',
      title: 'Zadatak završen',
      body: `${completerProfile.full_name} je završio/la zadatak "${task.title}" u ${apt.name}.`,
      link: '/zadatci',
    });

    const { data: adminProfiles } = await adminSupabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', adminIds);

    for (const adminProfile of adminProfiles ?? []) {
      sendTaskCompletedEmail({
        to: adminProfile.email,
        adminName: adminProfile.full_name,
        completedByName: completerProfile.full_name,
        taskTitle: task.title,
        apartmentName: apt.name,
      }).catch(() => {});
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
