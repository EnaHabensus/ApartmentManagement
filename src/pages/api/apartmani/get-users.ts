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

  const adminSupabase = createSupabaseAdminClient();

  // Dohvati sve user_ids za taj apartman
  const { data: auRows, error: auError } = await adminSupabase
    .from('apartment_users')
    .select('user_id, role')
    .eq('apartment_id', apartment_id);

  if (auError) {
    return new Response(JSON.stringify({ error: auError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userIds = (auRows ?? []).map((r) => r.user_id);

  if (userIds.length === 0) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Dohvati profile zasebno
  const { data: profiles } = await adminSupabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds);

  const profilesMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const users = (auRows ?? []).map((row) => {
    const p = profilesMap.get(row.user_id);
    return {
      id: row.user_id,
      full_name: p?.full_name ?? 'Nepoznat',
      email: p?.email ?? '',
      role: row.role,
    };
  });

  return new Response(JSON.stringify(users), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
