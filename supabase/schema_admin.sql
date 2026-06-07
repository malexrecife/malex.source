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

-- ============================================================
-- PAPÉIS / PERMISSÕES (item 2.7)
-- admin nacional (vê tudo) x gestor de unidade (só a sua unit_code).
-- ============================================================
create table if not exists public.user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'unit_manager' check (role in ('admin','unit_manager')),
  unit_code  text references public.units(code),   -- null = admin nacional
  created_at timestamptz not null default now()
);

-- Helpers SECURITY DEFINER: consultam user_roles sem cair em recursão de RLS.
create or replace function public.is_admin() returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin');
$$;
create or replace function public.my_unit_code() returns text
  language sql security definer stable set search_path = public as $$
  select unit_code from public.user_roles where user_id = auth.uid();
$$;

alter table public.user_roles enable row level security;
drop policy if exists "roles_self_read" on public.user_roles;
create policy "roles_self_read" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "roles_admin_write" on public.user_roles;
create policy "roles_admin_write" on public.user_roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Seed do primeiro admin pelo e-mail (idempotente). Ajuste o e-mail se mudar de dono.
insert into public.user_roles (user_id, role, unit_code)
select id, 'admin', null from auth.users where email = 'lhcsiqueiraa@gmail.com'
on conflict (user_id) do update set role = 'admin', unit_code = null;

alter table public.units   enable row level security;
alter table public.lockers enable row level security;

-- units: leitura pública (vitrine do site); escrita só admin.
drop policy if exists "units_read"  on public.units;
create policy "units_read"  on public.units for select to anon, authenticated using (true);
drop policy if exists "units_write" on public.units;
create policy "units_write" on public.units for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- lockers: leitura pública; escrita admin OU gestor da unidade do locker.
drop policy if exists "lockers_read"  on public.lockers;
create policy "lockers_read"  on public.lockers for select to anon, authenticated using (true);
drop policy if exists "lockers_write" on public.lockers;
create policy "lockers_write" on public.lockers for all to authenticated
  using (public.is_admin() or unit_id in (select id from public.units where code = public.my_unit_code()))
  with check (public.is_admin() or unit_id in (select id from public.units where code = public.my_unit_code()));

-- reservations (lado autenticado/gestor): admin tudo; gestor só a sua unidade.
-- (As policies de anon — insert do site + leitura pública — ficam no schema.sql.)
drop policy if exists "res_admin_select" on public.reservations;
create policy "res_admin_select" on public.reservations for select to authenticated
  using (public.is_admin() or unit_code = public.my_unit_code());
drop policy if exists "res_admin_insert" on public.reservations;
create policy "res_admin_insert" on public.reservations for insert to authenticated
  with check (public.is_admin() or unit_code = public.my_unit_code());
drop policy if exists "res_admin_update" on public.reservations;
create policy "res_admin_update" on public.reservations for update to authenticated
  using (public.is_admin() or unit_code = public.my_unit_code())
  with check (public.is_admin() or unit_code = public.my_unit_code());
drop policy if exists "res_admin_delete" on public.reservations;
create policy "res_admin_delete" on public.reservations for delete to authenticated
  using (public.is_admin() or unit_code = public.my_unit_code());

-- ============================================================
-- Trilha de auditoria: registra ações do gestor (ocupar, liberar,
-- cancelar reserva, etc.). Imutável via RLS — nunca é deletada.
-- ============================================================
create table if not exists public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  action       text not null,
  entity       text,
  entity_id    text,
  unit_code    text,
  user_email   text,
  details      jsonb
);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_unit_idx    on public.audit_logs(unit_code);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_admin_insert" on public.audit_logs;
create policy "audit_admin_insert" on public.audit_logs for insert to authenticated with check (true);
drop policy if exists "audit_admin_select" on public.audit_logs;
create policy "audit_admin_select" on public.audit_logs for select to authenticated using (true);
-- Nenhuma policy de UPDATE/DELETE: logs são imutáveis.
