-- Gastos fijos (Finanzas › Egresos): se cargan una vez y Flow los suma solo en cada mes.
-- Correr en Supabase → SQL Editor ANTES de probar la Preview. Se puede correr más de una vez.
-- Volver atrás: gastos_fijos_volver_atras.sql · Comprobar: gastos_fijos_comprobar.sql
--
-- Cómo funciona: cada gasto fijo genera una fila en `gastos` por mes (marcada con fijo_id y mes 'AAAA-MM').
-- Así Finanzas, el Asesor IA, el Excel y el respaldo siguen leyendo `gastos` como siempre.
-- Si un mes fue distinto se edita esa fila; si no hubo, queda en $0 (no se vuelve a crear).

-- 1) La lista de gastos fijos
create table if not exists public.gastos_fijos (
  id          uuid primary key default gen_random_uuid(),
  concepto    text not null,
  categoria   text not null default 'Otro',
  monto       numeric not null check (monto >= 0),
  cada_meses  smallint not null default 1 check (cada_meses in (1, 2, 3, 6, 12)),
  desde       date not null,           -- primer día del primer mes
  hasta       date,                    -- primer día del último mes (vacío = sigue)
  creado_en   timestamptz not null default now(),
  creado_por  text
);

alter table public.gastos_fijos enable row level security;
drop policy if exists "gastos_fijos: solo dueños" on public.gastos_fijos;
create policy "gastos_fijos: solo dueños" on public.gastos_fijos
  for all to authenticated using (public.es_dueno()) with check (public.es_dueno());

-- 2) Las filas de cada mes en `gastos`
alter table public.gastos add column if not exists fijo_id uuid references public.gastos_fijos(id) on delete set null;
alter table public.gastos add column if not exists mes text;
create unique index if not exists gastos_fijo_mes_uk on public.gastos (fijo_id, mes) where fijo_id is not null;

-- 3) Crear las filas que falten, hasta el mes actual de Progreso (no toca las que ya existen)
create or replace function public._gastos_fijos_generar()
returns integer language plpgsql security definer set search_path = public as $$
declare
  f record;
  m date;
  hoy_mes date := date_trunc('month', (now() at time zone 'America/Merida'))::date;
  n integer := 0;
  k integer;
begin
  for f in select * from public.gastos_fijos loop
    m := date_trunc('month', f.desde)::date;
    while m <= least(hoy_mes, coalesce(date_trunc('month', f.hasta)::date, hoy_mes)) loop
      insert into public.gastos (fecha, monto, categoria, notas, fijo_id, mes)
      values (m, f.monto, f.categoria, f.concepto, f.id, to_char(m, 'YYYY-MM'))
      on conflict (fijo_id, mes) where fijo_id is not null do nothing;
      get diagnostics k = row_count;
      n := n + k;
      m := (m + make_interval(months => f.cada_meses))::date;
    end loop;
  end loop;
  return n;
end $$;
revoke all on function public._gastos_fijos_generar() from public, anon, authenticated;

-- La llama la app al abrir Finanzas (solo dueños)
create or replace function public.gastos_fijos_generar()
returns integer language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.es_dueno(), false) then return 0; end if;
  return public._gastos_fijos_generar();
end $$;
revoke all on function public.gastos_fijos_generar() from public, anon;
grant execute on function public.gastos_fijos_generar() to authenticated;

-- 4) Y además solo, el día 1 de cada mes a las 0:15 de Progreso (6:15 UTC), aunque nadie abra Flow
select cron.unschedule('gastos-fijos') where exists (select 1 from cron.job where jobname = 'gastos-fijos');
select cron.schedule('gastos-fijos', '15 6 1 * *', 'select public._gastos_fijos_generar();');

-- 5) El respaldo de cada noche también guarda la lista de gastos fijos
create or replace function public.flow_respaldo_datos(p_clave text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_res jsonb := '[]'; v_gas jsonb := '[]'; v_tar jsonb := '[]'; v_mov jsonb := '[]'; v_fij jsonb := '[]';
begin
  if not public.respaldo_permitido(p_clave) then return null; end if;
  select coalesce(jsonb_agg(to_jsonb(r)), '[]') into v_res from public.reservas r;
  begin select coalesce(jsonb_agg(to_jsonb(g)), '[]') into v_gas from public.gastos g; exception when undefined_table then null; end;
  begin select coalesce(jsonb_agg(to_jsonb(t)), '[]') into v_tar from public.tarifas t; exception when undefined_table then null; end;
  begin select coalesce(jsonb_agg(to_jsonb(m)), '[]') into v_mov from public.equipo_movimientos m; exception when undefined_table then null; end;
  begin select coalesce(jsonb_agg(to_jsonb(x)), '[]') into v_fij from public.gastos_fijos x; exception when undefined_table then null; end;
  return jsonb_build_object('reservas', v_res, 'gastos', v_gas, 'tarifas', v_tar, 'movimientos', v_mov,
                            'gastos_fijos', v_fij, 'hora', now());
end $$;
revoke all on function public.flow_respaldo_datos(text) from public;
grant execute on function public.flow_respaldo_datos(text) to anon, authenticated;

notify pgrst, 'reload schema';
