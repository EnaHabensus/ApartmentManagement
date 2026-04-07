import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';

export const GET: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const apartment_id = url.searchParams.get('apartment_id');

  if (!apartment_id) {
    return new Response(JSON.stringify({ error: 'apartment_id je obavezan.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Provjeri da korisnik ima pristup ovom apartmanu
  const { data: access } = await supabase
    .from('apartment_users')
    .select('role')
    .eq('apartment_id', apartment_id)
    .eq('user_id', user.id)
    .single();

  if (!access) {
    return new Response(JSON.stringify({ error: 'Nemate pristup ovom apartmanu.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Admin klijent za dohvat SVIH korisnika apartmana (uključujući admina)
  const adminSupabase = createSupabaseAdminClient();
  const { data, error } = await adminSupabase
    .from('apartment_users')
    .select('user_id, role, profiles(id, full_name, email)')
    .eq('apartment_id', apartment_id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const users = (data ?? []).map((row) => {
    const profile = row.profiles as unknown as { id: string; full_name: string; email: string } | null;
    return {
      id: row.user_id,
      full_name: profile?.full_name ?? 'Nepoznat',
      email: profile?.email ?? '',
      role: row.role,
    };
  });

  return new Response(JSON.stringify(users), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
