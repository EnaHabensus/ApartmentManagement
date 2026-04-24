import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const adminSupabase = createSupabaseAdminClient();

  const { data: auRows } = await adminSupabase
    .from('apartment_users')
    .select('role')
    .eq('user_id', user.id);

  const isAdmin = (auRows ?? []).some((r) => r.role === 'admin');
  if (!isAdmin) return redirect('/predlosci?error=' + encodeURIComponent('Nemate ovlasti.'));

  const form = await request.formData();
  const id = (form.get('id') as string ?? '').trim();
  const name = (form.get('name') as string ?? '').trim();
  const content = (form.get('content') as string ?? '').trim();

  if (!id || !name || !content) {
    return redirect('/predlosci?error=' + encodeURIComponent('Sva polja su obavezna.'));
  }

  const { error } = await adminSupabase
    .from('templates')
    .update({ name, content })
    .eq('id', id);

  if (error) {
    return redirect('/predlosci?error=' + encodeURIComponent('Greška pri ažuriranju.'));
  }

  return redirect('/predlosci?success=updated');
};
