-- Itzé Flow · Comprobar el paso 9, parte 1 (después de equipo_reservas_mary.sql). Correrlo en una consulta aparte.
-- Se hace pasar por el usuario de prueba de Mary y prueba qué puede y qué no. Termina en rollback: NO guarda nada.
-- OJO: no pegarlo junto con otro SQL (el rollback deshace también lo de arriba).
begin;
create temp table resultado (prueba text, esperado text, salio text) on commit drop;
grant all on resultado to authenticated;
create or replace function pg_temp.como(correo text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = correo), 'role', 'authenticated')::text, true);
$$;

select from pg_temp.como('gianpadula@outlook.com');
set local role authenticated;
insert into resultado select 'Mary: lee reservas directo (solo las suyas)', '0', count(*)::text from public.reservas;
insert into resultado select 'Mary: ve todas sin montos', 'sí',
  case when jsonb_array_length(public.equipo_reservas_todas()) > 0
        and not exists (select 1 from jsonb_array_elements(public.equipo_reservas_todas()) e where e ? 'monto' and not (e->>'propia')::boolean)
       then 'sí' else 'no' end;
insert into public.reservas (huesped, habitacion, fecha_ingreso, fecha_salida, estado, monto, monto_pagado, canal, forma_pago)
  values ('PRUEBA Mary', 'P6', public.equipo_hoy()::text, (public.equipo_hoy() + 1)::text, 'por_llegar', '790', '0', 'Directo-Puerta', 'Efectivo');
insert into resultado select 'Mary: carga una reserva y la ve', '1', count(*)::text from public.reservas where huesped = 'PRUEBA Mary';
insert into resultado select 'La base anota quién la cargó', 'Mary', cargada_por_nombre from public.reservas where huesped = 'PRUEBA Mary';
select public.equipo_cobrar((select id::text from public.reservas where huesped = 'PRUEBA Mary'), 790, 'Efectivo');
select public.equipo_checkin((select id::text from public.reservas where huesped = 'PRUEBA Mary'));
reset role;
insert into resultado select 'Movimientos anotados (nueva, cobro, check-in)', '3', count(*)::text from public.equipo_movimientos m
  join public.reservas r on r.id::text = m.reserva_id where r.huesped = 'PRUEBA Mary';

-- Lo que Mary NO puede hacer con una reserva ajena
do $$
declare intentos text[] := array[
  $q$update public.reservas set monto = '1' where cargada_por is distinct from auth.uid() returning 1$q$,
  $q$delete from public.reservas returning 1$q$,
  $q$select public.equipo_cobrar((select id::text from public.reservas where coalesce(canal, '') ilike '%booking%' limit 1), 1, 'Efectivo')$q$
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
    insert into resultado values ('Mary NO puede: ' || left(q, 55), 'bloqueado', case when bloqueado then 'bloqueado' else '¡PASÓ!' end);
  end loop;
end $$;

select * from resultado;
rollback;
