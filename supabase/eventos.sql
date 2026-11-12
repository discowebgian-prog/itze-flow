-- ══════════════════════════════════════════════════════════════════════════════
-- RADAR DE EVENTOS (Inicio › "Se viene")
-- Cada lunes a las 7:00 de Progreso, Supabase llama a /api/eventos: Claude busca en internet
-- eventos de Progreso, Mérida y la costa de Yucatán y los guarda acá. Los dueños los ven en Inicio
-- con tiempo para prepararse (precio, difusión, participación).
--
-- ORDEN: primero se publica la app (que tenga /api/eventos) y después se corre este SQL.
-- Necesita lo de buen_dia.sql (flow_secreto, pg_cron, pg_net) y perfiles.sql (es_dueno).
-- Comprobar: eventos_comprobar.sql · Volver atrás: eventos_volver_atras.sql
-- ══════════════════════════════════════════════════════════════════════════════

-- 1) Los eventos
create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,          -- nombre normalizado + fecha (para no repetir)
  nombre text not null,
  tipo text,                           -- feriado | temporada | festival | cultural | deportivo | concierto | congreso | crucero | religioso | otro
  fecha_desde date not null,
  fecha_hasta date,
  lugar text,
  impacto text,                        -- alto | medio | bajo
  publico text,                        -- quiénes vienen (familias, grupos de amigos, deportistas…)
  descripcion text,
  ideas jsonb not null default '[]',   -- acciones sugeridas
  fuente_url text,
  confianza text,                      -- confirmado | probable
  origen text not null default 'radar',-- radar | manual
  estado text not null default 'nuevo',-- nuevo | visto | descartado | tarifa
  encontrado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists eventos_fecha_idx on public.eventos (fecha_desde);

alter table public.eventos enable row level security;
drop policy if exists "eventos: dueños" on public.eventos;
create policy "eventos: dueños" on public.eventos
  for all to authenticated using (public.es_dueno()) with check (public.es_dueno());

-- 2) Cuándo se buscó (para mostrar "Última búsqueda")
create table if not exists public.eventos_busquedas (
  id bigserial primary key,
  hecho_en timestamptz not null default now(),
  nuevos int not null default 0,
  total int not null default 0,
  error text
);
alter table public.eventos_busquedas enable row level security;
drop policy if exists "eventos_busquedas: dueños leen" on public.eventos_busquedas;
create policy "eventos_busquedas: dueños leen" on public.eventos_busquedas
  for select to authenticated using (public.es_dueno());

-- ¿Puede usar el radar? Con la clave de flow_secreto (Supabase, los lunes) o un dueño con sesión ("Buscar ahora")
create or replace function public.eventos_permitido(p_clave text) returns boolean
language sql security definer set search_path = public stable as $$
  select (p_clave is not null and p_clave = (select clave from public.flow_secreto where id = 1))
      or coalesce(public.es_dueno(), false)
$$;
revoke all on function public.eventos_permitido(text) from public;
grant execute on function public.eventos_permitido(text) to anon, authenticated;

-- 3) Lo que ya se conoce (para que Claude no repita y use el mismo nombre)
create or replace function public.eventos_conocidos(p_clave text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.eventos_permitido(p_clave) then return null; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('nombre', e.nombre, 'fecha_desde', e.fecha_desde, 'fecha_hasta', e.fecha_hasta) order by e.fecha_desde)
    from public.eventos e
    where coalesce(e.fecha_hasta, e.fecha_desde) >= (now() at time zone 'America/Merida')::date
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.eventos_conocidos(text) from public;
grant execute on function public.eventos_conocidos(text) to anon, authenticated;

-- 4) Guardar lo que encontró Claude. Los nuevos se agregan; los que ya estaban se actualizan
--    (sin tocar el estado que eligieron los dueños). Devuelve los nuevos.
create or replace function public.eventos_guardar(p_clave text, p_eventos jsonb, p_error text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e jsonb;
  k text;
  ins boolean;
  nuevos jsonb := '[]'::jsonb;
  total int := 0;
begin
  if not public.eventos_permitido(p_clave) then return null; end if;
  for e in select * from jsonb_array_elements(coalesce(p_eventos, '[]'::jsonb)) loop
    if coalesce(e->>'nombre', '') = '' or coalesce(e->>'fecha_desde', '') !~ '^\d{4}-\d{2}-\d{2}$' then continue; end if;
    k := lower(regexp_replace(translate(e->>'nombre', 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'), '[^a-zA-Z0-9]', '', 'g')) || '|' || (e->>'fecha_desde');
    insert into public.eventos as ev (clave, nombre, tipo, fecha_desde, fecha_hasta, lugar, impacto, publico, descripcion, ideas, fuente_url, confianza)
    values (
      k, e->>'nombre', e->>'tipo', (e->>'fecha_desde')::date,
      case when coalesce(e->>'fecha_hasta', '') ~ '^\d{4}-\d{2}-\d{2}$' then (e->>'fecha_hasta')::date else null end,
      e->>'lugar', e->>'impacto', e->>'publico', e->>'descripcion',
      coalesce(e->'ideas', '[]'::jsonb), e->>'fuente_url', e->>'confianza'
    )
    on conflict (clave) do update set
      tipo = excluded.tipo, fecha_hasta = excluded.fecha_hasta, lugar = excluded.lugar,
      impacto = excluded.impacto, publico = excluded.publico, descripcion = excluded.descripcion,
      ideas = excluded.ideas, fuente_url = coalesce(excluded.fuente_url, ev.fuente_url),
      confianza = excluded.confianza, actualizado_en = now()
    returning (ev.xmax = 0) into ins;
    total := total + 1;
    if ins then nuevos := nuevos || jsonb_build_array(e); end if;
  end loop;
  insert into public.eventos_busquedas (nuevos, total, error) values (jsonb_array_length(nuevos), total, p_error);
  return nuevos;
end;
$$;
revoke all on function public.eventos_guardar(text, jsonb, text) from public;
grant execute on function public.eventos_guardar(text, jsonb, text) to anon, authenticated;

-- 5) Cada lunes 7:00 de Progreso (13:00 UTC): Supabase le pide a la app que busque
create or replace function public.flow_eventos_ahora()
returns bigint language sql security definer set search_path = public, extensions as $$
  select net.http_post(
    url := public.flow_url() || '/api/eventos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-flow-clave', (select clave from public.flow_secreto where id = 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
$$;
revoke all on function public.flow_eventos_ahora() from public, anon, authenticated;

select cron.unschedule('flow-eventos') where exists (select 1 from cron.job where jobname = 'flow-eventos');
select cron.schedule('flow-eventos', '7 13 * * 1', 'select public.flow_eventos_ahora();');

notify pgrst, 'reload schema';
