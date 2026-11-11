-- Itzé Flow · Avisos de Equipo al celular (paso 7). Pegalo en Supabase › SQL Editor › Run.
-- Antes: equipo.sql, equipo_reservas.sql y buen_dia.sql. Se puede correr más de una vez.
-- Para volver atrás: supabase/equipo_avisos_volver_atras.sql. Para probar: equipo_avisos_comprobar.sql.
--
-- Como en Itzé Limpieza (su Edge Function "notify"): cuando cambia algo en las tablas de Equipo,
-- la base le pasa la fila nueva y la vieja a la app (/api/push, con la clave de flow_secreto)
-- y la app decide qué aviso le llega a quién: a los dueños o al equipo, cada uno por separado.
--
-- 1) Cada aparato anotado para avisos sabe de quién es (rol y usuario). Así Mary recibe solo lo suyo
--    y nunca los avisos de reservas de los dueños; los dueños, lo de Mary y lo de siempre.
-- 2) El equipo (con permiso "limpieza") puede anotar y borrar sus propios aparatos.

begin;

do $$
begin
  if to_regclass('public.equipo_tareas') is null or to_regprocedure('public.equipo_reservas(date,date)') is null
     or to_regclass('public.flow_secreto') is null then
    raise exception 'Falta correr antes equipo.sql, equipo_reservas.sql y buen_dia.sql.';
  end if;
end $$;

-- 1) De quién es cada aparato
alter table public.push_subs add column if not exists rol text not null default 'dueno';
alter table public.push_subs add column if not exists user_id uuid;

create or replace function public.push_subs_firmar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.user_id := auth.uid();
    new.rol := case when public.es_dueno() then 'dueno' else 'equipo' end;
  end if;
  return new;
end $$;
revoke all on function public.push_subs_firmar() from public, anon, authenticated;
drop trigger if exists push_subs_firmar on public.push_subs;
create trigger push_subs_firmar before insert or update on public.push_subs
  for each row execute function public.push_subs_firmar();

drop policy if exists "push_subs: equipo los suyos" on public.push_subs;
create policy "push_subs: equipo los suyos" on public.push_subs
  for all to authenticated
  using (user_id = auth.uid() and public.tiene_permiso('limpieza'))
  with check (user_id = auth.uid() and public.tiene_permiso('limpieza'));

-- Anotar este aparato a nombre de quien entró (dueños o equipo). Si el mismo celular se usó con otro
-- usuario (ej. Gian probando "como Mary"), pasa a ser del último que entró: así nunca recibe avisos de los dos.
create or replace function public.push_anotar(p_endpoint text, p_p256dh text, p_auth text, p_quien text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not (public.es_dueno() or public.tiene_permiso('limpieza')) then
    raise exception 'Sin permiso para recibir avisos.';
  end if;
  insert into public.push_subs (endpoint, p256dh, auth, quien, actualizado_en)
  values (p_endpoint, p_p256dh, p_auth, coalesce(p_quien, ''), now())
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, quien = excluded.quien, actualizado_en = now();
end $$;
revoke all on function public.push_anotar(text, text, text, text) from public, anon;
grant execute on function public.push_anotar(text, text, text, text) to authenticated;

-- 2) La dirección de la app (una sola vez acá; la usa también el Buen día). Cambiarla si Flow se replica.
create or replace function public.flow_url() returns text language sql immutable as
$$ select 'https://itze-flow-2.vercel.app' $$;

-- 3) Lo que necesita la app para mandar: los aparatos con su rol. Solo con la clave correcta.
--    Con p_borrar, además borra los aparatos que ya no existen (el celular los dio de baja).
create or replace function public.flow_avisos_subs(p_clave text, p_borrar text[] default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_clave is null or p_clave <> (select clave from public.flow_secreto where id = 1) then
    return null;
  end if;
  if p_borrar is not null then
    delete from public.push_subs where endpoint = any(p_borrar);
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
                                        'quien', s.quien, 'rol', coalesce(s.rol, 'dueno')))
    from public.push_subs s
  ), '[]'::jsonb);
end $$;
revoke all on function public.flow_avisos_subs(text, text[]) from public;
grant execute on function public.flow_avisos_subs(text, text[]) to anon, authenticated;

-- 4) Cuando cambia algo de Equipo, se lo pasa a la app (no frena nada: el pedido va aparte)
create or replace function public.equipo_aviso() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  extra jsonb := null;
  r record;
begin
  -- Habitaciones: quién sale, quién entra y desde cuándo está, desde las reservas (sin montos)
  if tg_table_name = 'equipo_habitaciones' then
    select
      max(huesped) filter (where fecha_salida = new.fecha) as sale,
      max(huesped) filter (where fecha_ingreso = new.fecha) as entra,
      max(huesped) filter (where fecha_ingreso < new.fecha and fecha_salida > new.fecha) as queda,
      max(fecha_ingreso::text) filter (where fecha_ingreso < new.fecha and fecha_salida > new.fecha) as desde,
      max(fecha_salida::text) filter (where fecha_ingreso < new.fecha and fecha_salida > new.fecha) as hasta
    into r
    from (
      select x.huesped, left(x.j->>'fecha_ingreso', 10)::date as fecha_ingreso, left(x.j->>'fecha_salida', 10)::date as fecha_salida
      from (select to_jsonb(q) as j, q.huesped from public.reservas q where q.habitacion::text = new.habitacion) x
      where coalesce(x.j->>'estado', '') not in ('cancelada', 'eliminada')
        and nullif(x.j->>'fecha_ingreso', '') is not null and nullif(x.j->>'fecha_salida', '') is not null
    ) t
    where fecha_ingreso <= new.fecha and fecha_salida >= new.fecha;
    extra := jsonb_build_object(
      'status', case when r.sale is not null and r.entra is not null then 'sale_entra'
                     when r.sale is not null then 'salida' when r.entra is not null then 'entrada'
                     when r.queda is not null then 'estancia' end,
      'guest', coalesce(r.sale, r.queda), 'guest_in', r.entra, 'checkin', r.desde, 'checkout', r.hasta);
  end if;
  perform net.http_post(
    url := public.flow_url() || '/api/push',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-flow-clave', (select clave from public.flow_secreto where id = 1)),
    body := jsonb_build_object('tipo', 'equipo', 'table', tg_table_name, 'type', tg_op,
                               'record', to_jsonb(new), 'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) end,
                               'hab', extra),
    timeout_milliseconds := 15000
  );
  return null;
end $$;
revoke all on function public.equipo_aviso() from public, anon, authenticated;

-- Solo cuando hay algo para avisar (no al reordenar, ni al copiar programadas)
drop trigger if exists equipo_aviso_tarea_nueva on public.equipo_tareas;
create trigger equipo_aviso_tarea_nueva after insert on public.equipo_tareas
  for each row when (new.plantilla_id is null and new.tipo <> 'programada')
  execute function public.equipo_aviso();
drop trigger if exists equipo_aviso_tarea_cambio on public.equipo_tareas;
create trigger equipo_aviso_tarea_cambio after update on public.equipo_tareas
  for each row when (new.tipo <> 'programada' and (new.editada_en is distinct from old.editada_en or (new.hecha and not old.hecha)))
  execute function public.equipo_aviso();

drop trigger if exists equipo_aviso_insumo on public.equipo_insumos;
create trigger equipo_aviso_insumo after insert or update of estado on public.equipo_insumos
  for each row execute function public.equipo_aviso();

drop trigger if exists equipo_aviso_dia_nuevo on public.equipo_dias;
create trigger equipo_aviso_dia_nuevo after insert on public.equipo_dias
  for each row when (new.cerrado or new.empezo_en is not null)
  execute function public.equipo_aviso();
drop trigger if exists equipo_aviso_dia_cambio on public.equipo_dias;
create trigger equipo_aviso_dia_cambio after update on public.equipo_dias
  for each row when ((new.cerrado and not old.cerrado) or (new.empezo_en is not null and old.empezo_en is null))
  execute function public.equipo_aviso();

drop trigger if exists equipo_aviso_hab_nueva on public.equipo_habitaciones;
create trigger equipo_aviso_hab_nueva after insert on public.equipo_habitaciones
  for each row when (new.lista_en is not null or new.salieron_en is not null)
  execute function public.equipo_aviso();
drop trigger if exists equipo_aviso_hab_cambio on public.equipo_habitaciones;
create trigger equipo_aviso_hab_cambio after update on public.equipo_habitaciones
  for each row when ((new.lista_en is not null and old.lista_en is null) or (new.salieron_en is not null and old.salieron_en is null))
  execute function public.equipo_aviso();

commit;

notify pgrst, 'reload schema';

-- Comprobar: tienen que salir 7 disparadores y las columnas rol y user_id.
select 'disparador' as que, tgname as nombre from pg_trigger where tgname like 'equipo_aviso%'
union all select 'columna', column_name from information_schema.columns where table_name = 'push_subs' and column_name in ('rol', 'user_id');
