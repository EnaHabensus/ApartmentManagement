import type { APIRoute } from 'astro';
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../lib/supabase';
import { sendInviteResponseEmail } from '../../../lib/resend';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: { token_id?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Neispravni podaci.' }), { status: 400 });
  }

  const { token_id, action } = body;

  if (!token_id || !['accept', 'decline'].includes(action ?? '')) {
    return new Response(JSON.stringify({ error: 'Neispravni podaci.' }), { status: 400 });
  }

  const adminSupabase = createSupabaseAdminClient();

  // Dohvati token
  const { data: invite } = await adminSupabase
    .from('invite_tokens')
    .select('*')
    .eq('id', token_id)
    .single();

  if (!invite) {
    return new Response(JSON.stringify({ error: 'Pozivnica nije pronađena.' }), { status: 404 });
  }

  if (invite.accepted_at) {
    return new Response(JSON.stringify({ error: 'Pozivnica je već prihvaćena.' }), { status: 400 });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return new Response(JSON.stringify({ error: 'Pozivnica je istekla.' }), { status: 400 });
  }

  // Provjeri da je pozivnica za ovog korisnika
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', user.id)
    .single();

  if (!profile || profile.email !== invite.email) {
    return new Response(JSON.stringify({ error: 'Ova pozivnica nije za vas.' }), { status: 403 });
  }

  if (action === 'accept') {
    for (const apartmentId of invite.apartment_ids) {
      await adminSupabase
        .from('apartment_users')
        .upsert({
          apartment_id: apartmentId,
          user_id: user.id,
          role: invite.role,
          added_by: invite.invited_by,
        }, { onConflict: 'apartment_id,user_id' });
    }

    await adminSupabase
      .from('invite_tokens')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', token_id);
  } else {
    // Decline: obriši token
    await adminSupabase
      .from('invite_tokens')
      .delete()
      .eq('id', token_id);
  }

  // Dohvati detalje za email obavijest
  const { data: apartments } = await adminSupabase
    .from('apartments')
    .select('name')
    .in('id', invite.apartment_ids);
  const apartmentName = (apartments ?? []).map((a: any) => a.name).join(', ');

  const { data: inviterProfile } = await adminSupabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', invite.invited_by)
    .single();

  if (inviterProfile?.email) {
    await sendInviteResponseEmail({
      to: inviterProfile.email,
      adminName: inviterProfile.full_name,
      staffName: profile.full_name,
      apartmentName,
      action: action as 'accept' | 'decline',
    }).catch((err: any) => console.error('[invite respond email]', err));
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
