import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';
import { sendTaskAssignedEmail } from '../../../lib/resend';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const formData = await request.formData();
  const apartment_id = formData.get('apartment_id')?.toString();
  if (!apartment_id) return redirect('/zadatci?error=Apartman+je+obavezan.');

  const adminSupabase = createSupabaseAdminClient();

  // Provjeri admin ulogu na odabranom apartmanu
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

  // Dodaj assignee-je i pošalji notifikacije
  if (assignee_ids_raw) {
    let assignee_ids: string[] = [];
    try { assignee_ids = JSON.parse(assignee_ids_raw); } catch { assignee_ids = []; }

    if (assignee_ids.length > 0) {
      await adminSupabase.from('task_assignees').insert(
        assignee_ids.map((uid) => ({ task_id: task.id, user_id: uid }))
      );

      // Dohvati apartman naziv i profile assigneeja za email
      const [{ data: apt }, { data: profiles }] = await Promise.all([
        adminSupabase.from('apartments').select('name').eq('id', apartment_id).single(),
        adminSupabase.from('profiles').select('id, full_name, email').in('id', assignee_ids),
      ]);

      const dueDate = due_date.split('-').reverse().join('.');
      for (const profile of profiles ?? []) {
        sendTaskAssignedEmail({
          to: profile.email,
          assigneeName: profile.full_name,
          apartmentName: apt?.name ?? '',
          taskTitle: title,
          dueDate,
          dueTime: due_time,
        }).catch(() => {}); // fire-and-forget, ne blokiraj redirect
      }
    }
  }

  return redirect('/zadatci?success=created');
};
