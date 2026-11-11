-- Itzé Flow · Volver atrás Equipo (deshace equipo.sql).
-- OJO: borra las tablas de Equipo con todo lo que tengan (tareas, días, insumos, habitaciones del día)
-- y las fotos de las tareas. Mientras se prueba no hay nada real; después del día del cambio, no correrlo.

select cron.unschedule('equipo-programadas') where exists (select 1 from cron.job where jobname = 'equipo-programadas');

begin;

drop table if exists public.equipo_habitaciones;
drop table if exists public.equipo_insumos;
drop table if exists public.equipo_dias;
drop table if exists public.equipo_tareas;
drop function if exists public.equipo_programadas_hoy();
drop function if exists public.equipo_firmar();
drop function if exists public.equipo_firmar_hab_nueva();
drop function if exists public.equipo_hoy();

drop policy if exists "equipo_fotos: ver" on storage.objects;
drop policy if exists "equipo_fotos: subir" on storage.objects;
drop policy if exists "equipo_fotos: borrar" on storage.objects;
-- Las fotos se borran desde Supabase › Storage (vaciar y borrar el bucket "equipo_fotos"):
-- Supabase no deja borrarlas desde el SQL Editor.

commit;
