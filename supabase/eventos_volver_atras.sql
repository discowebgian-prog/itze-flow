-- Volver atrás el radar de eventos: borra la búsqueda de los lunes, las funciones y las tablas
-- (se pierden los eventos guardados).
select cron.unschedule('flow-eventos') where exists (select 1 from cron.job where jobname = 'flow-eventos');
drop function if exists public.flow_eventos_ahora();
drop function if exists public.eventos_guardar(text, jsonb, text);
drop function if exists public.eventos_conocidos(text);
drop function if exists public.eventos_permitido(text);
drop table if exists public.eventos_busquedas;
drop table if exists public.eventos;
notify pgrst, 'reload schema';
