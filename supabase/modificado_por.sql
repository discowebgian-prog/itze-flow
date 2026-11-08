-- Quién hizo el último cambio en cada reserva (para avisar en el otro aparato:
-- "Marce hizo el check-in de Ana López (P2)"). Lo escribe la app con el nombre de
-- "¿Quién usa este dispositivo?"; el check-out automático escribe 'Flow'.
-- Correr una vez en Supabase → SQL Editor.
alter table public.reservas add column if not exists modificado_por text;
