-- Nombre de la empresa en la reserva (opcional, se completa cuando "Solicita factura" está activo).
-- Sirve para la base de marketing a empresas: quien pide factura se considera Empresa.
-- Agrega una columna vacía a "reservas"; no toca los datos que ya existen.
-- La tabla ya tiene RLS activo; la columna nueva sigue las mismas reglas.

alter table public.reservas
  add column if not exists empresa text;
