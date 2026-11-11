-- Itzé Flow · Volver atrás los avisos de Equipo (deshace equipo_avisos.sql).
-- Saca los disparadores y la función; los aparatos anotados quedan (sin las columnas rol y user_id).

begin;
drop trigger if exists equipo_aviso_tarea_nueva on public.equipo_tareas;
drop trigger if exists equipo_aviso_tarea_cambio on public.equipo_tareas;
drop trigger if exists equipo_aviso_insumo on public.equipo_insumos;
drop trigger if exists equipo_aviso_dia_nuevo on public.equipo_dias;
drop trigger if exists equipo_aviso_dia_cambio on public.equipo_dias;
drop trigger if exists equipo_aviso_hab_nueva on public.equipo_habitaciones;
drop trigger if exists equipo_aviso_hab_cambio on public.equipo_habitaciones;
drop function if exists public.equipo_aviso();
drop function if exists public.flow_avisos_subs(text, text[]);
drop function if exists public.push_anotar(text, text, text, text);
drop policy if exists "push_subs: equipo los suyos" on public.push_subs;
delete from public.push_subs where rol = 'equipo';
drop trigger if exists push_subs_firmar on public.push_subs;
drop function if exists public.push_subs_firmar();
alter table public.push_subs drop column if exists rol;
alter table public.push_subs drop column if exists user_id;
commit;
