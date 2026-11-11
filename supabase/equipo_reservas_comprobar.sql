-- Itzé Flow · Equipo: lo que ve Mary de las reservas (después de equipo_reservas.sql).
-- Correrlo en una consulta aparte. Se hace pasar por el usuario de prueba de Mary y no deja nada guardado.
-- OJO: este archivo termina en rollback; no pegarlo junto con otro SQL (deshace también lo de arriba).
begin;
select from set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'gianpadula@outlook.com'), 'role', 'authenticated')::text, true);
set local role authenticated;
select * from public.equipo_reservas(public.equipo_hoy() - 1, public.equipo_hoy() + 1) order by habitacion, fecha_ingreso;
rollback;
