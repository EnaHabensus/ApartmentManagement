import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const adminSupabase = createSupabaseAdminClient();
  const { data: au } = await adminSupabase.from('apartment_users').select('role').eq('user_id', user.id).eq('role', 'admin').limit(1);
  if (!au?.length) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

  const { name } = await request.json();
  if (!name?.trim()) return new Response(JSON.stringify({ error: 'Naziv kategorije je obavezan.' }), { status: 400 });

  const { data, error } = await adminSupabase
    .from('expense_categories')
    .insert({ name: name.trim() })
    .select('id, name')
    .single();

  if (error) {
    if (error.code === '23505') return new Response(JSON.stringify({ error: 'Kategorija s tim nazivom već postoji.' }), { status: 400 });
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify({ success: true, category: data }), { status: 200 });
};
