import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const adminSupabase = createSupabaseAdminClient();
  const form = await request.formData();
  const id = (form.get('id') as string ?? '').trim();

  if (!id) {
    return redirect('/predlosci?error=' + encodeURIComponent('Nevažeći predložak.'));
  }

  // Može obrisati samo kreator ili admin
  const { data: tmpl } = await adminSupabase.from('templates').select('created_by').eq('id', id).single();
  const { data: auRows } = await adminSupabase.from('apartment_users').select('role').eq('user_id', user.id);
  const isAdmin = (auRows ?? []).some((r) => r.role === 'admin');

  if (tmpl?.created_by !== user.id && !isAdmin) {
    return redirect('/predlosci?error=' + encodeURIComponent('Nemate ovlasti za brisanje ovog predloška.'));
  }

  const { error } = await adminSupabase.from('templates').delete().eq('id', id);

  if (error) {
    return redirect('/predlosci?error=' + encodeURIComponent('Greška pri brisanju.'));
  }

  return redirect('/predlosci?success=deleted');
};
