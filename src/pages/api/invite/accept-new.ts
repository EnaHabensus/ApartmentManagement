import type { APIRoute } from 'astro';
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const token = formData.get('token')?.toString();
  const full_name = formData.get('full_name')?.toString()?.trim();
  const password = formData.get('password')?.toString();
  const password_confirm = formData.get('password_confirm')?.toString();

  if (!token || !full_name || !password || !password_confirm) {
    return redirect(`/invite?token=${token}&error=Sva+polja+su+obavezna.`);
  }

  if (password.length < 8) {
    return redirect(`/invite?token=${token}&error=Lozinka+mora+imati+najmanje+8+znakova.`);
  }

  if (password !== password_confirm) {
    return redirect(`/invite?token=${token}&error=Lozinke+se+ne+podudaraju.`);
  }

  const adminSupabase = createSupabaseAdminClient();

  // Dohvati invite token
  const { data: invite } = await adminSupabase
    .from('invite_tokens')
    .select('*')
    .eq('id', token)
    .single();

  if (!invite || invite.accepted_at || new Date(invite.expires_at) < new Date()) {
    return redirect('/login?error=Pozivnica+nije+valjana+ili+je+istekla.');
  }

  // Kreiraj korisnika
  const { data: authData, error: signUpError } = await adminSupabase.auth.admin.createUser({
    email: invite.email,
    password,
    user_metadata: { full_name },
    email_confirm: true,
  });

  if (signUpError || !authData.user) {
    return redirect(`/invite?token=${token}&error=Greška+pri+kreiranju+računa.`);
  }

  // Dodaj na apartmane
  for (const apartmentId of invite.apartment_ids) {
    await adminSupabase
      .from('apartment_users')
      .upsert({
        apartment_id: apartmentId,
        user_id: authData.user.id,
        role: invite.role,
        added_by: invite.invited_by,
      }, { onConflict: 'apartment_id,user_id' });
  }

  // Označi token kao iskorišten
  await adminSupabase
    .from('invite_tokens')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', token);

  // Automatski prijavi korisnika
  const serverSupabase = createSupabaseServerClient(request, cookies);
  await serverSupabase.auth.signInWithPassword({
    email: invite.email,
    password,
  });

  return redirect('/zadatci');
};
