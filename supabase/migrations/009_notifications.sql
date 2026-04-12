-- Tablica za in-app notifikacije
CREATE TABLE public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_created_at_idx ON public.notifications(user_id, created_at DESC);
CREATE INDEX notifications_user_unread_idx ON public.notifications(user_id, is_read) WHERE is_read = false;
