-- Apaga los avisos de libres de las 13:00 y 18:00 y borra sus funciones.
-- (El renglón de libres del Buen día de las 8:00 deja de salir solo, porque ya no encuentra flow_libres.)
select cron.unschedule('flow-libres-mediodia');
select cron.unschedule('flow-libres-tarde');
drop function if exists public.flow_libres_ahora(text);
drop function if exists public.flow_libres(text);
