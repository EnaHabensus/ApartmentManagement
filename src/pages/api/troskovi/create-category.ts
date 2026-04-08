import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';

const COLOR_PALETTE = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#A855F7', '#F43F5E', '#0EA5E9', '#22C55E',
];

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const adminSupabase = createSupabaseAdminClient();
  const { data: au } = await adminSupabase.from('apartment_users').select('role').eq('user_id', user.id).eq('role', 'admin').limit(1);
  if (!au?.length) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

  const { name } = await request.json();
  if (!name?.trim()) return new Response(JSON.stringify({ error: 'Naziv kategorije je obavezan.' }), { status: 400 });

  // Pronađi boju koja još nije korištena
  const { data: existingCats } = await adminSupabase.from('expense_categories').select('color');
  const usedColors = new Set((existingCats ?? []).map((c) => c.color));
  const color = COLOR_PALETTE.find((c) => !usedColors.has(c)) ?? COLOR_PALETTE[existingCats?.length ?? 0 % COLOR_PALETTE.length];

  const { data, error } = await adminSupabase
    .from('expense_categories')
    .insert({ name: name.trim(), color })
    .select('id, name, color')
    .single();

  if (error) {
    if (error.code === '23505') return new Response(JSON.stringify({ error: 'Kategorija s tim nazivom već postoji.' }), { status: 400 });
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify({ success: true, category: data }), { status: 200 });
};
