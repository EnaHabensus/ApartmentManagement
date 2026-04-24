-- ============================================================
-- Migracija 011: Predlošci poruka (Templates)
-- ============================================================

CREATE TABLE public.templates (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();

-- Svi autentificirani korisnici mogu vidjeti predloške
CREATE POLICY "Autentificirani korisnici vide predloške"
  ON public.templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Svi autentificirani korisnici mogu dodavati predloške
CREATE POLICY "Autentificirani korisnici mogu kreirati predloške"
  ON public.templates FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Samo kreator ili admin može urediti/obrisati (provjerava se u API ruti)
CREATE POLICY "Autentificirani korisnici mogu urediti predloške"
  ON public.templates FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Autentificirani korisnici mogu obrisati predloške"
  ON public.templates FOR DELETE
  USING (auth.uid() IS NOT NULL);
