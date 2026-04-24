import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const adminSupabase = createSupabaseAdminClient();
  const form = await request.formData();
  const id = (form.get('id') as string ?? '').trim();
  const name = (form.get('name') as string ?? '').trim();
  const content = (form.get('content') as string ?? '').trim();
  const aptIdsRaw = (form.get('apartment_ids') as string ?? '[]');

  if (!id || !name || !content) {
    return redirect('/predlosci?error=' + encodeURIComponent('Sva polja su obavezna.'));
  }

  let apartment_ids: string[] = [];
  try { apartment_ids = JSON.parse(aptIdsRaw); } catch { apartment_ids = []; }

  const { data: tmpl } = await adminSupabase.from('templates').select('created_by').eq('id', id).single();
  const { data: auRows } = await adminSupabase.from('apartment_users').select('role').eq('user_id', user.id);
  const isAdmin = (auRows ?? []).some((r) => r.role === 'admin');

  if (tmpl?.created_by !== user.id && !isAdmin) {
    return redirect('/predlosci?error=' + encodeURIComponent('Nemate ovlasti za uređivanje ovog predloška.'));
  }

  const { error } = await adminSupabase.from('templates').update({ name, content, apartment_ids }).eq('id', id);

  if (error) {
    return redirect('/predlosci?error=' + encodeURIComponent('Greška pri ažuriranju.'));
  }

  return redirect('/predlosci?success=updated');
};
