import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase';

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
  const reservation_id = url.searchParams.get('reservation_id');

  if (!reservation_id) {
    return new Response(JSON.stringify({ error: 'reservation_id je obavezan.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Dohvati reservation_cleaning zapise s profiles joinom
  const { data, error } = await supabase
    .from('reservation_cleaning')
    .select(`
      id,
      user_id,
      reservation_id,
      notified_immediately_at,
      notified_reminder_at,
      created_at,
      profiles!inner (
        full_name,
        email
      )
    `)
    .eq('reservation_id', reservation_id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(data ?? []), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
