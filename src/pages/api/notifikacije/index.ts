import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';

export const GET: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const adminSupabase = createSupabaseAdminClient();
  const { data } = await adminSupabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30);

  return new Response(JSON.stringify({ notifications: data ?? [] }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
