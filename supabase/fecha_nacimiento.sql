-- Fecha de nacimiento del huésped (para los cumpleaños en Inicio y Huéspedes).
-- Con INE mexicana sale de la CURP; esta columna guarda la de pasaportes y otros documentos
-- (la lee el escáner o se escribe a mano). Correr una vez en Supabase → SQL Editor.
alter table public.reservas add column if not exists fecha_nacimiento date;
