-- ══════════════════════════════════════════════════════════════════════════════
-- MEJORAS DE NOVIEMBRE (un solo SQL para varios pasos; se puede correr más de una vez)
--   1) flow_vistos: qué vio cada persona (Gian / Marce) → circulitos de "Se viene" y "Estrategia"
--   2) reservas.checkout_original / extendida_noches → "Extendió estadía"
--   3) competencia: precios de otros lugares (Tarifas) → comparación y Asesor IA
--   4) eventos_fuentes + eventos_contexto(): links propios para el radar y lo que no les interesa
-- Necesita perfiles.sql (es_dueno) y eventos.sql (flow_secreto, eventos_permitido).
-- Comprobar: mejoras_nov_comprobar.sql · Volver atrás: mejoras_nov_volver_atras.sql
-- ══════════════════════════════════════════════════════════════════════════════

-- 1) Qué vio cada persona. `quien` = el nombre del aparato (Gian / Marce); `clave` = 'evento:<id>' o 'estrategia:<lunes>'
create table if not exists public.flow_vistos (
  quien text not null,
  clave text not null,
  visto_en timestamptz not null default now(),
  primary key (quien, clave)
);
alter table public.flow_vistos enable row level security;
drop policy if exists "flow_vistos: dueños" on public.flow_vistos;
create policy "flow_vistos: dueños" on public.flow_vistos
  for all to authenticated using (public.es_dueno()) with check (public.es_dueno());

-- 2) Extensión de estadía: se marca solo cuando a una reserva hospedada se le corre la salida más tarde
alter table public.reservas add column if not exists checkout_original date;
alter table public.reservas add column if not exists extendida_noches int not null default 0;

-- 3) Competencia (se carga a mano en Tarifas)
create table if not exists public.competencia (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  link text,
  tipo text,                 -- privada | king | matrimonial (con qué habitación nuestra se compara)
  habitacion text,           -- cómo la llaman ellos
  precio_entre numeric,      -- Lun–Mié
  precio_finde numeric,      -- Jue–Dom
  notas text,
  actualizado_en timestamptz not null default now(),
  creado_en timestamptz not null default now()
);
alter table public.competencia enable row level security;
drop policy if exists "competencia: dueños" on public.competencia;
create policy "competencia: dueños" on public.competencia
  for all to authenticated using (public.es_dueno()) with check (public.es_dueno());

-- 4) Fuentes propias del radar (links que conocen los dueños)
create table if not exists public.eventos_fuentes (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  nombre text,
  creado_en timestamptz not null default now()
);
alter table public.eventos_fuentes enable row level security;
drop policy if exists "eventos_fuentes: dueños" on public.eventos_fuentes;
create policy "eventos_fuentes: dueños" on public.eventos_fuentes
  for all to authenticated using (public.es_dueno()) with check (public.es_dueno());

-- Para el radar: fuentes propias y lo marcado "No nos interesa" (ejemplos de lo que no hay que traer)
create or replace function public.eventos_contexto(p_clave text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.eventos_permitido(p_clave) then return null; end if;
  return jsonb_build_object(
    'fuentes', coalesce((select jsonb_agg(jsonb_build_object('url', f.url, 'nombre', f.nombre)) from public.eventos_fuentes f), '[]'::jsonb),
    'descartados', coalesce((
      select jsonb_agg(x.nombre) from (
        select e.nombre from public.eventos e where e.estado = 'descartado' order by e.actualizado_en desc limit 30
      ) x
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.eventos_contexto(text) from public;
grant execute on function public.eventos_contexto(text) to anon, authenticated;

notify pgrst, 'reload schema';
