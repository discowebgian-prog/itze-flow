-- Itzé Flow · Comprobar los avisos de Equipo (después de equipo_avisos.sql). Correrlo aparte. Solo lee.
-- Muestra cada aparato anotado para avisos con su rol (dueno / equipo) y quién es.
-- Los aparatos que ya estaban quedan como "dueno" (eran todos de Gian y Marce).
select rol, quien, left(endpoint, 40) || '…' as aparato
from jsonb_to_recordset(public.flow_avisos_subs((select clave from public.flow_secreto where id = 1)))
  as s(endpoint text, rol text, quien text)
order by rol, quien;
