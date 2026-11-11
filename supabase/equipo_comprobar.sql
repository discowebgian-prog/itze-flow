-- Itzé Flow · Comprobar Equipo (después de equipo.sql). En el SQL Editor: "Run without RLS" si lo pide.
-- Se hace pasar por Mary (usuario de prueba) y por los dueños y prueba lo que cada uno puede hacer.
-- Todo queda adentro de una transacción que se deshace al final: NO deja nada guardado.
-- Si hace falta, cambiá los dos correos: el del equipo (gianpadula@…) y el de los dueños (itzehostel@…).

begin;

create temp table resultado (prueba text, esperado text, salio text) on commit drop;
grant all on resultado to authenticated;

create or replace function pg_temp.como(correo text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = correo), 'role', 'authenticated')::text, true);
$$;

-- Dueños: crean una tarea, una rutina, un mensaje para Mary y una programada para hoy
select from pg_temp.como('itzehostel@gmail.com');
set local role authenticated;
insert into public.equipo_tareas (texto, tipo, creada_por_nombre) values ('PRUEBA tarea', 'hoy', 'Gian');
insert into public.equipo_tareas (texto, tipo, creada_por_nombre) values ('PRUEBA mensaje', 'mensaje', 'Gian');
insert into public.equipo_tareas (texto, tipo, dias_semana) values ('PRUEBA programada', 'programada', array[extract(dow from public.equipo_hoy())::smallint]);
insert into resultado select 'Dueños: tareas creadas', '3', count(*)::text from public.equipo_tareas where texto like 'PRUEBA%';
insert into resultado select 'Programada copiada a hoy', '1', public.equipo_programadas_hoy()::text;
insert into resultado select 'Programada: no se copia dos veces', '0', public.equipo_programadas_hoy()::text;
reset role;

-- Mary
select from pg_temp.como('gianpadula@outlook.com');
set local role authenticated;
insert into resultado select 'Mary: ve las tareas', '4', count(*)::text from public.equipo_tareas where texto like 'PRUEBA%';
insert into public.equipo_tareas (texto, tipo, de_rol, creada_por_nombre) values ('PRUEBA nota de Mary', 'mensaje', 'dueno', 'Mary');
insert into resultado select 'Mary: su nota queda como del equipo', 'equipo', de_rol from public.equipo_tareas where texto = 'PRUEBA nota de Mary';
update public.equipo_tareas set hecha = true, hecha_en = now() where texto = 'PRUEBA mensaje';
insert into resultado select 'Mary: toca Entendido', 'true', hecha::text from public.equipo_tareas where texto = 'PRUEBA mensaje';
update public.equipo_tareas set texto = 'PRUEBA nota corregida', editada_en = now() where texto = 'PRUEBA nota de Mary';
insert into resultado select 'Mary: corrige su nota', '1', count(*)::text from public.equipo_tareas where texto = 'PRUEBA nota corregida' and editada_por_rol = 'equipo';
insert into public.equipo_insumos (nombre, sector, creado_por_nombre) values ('PRUEBA Azúcar', 'cocina', 'Mary');
insert into public.equipo_dias (fecha, empezo_en) values (public.equipo_hoy(), now())
  on conflict (propiedad, fecha) do update set empezo_en = excluded.empezo_en;
insert into public.equipo_habitaciones (fecha, habitacion, lista_en, lista_por_rol) values (public.equipo_hoy(), 'P9', now(), 'dueno');
insert into resultado select 'Mary: marca lista (firma la base)', 'equipo', lista_por_rol from public.equipo_habitaciones where habitacion = 'P9';
reset role;

-- Lo que Mary NO puede hacer (cada intento tiene que fallar)
do $$
declare intentos text[] := array[
  $q$insert into public.equipo_tareas (texto, tipo) values ('PRUEBA x', 'hoy')$q$,
  $q$update public.equipo_tareas set texto = 'cambiada' where texto = 'PRUEBA tarea'$q$,
  $q$update public.equipo_insumos set estado = 'repuesto' where nombre = 'PRUEBA Azúcar' returning 1$q$,
  $q$delete from public.equipo_tareas where texto = 'PRUEBA tarea' returning 1$q$
]; q text; bloqueado boolean; filas int;
begin
  perform pg_temp.como('gianpadula@outlook.com');
  foreach q in array intentos loop
    bloqueado := false;
    begin
      execute 'set local role authenticated';
      execute q; get diagnostics filas = row_count;
      bloqueado := (filas = 0);
      execute 'reset role';
    exception when others then bloqueado := true; execute 'reset role';
    end;
    insert into resultado values ('Mary NO puede: ' || left(q, 60), 'bloqueado', case when bloqueado then 'bloqueado' else '¡PASÓ!' end);
  end loop;
end $$;

-- Dueños reponen el insumo
select from pg_temp.como('itzehostel@gmail.com');
set local role authenticated;
update public.equipo_insumos set estado = 'repuesto', repuesto_en = now() where nombre = 'PRUEBA Azúcar';
insert into resultado select 'Dueños: reponen el insumo', 'repuesto', estado from public.equipo_insumos where nombre = 'PRUEBA Azúcar';
reset role;

select * from resultado;
rollback;  -- no deja nada guardado
