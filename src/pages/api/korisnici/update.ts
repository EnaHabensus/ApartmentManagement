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
  const apartmentRolesRaw = formData.get('apartment_roles')?.toString();

  if (!userId || !apartmentRolesRaw) {
    return redirect('/korisnici?error=Nedostaju+obavezni+podaci');
  }

  let apartmentRoles: Array<{ apartment_id: string; role: string }>;
  try {
    apartmentRoles = JSON.parse(apartmentRolesRaw);
  } catch {
    return redirect('/korisnici?error=Neispravan+format+podataka');
  }

  if (!Array.isArray(apartmentRoles) || apartmentRoles.length === 0) {
    return redirect('/korisnici?error=' + encodeURIComponent('Nema apartmana za ažuriranje'));
  }

  // Provjeri je li prijavljeni korisnik admin na svim apartmanima koje pokušava urediti
  const apartmentIds = apartmentRoles.map((ar) => ar.apartment_id);
  const { data: adminCheck } = await supabase
    .from('apartment_users')
    .select('apartment_id')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .in('apartment_id', apartmentIds);

  if ((adminCheck?.length ?? 0) !== apartmentIds.length) {
    return redirect('/korisnici?error=Nemate+admin+prava+na+svim+apartmanima');
  }

  // Za svaki apartman: upsert u apartment_users
  for (const { apartment_id, role } of apartmentRoles) {
    // Provjeri postoji li već zapis
    const { data: existing } = await supabase
      .from('apartment_users')
      .select('id')
      .eq('apartment_id', apartment_id)
      .eq('user_id', userId)
      .single();

    if (existing) {
      // Update postojećeg zapisa
      const { error } = await supabase
        .from('apartment_users')
        .update({ role })
        .eq('apartment_id', apartment_id)
        .eq('user_id', userId);

      if (error) {
        return redirect(`/korisnici?error=${encodeURIComponent('Greška pri ažuriranju: ' + error.message)}`);
      }
    } else {
      // Insert novog zapisa
      const { error } = await supabase
        .from('apartment_users')
        .insert({
          apartment_id,
          user_id: userId,
          role,
          added_by: user.id,
        });

      if (error) {
        return redirect(`/korisnici?error=${encodeURIComponent('Greška pri dodavanju: ' + error.message)}`);
      }
    }
  }

  return redirect('/korisnici?success=updated');
};
