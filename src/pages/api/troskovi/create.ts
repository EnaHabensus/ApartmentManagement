import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const adminSupabase = createSupabaseAdminClient();
  const { data: au } = await adminSupabase.from('apartment_users').select('role').eq('user_id', user.id).eq('role', 'admin').limit(1);
  if (!au?.length) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

  const formData = await request.formData();
  const apartment_id = formData.get('apartment_id')?.toString();
  const category_id = formData.get('category_id')?.toString() || null;
  const title = formData.get('title')?.toString();
  const amount = parseFloat(formData.get('amount')?.toString() ?? '0');
  const expense_date = formData.get('expense_date')?.toString();
  const created_by = formData.get('created_by')?.toString();
  const notes = formData.get('notes')?.toString() || null;

  if (!apartment_id || !title || !expense_date || !created_by || isNaN(amount)) {
    return new Response(JSON.stringify({ error: 'Sva obavezna polja moraju biti popunjena.' }), { status: 400 });
  }

  const { error } = await adminSupabase.from('expenses').insert({
    apartment_id, category_id, title, amount, expense_date, created_by, notes,
  });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
