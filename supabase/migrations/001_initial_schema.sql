-- ============================================================
-- ApartMan — Inicijalna shema baze podataka
-- Verzija: 1.0 | Travanj 2026
-- ============================================================

-- Omogući uuid-ossp ekstenziju
create extension if not exists "uuid-ossp";

-- ─── ENUMI ───────────────────────────────────────────────────────────────────

create type role_type as enum ('admin', 'staff');
create type reservation_status as enum ('active', 'cancelled');
create type payment_type as enum ('credit_card', 'cash', 'bank_transfer', 'airbnb', 'booking_com');
create type task_source as enum ('manual', 'cleaning_auto');
create type invoice_generate_on as enum ('check_in', 'check_out');

-- ─── PROFILES ────────────────────────────────────────────────────────────────
-- Extends auth.users — kreira se automatski triggerom

create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  full_name      text not null,
  email          text not null,
  has_logged_in  boolean default false not null,
  invited_at     timestamptz,
  created_at     timestamptz default now() not null,
  updated_at     timestamptz default now() not null
);

-- RLS
alter table public.profiles enable row level security;

create policy "Korisnici mogu vidjeti vlastiti profil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Korisnici mogu urediti vlastiti profil"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger: auto-kreiraj profil pri registraciji
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Korisnik'),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Trigger: auto-ažuriraj updated_at
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.update_updated_at();

-- ─── APARTMENTS ──────────────────────────────────────────────────────────────

create table public.apartments (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null,
  address             text not null,
  postal_code         text not null,
  city                text not null,
  country             text not null default 'Hrvatska',
  check_in_time       time not null default '14:00',
  check_out_time      time not null default '10:00',
  owner_name          text not null,
  owner_oib           text not null check (length(owner_oib) = 11),
  owner_address       text not null,
  owner_postal_code   text not null,
  owner_city          text not null,
  owner_country       text not null default 'Hrvatska',
  is_deleted          boolean default false not null,
  created_by          uuid references public.profiles(id),
  created_at          timestamptz default now() not null,
  updated_at          timestamptz default now() not null
);

alter table public.apartments enable row level security;

create trigger apartments_updated_at
  before update on public.apartments
  for each row execute procedure public.update_updated_at();

-- ─── APARTMENT_USERS ─────────────────────────────────────────────────────────

create table public.apartment_users (
  id            uuid primary key default uuid_generate_v4(),
  apartment_id  uuid not null references public.apartments(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  role          role_type not null,
  added_at      timestamptz default now() not null,
  added_by      uuid references public.profiles(id),
  unique (apartment_id, user_id)
);

alter table public.apartment_users enable row level security;

-- RLS: korisnik vidi apartmane na kojima je dodijeljen
create policy "Korisnici vide svoje apartmane"
  on public.apartment_users for select
  using (auth.uid() = user_id);

-- RLS: admin može vidjeti sve korisnike na svom apartmanu
create policy "Admin vidi korisnike svojih apartmana"
  on public.apartment_users for select
  using (
    exists (
      select 1 from public.apartment_users au2
      where au2.apartment_id = apartment_users.apartment_id
        and au2.user_id = auth.uid()
        and au2.role = 'admin'
    )
  );

-- RLS: apartments — korisnik vidi apartmane na kojima je dodijeljen
create policy "Korisnici vide dodijeljene apartmane"
  on public.apartments for select
  using (
    exists (
      select 1 from public.apartment_users
      where apartment_id = apartments.id
        and user_id = auth.uid()
    )
  );

create policy "Admin može kreirati apartman"
  on public.apartments for insert
  with check (auth.uid() = created_by);

create policy "Admin može urediti apartman"
  on public.apartments for update
  using (
    exists (
      select 1 from public.apartment_users
      where apartment_id = apartments.id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );

-- ─── INVITE_TOKENS ───────────────────────────────────────────────────────────

create table public.invite_tokens (
  id            uuid primary key default uuid_generate_v4(),
  email         text not null,
  apartment_ids uuid[] not null,
  role          role_type not null default 'staff',
  invited_by    uuid not null references public.profiles(id),
  expires_at    timestamptz not null default (now() + interval '7 days'),
  accepted_at   timestamptz,
  created_at    timestamptz default now() not null
);

alter table public.invite_tokens enable row level security;

-- Svi mogu čitati token ako znaju ID (koristi se za provjeru pri prihvaćanju)
create policy "Provjera invite tokena"
  on public.invite_tokens for select
  using (true);

-- ─── RESERVATIONS ────────────────────────────────────────────────────────────

create table public.reservations (
  id                  uuid primary key default uuid_generate_v4(),
  apartment_id        uuid not null references public.apartments(id),
  guest_name          text not null,
  check_in            date not null,
  check_out           date not null check (check_out > check_in),
  num_guests          integer default 1 check (num_guests >= 1),
  guest_phone         text,
  payment_type        payment_type,
  documents_received  boolean default false not null,
  guests_registered   boolean default false not null,
  amount_gross        decimal(10,2),
  commission          decimal(10,2),
  is_paid             boolean default false not null,
  status              reservation_status default 'active' not null,
  created_by          uuid references public.profiles(id),
  created_at          timestamptz default now() not null,
  updated_at          timestamptz default now() not null
);

alter table public.reservations enable row level security;

create trigger reservations_updated_at
  before update on public.reservations
  for each row execute procedure public.update_updated_at();

-- RLS: admin vidi rezervacije svojih apartmana
create policy "Admin vidi rezervacije"
  on public.reservations for select
  using (
    exists (
      select 1 from public.apartment_users
      where apartment_id = reservations.apartment_id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );

create policy "Admin može kreirati rezervacije"
  on public.reservations for insert
  with check (
    exists (
      select 1 from public.apartment_users
      where apartment_id = reservations.apartment_id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );

create policy "Admin može urediti rezervacije"
  on public.reservations for update
  using (
    exists (
      select 1 from public.apartment_users
      where apartment_id = reservations.apartment_id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );

create policy "Admin može obrisati rezervacije"
  on public.reservations for delete
  using (
    exists (
      select 1 from public.apartment_users
      where apartment_id = reservations.apartment_id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );

-- ─── RESERVATION_CLEANING ────────────────────────────────────────────────────

create table public.reservation_cleaning (
  id                        uuid primary key default uuid_generate_v4(),
  reservation_id            uuid not null references public.reservations(id) on delete cascade,
  user_id                   uuid not null references public.profiles(id),
  notified_immediately_at   timestamptz,
  notified_reminder_at      timestamptz,
  created_at                timestamptz default now() not null
);

alter table public.reservation_cleaning enable row level security;

create policy "Admin vidi čišćenja svojih apartmana"
  on public.reservation_cleaning for select
  using (
    exists (
      select 1 from public.reservations r
      join public.apartment_users au on au.apartment_id = r.apartment_id
      where r.id = reservation_cleaning.reservation_id
        and au.user_id = auth.uid()
        and au.role = 'admin'
    )
  );

create policy "Staff vidi čišćenja za sebe"
  on public.reservation_cleaning for select
  using (user_id = auth.uid());

create policy "Admin može upravljati čišćenjima"
  on public.reservation_cleaning for all
  using (
    exists (
      select 1 from public.reservations r
      join public.apartment_users au on au.apartment_id = r.apartment_id
      where r.id = reservation_cleaning.reservation_id
        and au.user_id = auth.uid()
        and au.role = 'admin'
    )
  );

-- ─── TASKS ───────────────────────────────────────────────────────────────────

create table public.tasks (
  id              uuid primary key default uuid_generate_v4(),
  apartment_id    uuid not null references public.apartments(id),
  title           text not null,
  due_date        date not null,
  due_time        time,
  is_completed    boolean default false not null,
  completed_at    timestamptz,
  completed_by    uuid references public.profiles(id),
  source          task_source default 'manual' not null,
  reservation_id  uuid references public.reservations(id) on delete set null,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);

alter table public.tasks enable row level security;

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute procedure public.update_updated_at();

create policy "Admin vidi sve zadatke svojih apartmana"
  on public.tasks for select
  using (
    exists (
      select 1 from public.apartment_users
      where apartment_id = tasks.apartment_id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );

create policy "Admin može kreirati zadatke"
  on public.tasks for insert
  with check (
    exists (
      select 1 from public.apartment_users
      where apartment_id = tasks.apartment_id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );

create policy "Admin može urediti zadatke"
  on public.tasks for update
  using (
    exists (
      select 1 from public.apartment_users
      where apartment_id = tasks.apartment_id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );


create policy "Admin može obrisati zadatke"
  on public.tasks for delete
  using (
    exists (
      select 1 from public.apartment_users
      where apartment_id = tasks.apartment_id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );

-- ─── TASK_ASSIGNEES ──────────────────────────────────────────────────────────

create table public.task_assignees (
  task_id      uuid not null references public.tasks(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  assigned_at  timestamptz default now() not null,
  primary key (task_id, user_id)
);

alter table public.task_assignees enable row level security;

create policy "Svi vide dodjele zadataka"
  on public.task_assignees for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.tasks t
      join public.apartment_users au on au.apartment_id = t.apartment_id
      where t.id = task_assignees.task_id
        and au.user_id = auth.uid()
        and au.role = 'admin'
    )
  );

-- Politike za tasks koje ovise o task_assignees (moraju biti nakon kreiranja task_assignees)
create policy "Staff vidi zadatke koji su im dodijeljeni"
  on public.tasks for select
  using (
    exists (
      select 1 from public.task_assignees
      where task_id = tasks.id
        and user_id = auth.uid()
    )
  );

create policy "Staff može označiti završeno"
  on public.tasks for update
  using (
    exists (
      select 1 from public.task_assignees
      where task_id = tasks.id
        and user_id = auth.uid()
    )
  );

create policy "Admin može upravljati dodjelama"
  on public.task_assignees for all
  using (
    exists (
      select 1 from public.tasks t
      join public.apartment_users au on au.apartment_id = t.apartment_id
      where t.id = task_assignees.task_id
        and au.user_id = auth.uid()
        and au.role = 'admin'
    )
  );

-- ─── INVOICES ────────────────────────────────────────────────────────────────

create table public.invoices (
  id                     uuid primary key default uuid_generate_v4(),
  reservation_id         uuid not null references public.reservations(id),
  apartment_id           uuid not null references public.apartments(id),
  invoice_number         integer not null,
  invoice_number_display text not null,
  generated_at           timestamptz default now() not null,
  generated_by           uuid references public.profiles(id),
  pdf_url                text,
  created_at             timestamptz default now() not null
);

alter table public.invoices enable row level security;

create policy "Admin vidi račune svojih apartmana"
  on public.invoices for select
  using (
    exists (
      select 1 from public.apartment_users
      where apartment_id = invoices.apartment_id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );

create policy "Admin može kreirati račune"
  on public.invoices for insert
  with check (
    exists (
      select 1 from public.apartment_users
      where apartment_id = invoices.apartment_id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );

-- ─── APARTMENT_INVOICE_SETTINGS ──────────────────────────────────────────────

create table public.apartment_invoice_settings (
  id                   uuid primary key default uuid_generate_v4(),
  apartment_id         uuid not null unique references public.apartments(id) on delete cascade,
  auto_generate        boolean default false not null,
  generate_on          invoice_generate_on default 'check_out' not null,
  starting_number      integer default 1 not null,
  last_invoice_number  integer default 0 not null,
  created_at           timestamptz default now() not null,
  updated_at           timestamptz default now() not null
);

alter table public.apartment_invoice_settings enable row level security;

create trigger invoice_settings_updated_at
  before update on public.apartment_invoice_settings
  for each row execute procedure public.update_updated_at();

create policy "Admin vidi i uređuje postavke računa"
  on public.apartment_invoice_settings for all
  using (
    exists (
      select 1 from public.apartment_users
      where apartment_id = apartment_invoice_settings.apartment_id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );

-- ─── STORAGE BUCKET za PDF-ove ───────────────────────────────────────────────
-- Pokrenuti ručno u Supabase dashboardu → Storage → New bucket
-- Naziv: invoices | Private: true
