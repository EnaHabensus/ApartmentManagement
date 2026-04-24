import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const adminSupabase = createSupabaseAdminClient();
  const form = await request.formData();
  const name = (form.get('name') as string ?? '').trim();
  const content = (form.get('content') as string ?? '').trim();

  if (!name || !content) {
    return redirect('/predlosci?error=' + encodeURIComponent('Naziv i sadržaj su obavezni.'));
  }

  const { error } = await adminSupabase.from('templates').insert({
    name,
    content,
    created_by: user.id,
  });

  if (error) {
    return redirect('/predlosci?error=' + encodeURIComponent('Greška pri spremanju.'));
  }

  return redirect('/predlosci?success=created');
};
