-- ============================================================
-- Malex — schema ADMIN: unidades, lockers, ocupação, financeiro + RLS.
-- Rode no Supabase → SQL Editor → New query → Run. (Idempotente.)
-- ============================================================

create table if not exists public.units (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  code       text unique not null,
  name       text not null,
  state      text not null,
  city       text not null,
  address    text,
  kind       text default 'other'
);

create table if not exists public.lockers (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  unit_id     uuid not null references public.units(id) on delete cascade,
  label       text not null,
  size        text not null check (size in ('P','M','G')),
  status      text not null default 'free' check (status in ('free','occupied','maintenance')),
  current_reservation_id uuid,
  unique (unit_id, label)
);
create index if not exists lockers_unit_idx on public.lockers(unit_id);

alter table public.reservations add column if not exists unit_ref       uuid references public.units(id);
alter table public.reservations add column if not exists locker_id      uuid references public.lockers(id);
alter table public.reservations add column if not exists source         text default 'site';
alter table public.reservations add column if not exists closed_at      timestamptz;
alter table public.reservations add column if not exists payment_status text default 'pending';
alter table public.reservations add column if not exists paid_at        timestamptz;
alter table public.reservations add column if not exists gateway        text;
alter table public.reservations add column if not exists gateway_txid   text;

alter table public.units   enable row level security;
alter table public.lockers enable row level security;

drop policy if exists "units_read"  on public.units;
create policy "units_read"  on public.units for select to anon, authenticated using (true);
drop policy if exists "units_write" on public.units;
create policy "units_write" on public.units for all to authenticated using (true) with check (true);

drop policy if exists "lockers_read"  on public.lockers;
create policy "lockers_read"  on public.lockers for select to anon, authenticated using (true);
drop policy if exists "lockers_write" on public.lockers;
create policy "lockers_write" on public.lockers for all to authenticated using (true) with check (true);

drop policy if exists "res_admin_select" on public.reservations;
create policy "res_admin_select" on public.reservations for select to authenticated using (true);
drop policy if exists "res_admin_insert" on public.reservations;
create policy "res_admin_insert" on public.reservations for insert to authenticated with check (true);
drop policy if exists "res_admin_update" on public.reservations;
create policy "res_admin_update" on public.reservations for update to authenticated using (true) with check (true);
drop policy if exists "res_admin_delete" on public.reservations;
create policy "res_admin_delete" on public.reservations for delete to authenticated using (true);
