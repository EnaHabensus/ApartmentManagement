-- Migracija 012: Dodaj apartment_ids na templates tablicu
ALTER TABLE public.templates ADD COLUMN apartment_ids UUID[] NOT NULL DEFAULT '{}';
