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

CREATE POLICY "Admin vidi predloške"
  ON public.templates FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.apartment_users WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin može kreirati predloške"
  ON public.templates FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admin može urediti predloške"
  ON public.templates FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.apartment_users WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin može obrisati predloške"
  ON public.templates FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.apartment_users WHERE user_id = auth.uid() AND role = 'admin')
  );
