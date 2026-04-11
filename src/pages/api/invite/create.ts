import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';
import {
  sendInviteNewUserEmail,
  sendInviteExistingUserEmail,
} from '../../../lib/resend';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await request.json();
  const { email, apartment_ids, role = 'staff', full_name } = body;

  if (!email || !apartment_ids?.length) {
    return new Response(JSON.stringify({ error: 'Email i apartmani su obavezni.' }), { status: 400 });
  }

  const adminSupabase = createSupabaseAdminClient();

  // Provjeri je li admin na svim navedenim apartmanima
  const { data: adminCheck } = await supabase
    .from('apartment_users')
    .select('apartment_id')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .in('apartment_id', apartment_ids);

  if ((adminCheck?.length ?? 0) !== apartment_ids.length) {
    return new Response(JSON.stringify({ error: 'Nemate admin prava na svim apartmanima.' }), { status: 403 });
  }

  // Dohvati profil admina koji šalje pozivnicu
  const { data: inviterProfile } = await adminSupabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  // Dohvati naziv prvog apartmana (za email)
  const { data: apartments } = await adminSupabase
    .from('apartments')
    .select('name')
    .in('id', apartment_ids);
  const apartmentName = apartments?.map((a) => a.name).join(', ') ?? '';

  // Kreiraj invite token
  const { data: inviteToken } = await adminSupabase
    .from('invite_tokens')
    .insert({
      email,
      full_name: full_name || email.split('@')[0],
      apartment_ids,
      role,
      invited_by: user.id,
    })
    .select()
    .single();

  if (!inviteToken) {
    return new Response(JSON.stringify({ error: 'Greška pri kreiranju pozivnice.' }), { status: 500 });
  }

  const baseUrl = new URL(request.url).origin;

  // Provjeri postoji li korisnik s tim emailom
  const { data: existingProfile } = await adminSupabase
    .from('profiles')
    .select('id, full_name')
    .eq('email', email)
    .single();

  if (existingProfile) {
    // Scenarij B: korisnik već postoji
    await sendInviteExistingUserEmail({
      to: email,
      inviteeName: existingProfile.full_name,
      inviterName: inviterProfile?.full_name ?? 'Admin',
      apartmentName,
      acceptUrl: `${baseUrl}/invite/accept?token=${inviteToken.id}`,
    });
  } else {
    // Scenarij A: novi korisnik
    await sendInviteNewUserEmail({
      to: email,
      inviteeName: full_name || email.split('@')[0],
      inviterName: inviterProfile?.full_name ?? 'Admin',
      apartmentName,
      inviteUrl: `${baseUrl}/invite?token=${inviteToken.id}`,
    });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
