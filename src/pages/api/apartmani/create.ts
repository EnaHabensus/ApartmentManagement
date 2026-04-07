import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const formData = await request.formData();
  const data = {
    name: formData.get('name')?.toString()?.trim(),
    address: formData.get('address')?.toString()?.trim(),
    postal_code: formData.get('postal_code')?.toString()?.trim(),
    city: formData.get('city')?.toString()?.trim(),
    country: formData.get('country')?.toString()?.trim(),
    check_in_time: formData.get('check_in_time')?.toString(),
    check_out_time: formData.get('check_out_time')?.toString(),
    owner_name: formData.get('owner_name')?.toString()?.trim(),
    owner_oib: formData.get('owner_oib')?.toString()?.trim(),
    owner_address: formData.get('owner_address')?.toString()?.trim(),
    owner_postal_code: formData.get('owner_postal_code')?.toString()?.trim(),
    owner_city: formData.get('owner_city')?.toString()?.trim(),
    owner_country: formData.get('owner_country')?.toString()?.trim(),
    created_by: user.id,
  };

  if (!data.name || !data.address || !data.owner_name || !data.owner_oib) {
    return redirect('/apartmani?error=Sva+obavezna+polja+moraju+biti+ispunjena.');
  }

  const { data: apartment, error } = await supabase
    .from('apartments')
    .insert(data)
    .select()
    .single();

  if (error || !apartment) {
    return redirect('/apartmani?error=Greška+pri+kreiranju+apartmana.');
  }

  // Koristimo admin klijent jer user RLS nema INSERT politiku za apartment_users
  const adminSupabase = createSupabaseAdminClient();

  await adminSupabase.from('apartment_users').insert({
    apartment_id: apartment.id,
    user_id: user.id,
    role: 'admin',
    added_by: user.id,
  });

  await adminSupabase.from('apartment_invoice_settings').insert({
    apartment_id: apartment.id,
  });

  return redirect('/apartmani?success=created');
};
