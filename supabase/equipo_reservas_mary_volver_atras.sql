-- Itzé Flow · Volver atrás el paso 9, parte 1 (deshace equipo_reservas_mary.sql).
-- El equipo vuelve a no tocar reservas. Las columnas cargada_por / cargada_por_nombre y los
-- movimientos quedan (no molestan); para borrarlos, descomentar las dos últimas líneas.
begin;
drop policy if exists "reservas: equipo ve las suyas" on public.reservas;
drop policy if exists "reservas: equipo carga" on public.reservas;
drop policy if exists "reservas: equipo cambia las suyas" on public.reservas;
drop trigger if exists reservas_equipo_firmar on public.reservas;
drop trigger if exists reservas_equipo_movimiento on public.reservas;
drop trigger if exists equipo_aviso_movimiento on public.equipo_movimientos;
drop function if exists public.reservas_equipo_firmar();
drop function if exists public.reservas_equipo_movimiento();
drop function if exists public.equipo_reservas_todas();
drop function if exists public.equipo_checkin(text);
drop function if exists public.equipo_checkout(text);
drop function if exists public.equipo_cobrar(text, numeric, text);
drop function if exists public.equipo_contacto(text, jsonb);
drop function if exists public.equipo_puede_reserva(text, text);
drop policy if exists "documentos: equipo ver" on storage.objects;
drop policy if exists "documentos: equipo subir" on storage.objects;
-- drop table if exists public.equipo_movimientos;
-- alter table public.reservas drop column if exists cargada_por, drop column if exists cargada_por_nombre;
commit;
