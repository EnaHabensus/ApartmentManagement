-- Dodaj color kolonu na apartments tablicu
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#3B82F6';
