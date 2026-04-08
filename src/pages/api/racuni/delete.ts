import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const adminSupabase = createSupabaseAdminClient();
  const { data: au } = await adminSupabase.from('apartment_users').select('role').eq('user_id', user.id).eq('role', 'admin').limit(1);
  if (!au?.length) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

  const { invoice_id } = await request.json();
  if (!invoice_id) return new Response(JSON.stringify({ error: 'ID računa je obavezan.' }), { status: 400 });

  // Dohvati račun
  const { data: invoice } = await adminSupabase
    .from('invoices')
    .select('id, reservation_id, pdf_url')
    .eq('id', invoice_id)
    .single();

  if (!invoice) return new Response(JSON.stringify({ error: 'Račun nije pronađen.' }), { status: 404 });

  // Obriši PDF iz Storage-a ako postoji
  if (invoice.pdf_url) {
    try {
      // Izvuci path iz public URL-a
      // URL format: https://<project>.supabase.co/storage/v1/object/public/invoices/<path>
      const url = new URL(invoice.pdf_url);
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/invoices\/(.+)$/);
      if (pathMatch) {
        const storagePath = decodeURIComponent(pathMatch[1]);
        await adminSupabase.storage.from('invoices').remove([storagePath]);
      }
    } catch {
      // Nastavi s brisanjem DB zapisa čak i ako Storage brisanje ne uspije
    }
  }

  // Obriši DB zapis
  const { error } = await adminSupabase.from('invoices').delete().eq('id', invoice_id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
