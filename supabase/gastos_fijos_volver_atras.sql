-- Volver atrás los gastos fijos.
-- Las filas de cada mes que ya se crearon en `gastos` quedan como gastos comunes (no se borran).
select cron.unschedule('gastos-fijos') where exists (select 1 from cron.job where jobname = 'gastos-fijos');
drop function if exists public.gastos_fijos_generar();
drop function if exists public._gastos_fijos_generar();
drop index if exists public.gastos_fijo_mes_uk;
alter table public.gastos drop column if exists fijo_id;
alter table public.gastos drop column if exists mes;
drop table if exists public.gastos_fijos;
notify pgrst, 'reload schema';
