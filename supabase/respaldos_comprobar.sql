-- Comprobar el respaldo automático (no cambia nada)

-- ¿Está programado? (debe salir flow-respaldo con 0 9 * * *)
select jobname, schedule, active from cron.job where jobname = 'flow-respaldo';

-- ¿Cómo salieron las últimas corridas?
select status, return_message, start_time
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'flow-respaldo')
order by start_time desc limit 5;

-- Respaldos guardados (sin el archivo)
select creado_en at time zone 'America/Merida' as hora_progreso, nombre, origen, hecho_por, tamano, resumen
from public.flow_respaldos order by creado_en desc limit 10;
