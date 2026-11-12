-- Volver atrás mejoras_nov.sql (se pierde lo guardado en esas tablas y columnas).
drop function if exists public.eventos_contexto(text);
drop table if exists public.eventos_fuentes;
drop table if exists public.competencia;
drop table if exists public.flow_vistos;
alter table public.reservas drop column if exists extendida_noches;
alter table public.reservas drop column if exists checkout_original;
notify pgrst, 'reload schema';
