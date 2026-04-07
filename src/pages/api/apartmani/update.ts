import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const formData = await request.formData();
  const id = formData.get('id')?.toString();
  if (!id) return redirect('/apartmani?error=ID+apartmana+nedostaje.');

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
  };

  const { error } = await supabase
    .from('apartments')
    .update(data)
    .eq('id', id);

  if (error) return redirect('/apartmani?error=' + encodeURIComponent('Greška pri ažuriranju.'));

  return redirect('/apartmani?success=updated');
};
