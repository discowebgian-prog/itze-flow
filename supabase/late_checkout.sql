-- Late check-out en la reserva: hora acordada ('HH:MM') y costo.
-- Agrega dos columnas vacías a "reservas"; no toca los datos que ya existen.
-- El costo también se suma al monto total de la reserva desde la app.
-- La tabla ya tiene RLS activo; las columnas nuevas siguen las mismas reglas.

alter table public.reservas
  add column if not exists late_checkout_hora text,
  add column if not exists late_checkout_costo numeric;
