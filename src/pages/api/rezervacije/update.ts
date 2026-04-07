import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const formData = await request.formData();
  const id = formData.get('id')?.toString();
  if (!id) return redirect('/rezervacije?error=ID+rezervacije+nedostaje.');

  const adminSupabase = createSupabaseAdminClient();

  // Dohvati postojeću rezervaciju
  const { data: existing } = await adminSupabase
    .from('reservations')
    .select('apartment_id')
    .eq('id', id)
    .single();

  if (!existing) return redirect('/rezervacije?error=' + encodeURIComponent('Rezervacija nije pronađena.'));

  // Provjeri admin ulogu
  const { data: roleRow } = await adminSupabase
    .from('apartment_users')
    .select('role')
    .eq('apartment_id', existing.apartment_id)
    .eq('user_id', user.id)
    .single();

  if (roleRow?.role !== 'admin') {
    return redirect('/rezervacije?error=' + encodeURIComponent('Nemate prava za uređivanje rezervacije.'));
  }

  const apartment_id = formData.get('apartment_id')?.toString();
  const guest_name = formData.get('guest_name')?.toString()?.trim();
  const guest_phone = formData.get('guest_phone')?.toString()?.trim() || null;
  const check_in = formData.get('check_in')?.toString();
  const check_out = formData.get('check_out')?.toString();
  const num_guests = parseInt(formData.get('num_guests')?.toString() ?? '1');
  const payment_type = formData.get('payment_type')?.toString() || null;
  const amount_gross_raw = formData.get('amount_gross')?.toString();
  const commission_raw = formData.get('commission')?.toString();

  if (!guest_name || !check_in || !check_out || !apartment_id) {
    return redirect('/rezervacije?error=Sva+obavezna+polja+moraju+biti+popunjena.');
  }

  if (check_out <= check_in) {
    return redirect('/rezervacije?error=' + encodeURIComponent('Check-out mora biti nakon check-in datuma.'));
  }

  const amount_gross = amount_gross_raw ? parseFloat(amount_gross_raw) : null;
  const commission = commission_raw ? parseFloat(commission_raw) : null;

  const { error } = await adminSupabase
    .from('reservations')
    .update({
      apartment_id,
      guest_name,
      guest_phone,
      check_in,
      check_out,
      num_guests,
      payment_type: payment_type || null,
      amount_gross,
      commission,
    })
    .eq('id', id);

  if (error) {
    return redirect('/rezervacije?error=' + encodeURIComponent('Greška pri ažuriranju: ' + error.message));
  }

  return redirect('/rezervacije?success=updated');
};
