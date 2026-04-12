import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';
import { sendExternalWelcomeEmail } from '../../../lib/resend';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  let body: { name?: string; email?: string; apartment_ids?: string[] };
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON.' }), { status: 400 });
  }

  const { name, email, apartment_ids = [] } = body;
  if (!name?.trim() || !email?.trim()) {
    return new Response(JSON.stringify({ error: 'Ime i email su obavezni.' }), { status: 400 });
  }
  if (apartment_ids.length === 0) {
    return new Response(JSON.stringify({ error: 'Odaberite barem jedan apartman.' }), { status: 400 });
  }

  const adminSupabase = createSupabaseAdminClient();

  // Provjeri admin ulogu na svim apartmanima
  for (const aptId of apartment_ids) {
    const { data: roleRow } = await adminSupabase
      .from('apartment_users')
      .select('role')
      .eq('apartment_id', aptId)
      .eq('user_id', user.id)
      .single();
    if (roleRow?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Nemate admin prava na odabranom apartmanu.' }), { status: 403 });
    }
  }

  // Kreiraj external_member
  const { data: extMember, error: insertErr } = await adminSupabase
    .from('external_members')
    .insert({ name: name.trim(), email: email.trim().toLowerCase(), created_by: user.id })
    .select()
    .single();

  if (insertErr || !extMember) {
    return new Response(JSON.stringify({ error: 'Greška pri dodavanju osoblja.' }), { status: 500 });
  }

  // Dodaj na apartmane
  await adminSupabase.from('apartment_external_members').insert(
    apartment_ids.map((aptId) => ({ apartment_id: aptId, external_member_id: extMember.id }))
  );

  // Dohvati nazive apartmana za welcome email
  const { data: aptData } = await adminSupabase
    .from('apartments')
    .select('name')
    .in('id', apartment_ids);

  const apartmentNames = (aptData ?? []).map((a) => a.name);

  // Pošalji welcome email
  await sendExternalWelcomeEmail({
    to: extMember.email,
    name: extMember.name,
    apartmentNames,
  }).catch(() => {});

  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
