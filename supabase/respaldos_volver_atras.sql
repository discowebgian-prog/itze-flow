-- Volver atrás el respaldo automático (borra también los respaldos guardados en Flow)
select cron.unschedule('flow-respaldo') where exists (select 1 from cron.job where jobname = 'flow-respaldo');
drop function if exists public.flow_respaldo_ahora();
drop function if exists public.flow_respaldo_guardar(text, text, text, jsonb, text, text);
drop function if exists public.flow_respaldo_datos(text);
drop function if exists public.respaldo_permitido(text);
drop table if exists public.flow_respaldos;
notify pgrst, 'reload schema';
