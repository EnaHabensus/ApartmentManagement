import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/login');
  }

  const formData = await request.formData();
  const userId = formData.get('user_id')?.toString();
  const apartmentId = formData.get('apartment_id')?.toString();

  if (!userId || !apartmentId) {
    return redirect('/korisnici?error=Nedostaju+obavezni+podaci');
  }

  // Provjeri je li prijavljeni korisnik admin na tom apartmanu
  const { data: adminCheck } = await supabase
    .from('apartment_users')
    .select('id')
    .eq('user_id', user.id)
    .eq('apartment_id', apartmentId)
    .eq('role', 'admin')
    .single();

  if (!adminCheck) {
    return redirect('/korisnici?error=Nemate+admin+prava+na+ovom+apartmanu');
  }

  // Ne dopusti brisanje sebe samog
  if (userId === user.id) {
    return redirect('/korisnici?error=Ne+možete+ukloniti+sebe+s+apartmana');
  }

  // Briši korisnika iz apartment_users (ne briše profil)
  const { error } = await supabase
    .from('apartment_users')
    .delete()
    .eq('user_id', userId)
    .eq('apartment_id', apartmentId);

  if (error) {
    return redirect(`/korisnici?error=${encodeURIComponent(error.message)}`);
  }

  return redirect('/korisnici?success=deleted');
};
