import type { AstroCookies } from 'astro';
import { createSupabaseServerClient } from './supabase';
import type { Profile } from './types';

export async function getUser(
  request: Request,
  cookies: AstroCookies
): Promise<Profile | null> {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return profile;
}

// Vraća apartmane korisnika s ulogama
export async function getUserApartments(
  request: Request,
  cookies: AstroCookies
) {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('apartment_users')
    .select('role, apartments(*)')
    .eq('user_id', user.id)
    .eq('apartments.is_deleted', false);

  return data ?? [];
}

// Provjeri je li korisnik admin na apartmanu
export async function isAdminOnApartment(
  userId: string,
  apartmentId: string,
  request: Request,
  cookies: AstroCookies
): Promise<boolean> {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data } = await supabase
    .from('apartment_users')
    .select('role')
    .eq('user_id', userId)
    .eq('apartment_id', apartmentId)
    .single();

  return data?.role === 'admin';
}

// Provjeri ima li korisnik BILO KOJI admin apartman
export async function hasAnyAdminRole(
  userId: string,
  request: Request,
  cookies: AstroCookies
): Promise<boolean> {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data } = await supabase
    .from('apartment_users')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .limit(1);

  return (data?.length ?? 0) > 0;
}
