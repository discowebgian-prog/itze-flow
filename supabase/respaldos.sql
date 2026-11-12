-- Respaldo automático de Flow (planilla Excel todas las noches).
-- Correr en Supabase → SQL Editor DESPUÉS de publicar la app (la base llama a /api/respaldo).
-- Volver atrás: respaldos_volver_atras.sql · Comprobar: respaldos_comprobar.sql

-- 1) Dónde quedan las planillas (el archivo va en base64; ~100–400 KB cada una)
create table if not exists public.flow_respaldos (
  id          uuid primary key default gen_random_uuid(),
  creado_en   timestamptz not null default now(),
  nombre      text not null,
  origen      text not null default 'auto' check (origen in ('auto', 'manual')),
  hecho_por   text,
  tamano      integer,
  resumen     jsonb,
  archivo_b64 text not null
);
create index if not exists flow_respaldos_creado_idx on public.flow_respaldos (creado_en desc);

alter table public.flow_respaldos enable row level security;
drop policy if exists "respaldos solo duenos ver" on public.flow_respaldos;
create policy "respaldos solo duenos ver" on public.flow_respaldos
  for select to authenticated using (public.es_dueno());
-- Nadie escribe ni borra desde la app: solo la función de abajo.

-- 2) ¿Puede pedir un respaldo? Supabase con la clave, o un dueño con su sesión
create or replace function public.respaldo_permitido(p_clave text) returns boolean
language sql security definer set search_path = public stable as $$
  select (p_clave is not null and p_clave = (select clave from public.flow_secreto where id = 1))
      or coalesce(public.es_dueno(), false)
$$;
revoke all on function public.respaldo_permitido(text) from public;
grant execute on function public.respaldo_permitido(text) to anon, authenticated;

-- 3) Todo lo que va en la planilla. Las tablas que no existan se devuelven vacías.
create or replace function public.flow_respaldo_datos(p_clave text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_res jsonb := '[]'; v_gas jsonb := '[]'; v_tar jsonb := '[]'; v_mov jsonb := '[]';
begin
  if not public.respaldo_permitido(p_clave) then return null; end if;
  select coalesce(jsonb_agg(to_jsonb(r)), '[]') into v_res from public.reservas r;
  begin select coalesce(jsonb_agg(to_jsonb(g)), '[]') into v_gas from public.gastos g; exception when undefined_table then null; end;
  begin select coalesce(jsonb_agg(to_jsonb(t)), '[]') into v_tar from public.tarifas t; exception when undefined_table then null; end;
  begin select coalesce(jsonb_agg(to_jsonb(m)), '[]') into v_mov from public.equipo_movimientos m; exception when undefined_table then null; end;
  return jsonb_build_object('reservas', v_res, 'gastos', v_gas, 'tarifas', v_tar, 'movimientos', v_mov,
                            'hora', now());
end $$;
revoke all on function public.flow_respaldo_datos(text) from public;
grant execute on function public.flow_respaldo_datos(text) to anon, authenticated;

-- 4) Guardar la planilla y dejar solo: las últimas 30 + la primera de cada mes del último año
create or replace function public.flow_respaldo_guardar(
  p_clave text, p_nombre text, p_b64 text, p_resumen jsonb, p_origen text default 'auto', p_hecho_por text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.respaldo_permitido(p_clave) then return null; end if;
  insert into public.flow_respaldos (nombre, origen, hecho_por, tamano, resumen, archivo_b64)
  values (p_nombre, coalesce(p_origen, 'auto'), p_hecho_por, (length(p_b64) * 3) / 4, p_resumen, p_b64)
  returning id into v_id;

  delete from public.flow_respaldos f
  where f.id not in (select id from public.flow_respaldos order by creado_en desc limit 30)
    and f.id not in (
      select distinct on (date_trunc('month', creado_en at time zone 'America/Merida')) id
      from public.flow_respaldos
      where creado_en > now() - interval '12 months'
      order by date_trunc('month', creado_en at time zone 'America/Merida'), creado_en
    );
  return v_id;
end $$;
revoke all on function public.flow_respaldo_guardar(text, text, text, jsonb, text, text) from public;
grant execute on function public.flow_respaldo_guardar(text, text, text, jsonb, text, text) to anon, authenticated;

-- 5) Todas las noches a las 3:00 de Progreso (9:00 UTC)
create or replace function public.flow_respaldo_ahora()
returns bigint language sql security definer set search_path = public, extensions as $$
  select net.http_post(
    url := public.flow_url() || '/api/respaldo',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-flow-clave', (select clave from public.flow_secreto where id = 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$$;
revoke all on function public.flow_respaldo_ahora() from public, anon, authenticated;

select cron.unschedule('flow-respaldo') where exists (select 1 from cron.job where jobname = 'flow-respaldo');
select cron.schedule('flow-respaldo', '0 9 * * *', 'select public.flow_respaldo_ahora();');

notify pgrst, 'reload schema';
