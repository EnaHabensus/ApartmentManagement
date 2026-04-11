import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const email = formData.get('email')?.toString();
  const password = formData.get('password')?.toString();

  if (!email || !password) {
    return redirect('/login?error=invalid_credentials');
  }

  // Provjeri postoji li korisnik s tim emailom
  const adminSupabase = createSupabaseAdminClient();
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (!profile) {
    return redirect('/login?error=user_not_found');
  }

  const supabase = createSupabaseServerClient(request, cookies);
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return redirect('/login?error=invalid_credentials');
  }

  return redirect('/');
};
