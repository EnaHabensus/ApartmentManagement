-- ============================================================
-- Migracija 010: Omogući RLS na tablicama kojima nedostaje
-- ============================================================

-- ─── EXPENSE_CATEGORIES ──────────────────────────────────────────────────────

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

-- Svi autentificirani korisnici mogu čitati kategorije (lookup tablica)
CREATE POLICY "Autentificirani korisnici vide kategorije troškova"
  ON public.expense_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ─── EXPENSES ────────────────────────────────────────────────────────────────

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Admin vidi troškove svojih apartmana
CREATE POLICY "Admin vidi troškove svojih apartmana"
  ON public.expenses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.apartment_users
      WHERE apartment_id = expenses.apartment_id
        AND user_id = auth.uid()
        AND role = 'admin'
    )
  );

CREATE POLICY "Admin može kreirati troškove"
  ON public.expenses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.apartment_users
      WHERE apartment_id = expenses.apartment_id
        AND user_id = auth.uid()
        AND role = 'admin'
    )
  );

CREATE POLICY "Admin može urediti troškove"
  ON public.expenses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.apartment_users
      WHERE apartment_id = expenses.apartment_id
        AND user_id = auth.uid()
        AND role = 'admin'
    )
  );

CREATE POLICY "Admin može obrisati troškove"
  ON public.expenses FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.apartment_users
      WHERE apartment_id = expenses.apartment_id
        AND user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- ─── NOTIFICATIONS ───────────────────────────────────────────────────────────

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Korisnik vidi samo vlastite notifikacije
CREATE POLICY "Korisnik vidi vlastite notifikacije"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Korisnik može ažurirati vlastite notifikacije"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);
