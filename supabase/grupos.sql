-- Reservas de grupo: varias habitaciones cargadas en una sola gestión.
-- Cada habitación sigue siendo su propia fila en "reservas"; estas columnas solo las unen.
--   grupo_id      → mismo valor en todas las habitaciones del grupo (vacío en reservas comunes)
--   grupo_titular → true en la habitación de quien reservó (el titular del grupo)
-- No toca los datos que ya existen. La tabla ya tiene RLS activo; las columnas siguen las mismas reglas.

alter table public.reservas
  add column if not exists grupo_id uuid,
  add column if not exists grupo_titular boolean not null default false;

create index if not exists reservas_grupo_id_idx on public.reservas (grupo_id);
