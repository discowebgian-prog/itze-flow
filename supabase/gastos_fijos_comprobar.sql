-- Comprobar los gastos fijos (no cambia nada)

-- ¿Está programado el día 1? (debe salir gastos-fijos con 15 6 1 * *)
select jobname, schedule, active from cron.job where jobname = 'gastos-fijos';

-- La lista de gastos fijos
select concepto, categoria, monto, cada_meses, desde, hasta from public.gastos_fijos order by concepto;

-- Lo que generaron, mes por mes
select g.mes, f.concepto, g.monto
from public.gastos g join public.gastos_fijos f on f.id = g.fijo_id
order by g.mes desc, f.concepto;
