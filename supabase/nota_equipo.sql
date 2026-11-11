-- Itzé Flow · "Nota para el equipo" en cada reserva (11 nov 2026).
-- Pegalo en Supabase › SQL Editor (consulta vacía) › Run. Se puede correr más de una vez.
-- Antes de probar la Preview y antes del merge (sin la columna, guardar una reserva falla).
--
-- La escriben los dueños (formulario y panel) y Mary (panel, en cualquier reserva).
-- Mary la ve en "Habitaciones de hoy" y en el panel. Las notas internas siguen siendo solo de dueños.
-- Si la escribe Mary, queda en "Movimientos de Mary" como "Mary dejó una nota" y avisa a los dueños.

-- 1) La columna
alter table public.reservas add column if not exists nota_equipo text;

-- 2) Habitaciones del día (Mary): suma la nota. Cambia lo que devuelve, por eso se borra y se vuelve a crear.
drop function if exists public.equipo_reservas(date, date);
create function public.equipo_reservas(p_desde date, p_hasta date)
returns table (
  id text, propiedad text, habitacion text, huesped text,
  fecha_ingreso date, fecha_salida date, estado text, late_checkout_hora text, grupo_id text, nota_equipo text
)
language sql stable security definer set search_path = public as $$
  with r as (select to_jsonb(x) as j from public.reservas x)
  select j->>'id', coalesce(nullif(j->>'propiedad', ''), 'hostel'), j->>'habitacion', j->>'huesped',
         left(j->>'fecha_ingreso', 10)::date, left(j->>'fecha_salida', 10)::date,
         j->>'estado', nullif(j->>'late_checkout_hora', ''), j->>'grupo_id', nullif(j->>'nota_equipo', '')
  from r
  where public.tiene_permiso('limpieza')
    and coalesce(j->>'estado', '') not in ('cancelada', 'eliminada')
    and nullif(j->>'fecha_ingreso', '') is not null
    and nullif(j->>'fecha_salida', '') is not null
    and left(j->>'fecha_ingreso', 10)::date <= p_hasta
    and left(j->>'fecha_salida', 10)::date >= p_desde
    and p_hasta - p_desde <= 31;
$$;
revoke all on function public.equipo_reservas(date, date) from public, anon;
grant execute on function public.equipo_reservas(date, date) to authenticated;

-- 3) Mary puede escribir la nota también en reservas ajenas (además del contacto y el documento)
create or replace function public.equipo_contacto(p_id text, p_datos jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare k text; sets text := '';
  permitidos text[] := array['huesped', 'telefono', 'email', 'nacionalidad', 'tipo_doc', 'num_doc',
                             'url_ine_frente', 'url_ine_dorso', 'fecha_nacimiento', 'acompanantes', 'nota_equipo'];
begin
  if not (public.tiene_permiso('checkin') or public.tiene_permiso('reservar')) then raise exception 'Sin permiso.'; end if;
  perform 1 from public.reservas r where r.id::text = p_id;
  if not found then raise exception 'No se encontró la reserva.'; end if;
  for k in select jsonb_object_keys(p_datos) loop
    if k = any(permitidos) and exists (select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'reservas' and column_name = k) then
      sets := sets || case when sets = '' then '' else ', ' end || format('%I = %L', k,
                case when jsonb_typeof(p_datos->k) in ('object', 'array') then (p_datos->k)::text else p_datos->>k end);
    end if;
  end loop;
  if sets = '' then return; end if;
  execute format('update public.reservas set %s where id::text = %L', sets, p_id);
end $$;
revoke all on function public.equipo_contacto(text, jsonb) from public, anon;
grant execute on function public.equipo_contacto(text, jsonb) to authenticated;

-- 4) Movimientos: tipo "nota" (cuando Mary solo cambió la nota para el equipo) y el texto de la nota
alter table public.equipo_movimientos add column if not exists nota text;
alter table public.equipo_movimientos drop constraint if exists equipo_movimientos_tipo_check;
alter table public.equipo_movimientos add constraint equipo_movimientos_tipo_check
  check (tipo in ('nueva', 'edicion', 'cancelacion', 'checkin', 'checkout', 'cobro', 'nota'));

create or replace function public.reservas_equipo_movimiento() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  n jsonb := to_jsonb(new);
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  t text;
  pag_n numeric := coalesce(nullif(n->>'monto_pagado', '')::numeric, 0);
  pag_o numeric := coalesce(nullif(o->>'monto_pagado', '')::numeric, 0);
  monto numeric := null;
  sin_firma text[] := array['modificado_por', 'actualizado_en'];
begin
  if auth.uid() is null or public.es_dueno() then return null; end if;
  if tg_op = 'INSERT' then t := 'nueva'; monto := nullif(n->>'monto', '')::numeric;
  elsif (n->>'estado') is distinct from (o->>'estado') and n->>'estado' = 'hospedado' then t := 'checkin';
  elsif (n->>'estado') is distinct from (o->>'estado') and n->>'estado' = 'finalizada' then t := 'checkout';
  elsif (n->>'estado') is distinct from (o->>'estado') and n->>'estado' in ('cancelada', 'eliminada') then t := 'cancelacion';
  elsif pag_n > pag_o then t := 'cobro'; monto := pag_n - pag_o;
  elsif coalesce(n->>'nota_equipo', '') is distinct from coalesce(o->>'nota_equipo', '')
        and (n - sin_firma - 'nota_equipo') is not distinct from (o - sin_firma - 'nota_equipo') then t := 'nota';
  elsif (n - sin_firma) is distinct from (o - sin_firma) then t := 'edicion';
  else return null;
  end if;
  insert into public.equipo_movimientos (propiedad, reserva_id, tipo, huesped, habitacion, fecha_ingreso, fecha_salida,
                                         canal, monto, pagado, forma_pago, por_nombre, por_usuario, nota)
  values (coalesce(nullif(n->>'propiedad', ''), 'hostel'), n->>'id', t, n->>'huesped', n->>'habitacion',
          left(n->>'fecha_ingreso', 10), left(n->>'fecha_salida', 10), n->>'canal', monto,
          case when t = 'nueva' then pag_n end, n->>'forma_pago', public.mi_nombre(), auth.uid(),
          case when t in ('nota', 'nueva') then nullif(n->>'nota_equipo', '') end);
  return null;
end $$;
revoke all on function public.reservas_equipo_movimiento() from public, anon, authenticated;

-- Comprobar: tienen que aparecer 3 renglones con "ok"
notify pgrst, 'reload schema';
select 'columna reservas.nota_equipo' as que, 'ok' as estado
  where exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reservas' and column_name = 'nota_equipo')
union all
select 'columna equipo_movimientos.nota', 'ok'
  where exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'equipo_movimientos' and column_name = 'nota')
union all
select 'función equipo_reservas con nota', 'ok'
  where exists (select 1 from pg_proc where proname = 'equipo_reservas' and pg_get_function_result(oid) like '%nota_equipo%');
