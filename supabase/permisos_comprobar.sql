-- Itzé Flow · Comprobar los permisos por rol (después de permisos_por_rol.sql).
-- Se hace pasar por cada usuario y cuenta qué ve. No cambia nada (todo termina en rollback).
-- Si hace falta, cambiá los dos correos: el del equipo (gianpadula@…) y el de los dueños (itzehostel@…).

begin;
create temp table resultado (quien text, reservas int, gastos int, decisiones int, avisos int, tarifas int, fotos_documentos int) on commit drop;
grant all on resultado to authenticated;

-- Como el equipo (Mary)
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'gianpadula@outlook.com'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into resultado select 'equipo',
  (select count(*) from public.reservas), (select count(*) from public.gastos),
  (select count(*) from public.huespedes_decisiones), (select count(*) from public.push_subs),
  (select count(*) from public.tarifas), (select count(*) from storage.objects where bucket_id = 'documentos');
reset role;

-- Como los dueños
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'itzehostel@gmail.com'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into resultado select 'dueños',
  (select count(*) from public.reservas), (select count(*) from public.gastos),
  (select count(*) from public.huespedes_decisiones), (select count(*) from public.push_subs),
  (select count(*) from public.tarifas), (select count(*) from storage.objects where bucket_id = 'documentos');
reset role;

select * from resultado;
rollback;

-- Tiene que salir: equipo con 0 en todo menos tarifas; dueños con sus números de siempre.
