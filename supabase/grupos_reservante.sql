-- Reservas de grupo: quién reservó (puede no alojarse, ej. una empresa).
-- Se guarda en todas las habitaciones del grupo: nombre, documento, teléfono y email de quien reservó.
-- Sirve para saber qué habitaciones todavía esperan su propio contacto, y para el "Grupo de ...".
-- No toca los datos que ya existen. La tabla ya tiene RLS activo.

alter table public.reservas
  add column if not exists grupo_reservante jsonb;
