-- Tarifario de Itzé Hostel Boutique.
-- Cada fila es un período de tarifas:
--   * "Normal": sin fechas (desde y hasta vacíos). Hay una sola y rige siempre que no haya otro período.
--   * Promos y fechas especiales: con fechas (desde y hasta incluidas, son noches). Reemplazan a la Normal;
--     si dos se pisan, manda el más corto.
-- precios: por tipo de habitación, precio por noche para 2 personas de lunes a miércoles (entre),
-- de jueves a domingo (finde) y costo por persona adicional por noche (extra).
--   { "privada": { "entre": 990, "finde": 1100, "extra": 200 }, "king": {...}, "matrimonial": {...} }

create table if not exists public.tarifas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  desde date,
  hasta date,
  precios jsonb not null default '{}'::jsonb,
  creado_por text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint tarifas_fechas check (
    (desde is null and hasta is null) or (desde is not null and hasta is not null and desde <= hasta)
  )
);

-- Una sola tarifa Normal (la que no tiene fechas)
create unique index if not exists tarifas_una_normal on public.tarifas ((true)) where desde is null;

-- Seguridad: solo usuarios con sesión iniciada (igual que reservas, gastos y decisiones).
-- Que solo admin edite lo controla la app.
alter table public.tarifas enable row level security;

create policy "Con sesión pueden ver tarifas"
  on public.tarifas for select to authenticated using (true);

create policy "Con sesión pueden crear tarifas"
  on public.tarifas for insert to authenticated with check (true);

create policy "Con sesión pueden cambiar tarifas"
  on public.tarifas for update to authenticated using (true) with check (true);

create policy "Con sesión pueden borrar tarifas"
  on public.tarifas for delete to authenticated using (true);

-- Para que los cambios se vean al instante en todos los dispositivos
alter publication supabase_realtime add table public.tarifas;

-- Tarifas iniciales (valores de Gian, 6 nov 2026)
insert into public.tarifas (nombre, desde, hasta, precios)
values (
  'Normal', null, null,
  '{"privada": {"entre": 1290, "finde": 1290, "extra": 200},
    "king": {"entre": 1100, "finde": 1100, "extra": 200},
    "matrimonial": {"entre": 990, "finde": 990, "extra": 0}}'::jsonb
)
on conflict do nothing;

insert into public.tarifas (nombre, desde, hasta, precios)
select
  'Promo noviembre', '2026-11-01', '2026-11-30',
  '{"privada": {"entre": 990, "finde": 1100, "extra": 200},
    "king": {"entre": 890, "finde": 990, "extra": 200},
    "matrimonial": {"entre": 790, "finde": 790, "extra": 0}}'::jsonb
where not exists (select 1 from public.tarifas where nombre = 'Promo noviembre');
