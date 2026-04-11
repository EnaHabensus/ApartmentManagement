import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const formData = await request.formData();
  const tokenId = formData.get('token_id')?.toString();
  if (!tokenId) return redirect('/korisnici?error=' + encodeURIComponent('Nevažeći token.'));

  const adminSupabase = createSupabaseAdminClient();

  // Dohvati token
  const { data: token } = await adminSupabase
    .from('invite_tokens')
    .select('id, apartment_ids, invited_by')
    .eq('id', tokenId)
    .is('accepted_at', null)
    .single();

  if (!token) return redirect('/korisnici?error=' + encodeURIComponent('Pozivnica nije pronađena.'));

  // Provjeri je li korisnik admin na barem jednom apartmanu iz pozivnice
  const { data: adminCheck } = await adminSupabase
    .from('apartment_users')
    .select('apartment_id')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .in('apartment_id', token.apartment_ids);

  if (!adminCheck?.length) {
    return redirect('/korisnici?error=' + encodeURIComponent('Nemate prava za poništavanje ove pozivnice.'));
  }

  await adminSupabase.from('invite_tokens').delete().eq('id', tokenId);

  return redirect('/korisnici?success=invite_cancelled');
};
