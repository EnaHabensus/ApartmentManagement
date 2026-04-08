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
  const file = formData.get('file') as File | null;
  const invoice_id = formData.get('invoice_id')?.toString();
  const reservation_id = formData.get('reservation_id')?.toString();

  if (!file || !invoice_id || !reservation_id) {
    return new Response(JSON.stringify({ error: 'Datoteka i ID računa su obavezni.' }), { status: 400 });
  }

  if (file.type !== 'application/pdf') {
    return new Response(JSON.stringify({ error: 'Dopušteni su samo PDF dokumenti.' }), { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const path = `${reservation_id}/${Date.now()}.pdf`;

  const { error: uploadError } = await adminSupabase.storage
    .from('invoices')
    .upload(path, arrayBuffer, { contentType: 'application/pdf', upsert: true });

  if (uploadError) {
    return new Response(JSON.stringify({ error: `Greška pri uploadu: ${uploadError.message}` }), { status: 500 });
  }

  const { data: { publicUrl } } = adminSupabase.storage.from('invoices').getPublicUrl(path);

  const { error: updateError } = await adminSupabase
    .from('invoices')
    .update({ pdf_url: publicUrl })
    .eq('id', invoice_id);

  if (updateError) return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });

  return new Response(JSON.stringify({ success: true, pdf_url: publicUrl }), { status: 200 });
};
