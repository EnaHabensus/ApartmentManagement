-- ============================================================
-- Migracija 008: Pomoćno osoblje (external_members)
-- ============================================================

-- ─── EXTERNAL_MEMBERS ─────────────────────────────────────────────────────────

create table public.external_members (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  email      text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null
);

alter table public.external_members enable row level security;

-- Service role (admin klijent) ima pun pristup
create policy "Admin klijent ima pun pristup external_members"
  on public.external_members for all
  using (true)
  with check (true);

-- ─── APARTMENT_EXTERNAL_MEMBERS ───────────────────────────────────────────────

create table public.apartment_external_members (
  id                 uuid primary key default uuid_generate_v4(),
  apartment_id       uuid not null references public.apartments(id) on delete cascade,
  external_member_id uuid not null references public.external_members(id) on delete cascade,
  created_at         timestamptz default now() not null,
  unique(apartment_id, external_member_id)
);

alter table public.apartment_external_members enable row level security;

create policy "Admin klijent ima pun pristup apartment_external_members"
  on public.apartment_external_members for all
  using (true)
  with check (true);

-- ─── IZMJENA TASK_ASSIGNEES ────────────────────────────────────────────────────
-- Dodajemo: id kao novi PK, external_member_id, completion_token, completed_at, reminder_sent_date
-- Mičemo: NOT NULL constraint s user_id (jer se može dodijeliti i external member)

-- Dropaj stari composite PK
alter table public.task_assignees drop constraint task_assignees_pkey;

-- Dodaj novi uuid PK stupac
alter table public.task_assignees add column id uuid default uuid_generate_v4();
alter table public.task_assignees add primary key (id);

-- Makni NOT NULL s user_id
alter table public.task_assignees alter column user_id drop not null;

-- Dodaj externe stupce
alter table public.task_assignees add column external_member_id uuid references public.external_members(id) on delete cascade;
alter table public.task_assignees add column completion_token uuid default uuid_generate_v4();
alter table public.task_assignees add column completed_at timestamptz;
alter table public.task_assignees add column reminder_sent_date date;

-- Unique index za completion_token
create unique index task_assignees_completion_token_idx on public.task_assignees(completion_token);

-- ─── IZMJENA RESERVATION_CLEANING ─────────────────────────────────────────────

alter table public.reservation_cleaning alter column user_id drop not null;
alter table public.reservation_cleaning add column external_member_id uuid references public.external_members(id) on delete cascade;
