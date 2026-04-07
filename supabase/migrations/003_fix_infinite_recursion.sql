-- Fix: Ukloni politiku koja uzrokuje infinite recursion na apartment_users
-- Ova politika se sama sebe poziva kroz RLS provjeru

drop policy if exists "Admin vidi korisnike svojih apartmana" on public.apartment_users;

-- Admin pregled korisnika na apartmanima se sada odrađuje kroz service role klijent u kodu
-- (createSupabaseAdminClient) što je i sigurnije
