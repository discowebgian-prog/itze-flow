-- Decisiones sobre posibles huéspedes duplicados.
-- Cada fila dice si dos "huéspedes" (por documento o por nombre) son la misma persona o no.
-- Las reservas no se tocan: la app junta o separa al mostrar.

create table if not exists public.huespedes_decisiones (
  id uuid primary key default gen_random_uuid(),
  clave_a text not null,
  clave_b text not null,
  decision text not null check (decision in ('misma', 'distinta')),
  decidido_por text,
  creado_en timestamptz not null default now(),
  unique (clave_a, clave_b)
);

-- Seguridad: solo usuarios con sesión iniciada (igual que reservas y gastos)
alter table public.huespedes_decisiones enable row level security;

create policy "Con sesión pueden ver decisiones"
  on public.huespedes_decisiones for select to authenticated using (true);

create policy "Con sesión pueden crear decisiones"
  on public.huespedes_decisiones for insert to authenticated with check (true);

create policy "Con sesión pueden cambiar decisiones"
  on public.huespedes_decisiones for update to authenticated using (true) with check (true);

create policy "Con sesión pueden deshacer decisiones"
  on public.huespedes_decisiones for delete to authenticated using (true);

-- Para que los cambios se vean al instante en todos los dispositivos
alter publication supabase_realtime add table public.huespedes_decisiones;
