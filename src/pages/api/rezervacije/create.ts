import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';

const json = (data: object, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Niste prijavljeni.' }, 401);

  const formData = await request.formData();
  const apartment_id = formData.get('apartment_id')?.toString();
  if (!apartment_id) return json({ error: 'Apartman je obavezan.' }, 400);

  const adminSupabase = createSupabaseAdminClient();

  const { data: roleRow } = await adminSupabase
    .from('apartment_users')
    .select('role')
    .eq('apartment_id', apartment_id)
    .eq('user_id', user.id)
    .single();

  if (roleRow?.role !== 'admin') return json({ error: 'Nemate prava za kreiranje rezervacije.' }, 403);

  const guest_name = formData.get('guest_name')?.toString()?.trim();
  const guest_phone = formData.get('guest_phone')?.toString()?.trim() || null;
  const check_in = formData.get('check_in')?.toString();
  const check_out = formData.get('check_out')?.toString();
  const num_guests = parseInt(formData.get('num_guests')?.toString() ?? '1');
  const payment_type = formData.get('payment_type')?.toString() || null;
  const amount_gross_raw = formData.get('amount_gross')?.toString();
  const commission_raw = formData.get('commission')?.toString();

  if (!guest_name || !check_in || !check_out) return json({ error: 'Ime gosta, check-in i check-out su obavezni.' }, 400);
  if (check_out <= check_in) return json({ error: 'Check-out mora biti nakon check-in datuma.' }, 400);

  const { data: overlapping } = await adminSupabase
    .from('reservations')
    .select('guest_name, check_in, check_out')
    .eq('apartment_id', apartment_id)
    .eq('status', 'active')
    .lt('check_in', check_out)
    .gt('check_out', check_in);

  if (overlapping && overlapping.length > 0) {
    const o = overlapping[0];
    return json({ error: `Apartman je već rezerviran od ${o.check_in} do ${o.check_out} (${o.guest_name}).` }, 409);
  }

  const amount_gross = amount_gross_raw ? parseFloat(amount_gross_raw) : null;
  const commission = commission_raw ? parseFloat(commission_raw) : null;

  const { error } = await adminSupabase.from('reservations').insert({
    apartment_id, guest_name, guest_phone, check_in, check_out, num_guests,
    payment_type: payment_type || null, amount_gross, commission,
    documents_received: false, guests_registered: false, is_paid: false,
    status: 'active', created_by: user.id,
  });

  if (error) return json({ error: 'Greška pri kreiranju: ' + error.message }, 500);

  return json({ success: true });
};
