-- Dodaj full_name u invite_tokens za prikaz u listi korisnika
alter table public.invite_tokens add column if not exists full_name text;
