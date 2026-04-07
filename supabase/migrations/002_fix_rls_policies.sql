-- Fix 1: Dodaj INSERT/UPDATE/DELETE politike za apartment_users
create policy "Admin može dodavati korisnike na apartman"
  on public.apartment_users for insert
  with check (
    -- Dozvoli ako je korisnik admin na tom apartmanu ILI ako je to self-insert (kreiranje apartmana)
    auth.uid() = user_id
    or exists (
      select 1 from public.apartment_users au2
      where au2.apartment_id = apartment_users.apartment_id
        and au2.user_id = auth.uid()
        and au2.role = 'admin'
    )
  );

create policy "Admin može uklanjati korisnike s apartmana"
  on public.apartment_users for delete
  using (
    exists (
      select 1 from public.apartment_users au2
      where au2.apartment_id = apartment_users.apartment_id
        and au2.user_id = auth.uid()
        and au2.role = 'admin'
    )
  );

create policy "Admin može mijenjati uloge na apartmanu"
  on public.apartment_users for update
  using (
    exists (
      select 1 from public.apartment_users au2
      where au2.apartment_id = apartment_users.apartment_id
        and au2.user_id = auth.uid()
        and au2.role = 'admin'
    )
  );

-- Fix 2: Dodaj INSERT politiku za apartment_invoice_settings
create policy "Admin može kreirati postavke računa"
  on public.apartment_invoice_settings for insert
  with check (
    exists (
      select 1 from public.apartment_users
      where apartment_id = apartment_invoice_settings.apartment_id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );
