-- ============================================================
-- Malex — tabela de reservas (Supabase / Postgres)
-- Rode isto no Supabase Dashboard → SQL Editor → New query → Run.
-- ============================================================

create table if not exists public.reservations (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),

  locker_code    text not null,

  -- unidade escolhida
  unit_id        text,
  unit_code      text,
  unit_name      text,
  unit_city      text,

  -- volume / tarifa
  size           text check (size in ('P','M','G')),
  size_name      text,
  check_in       timestamptz,
  check_out      timestamptz,
  price_total    integer,           -- em BRL (reais inteiros, como no app)
  price_mode     text,              -- 'até 4h' | '1 diária' | 'N diárias'

  -- cliente
  customer_name  text not null,
  customer_email text not null,
  customer_phone text,
  customer_cpf   text,

  -- pagamento — NUNCA guardamos dados de cartão; só o método e o status
  pay_method     text check (pay_method in ('pix','card')),
  status         text not null default 'reserved'
);

-- ============================================================
-- Row Level Security: site público, sem login.
-- Permitimos APENAS inserir (criar reserva) com a anon key.
-- Ninguém consegue ler/editar/apagar reservas pelo cliente público —
-- pra ler, use o painel do Supabase ou a service_role no backend.
-- ============================================================
alter table public.reservations enable row level security;

drop policy if exists "anon can insert reservations" on public.reservations;
create policy "anon can insert reservations"
  on public.reservations
  for insert
  to anon
  with check (true);

-- (Nenhuma policy de SELECT/UPDATE/DELETE = anon não lê nem altera nada.)
