-- Comprobar el radar de eventos (después de correr eventos.sql). Solo lee; no cambia nada.
select 'tabla eventos' as que, to_regclass('public.eventos') is not null as ok
union all select 'tabla eventos_busquedas', to_regclass('public.eventos_busquedas') is not null
union all select 'RLS eventos', (select relrowsecurity from pg_class where oid = 'public.eventos'::regclass)
union all select 'función eventos_guardar', exists (select 1 from pg_proc where proname = 'eventos_guardar')
union all select 'búsqueda de los lunes programada', exists (select 1 from cron.job where jobname = 'flow-eventos');

-- Eventos guardados y últimas búsquedas
select nombre, tipo, fecha_desde, fecha_hasta, impacto, estado from public.eventos order by fecha_desde limit 30;
select hecho_en, nuevos, total, error from public.eventos_busquedas order by hecho_en desc limit 5;
