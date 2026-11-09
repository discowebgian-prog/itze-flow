-- "Buen día" de las 8:00: a cada celular con avisos activos le llega
-- "Buen día, Marce ☀️" + el día en palabras de Inicio ("Hoy llega Ana López (P2)…").
-- Correr una vez en Supabase → SQL Editor. Se puede volver a correr sin problema.
--
-- Cómo funciona:
-- 1. pg_cron (reloj de Supabase) llama todos los días a las 14:00 UTC = 8:00 en Progreso
--    (Yucatán no cambia la hora en verano) a flow_buen_dia_ahora().
-- 2. Esa función llama a la app (/api/push) con una clave secreta que vive solo en la base.
-- 3. La app le pide a flow_buen_dia() las reservas de hoy y los celulares anotados; la base
--    revisa la clave y recién ahí los devuelve. Sin la clave no devuelve nada.
-- Nada de claves para copiar a mano: la clave se crea sola acá y nunca sale de Supabase
-- salvo en ese llamado a la app.
--
-- Si Flow se replica para otro alojamiento: cambiar la dirección de la app (más abajo).

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
create extension if not exists pg_net with schema extensions;

-- Clave secreta (una sola fila). RLS sin reglas: desde la app nadie la puede leer.
create table if not exists public.flow_secreto (
  id int primary key default 1 check (id = 1),
  clave text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);
alter table public.flow_secreto enable row level security;
insert into public.flow_secreto (id) values (1) on conflict (id) do nothing;

-- Lo que necesita el aviso: reservas que entran o salen hoy y los celulares anotados.
-- Solo responde con la clave correcta.
create or replace function public.flow_buen_dia(p_clave text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hoy text := ((now() at time zone 'America/Merida')::date)::text;
begin
  if p_clave is null or p_clave <> (select clave from public.flow_secreto where id = 1) then
    return null;
  end if;
  return jsonb_build_object(
    'reservas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'huesped', r.huesped, 'habitacion', r.habitacion,
        'fecha_ingreso', r.fecha_ingreso, 'fecha_salida', r.fecha_salida, 'estado', r.estado,
        'monto', r.monto, 'monto_pagado', r.monto_pagado, 'cantidad_huespedes', r.cantidad_huespedes,
        'late_checkout_hora', r.late_checkout_hora,
        'grupo_id', r.grupo_id, 'grupo_titular', r.grupo_titular, 'grupo_reservante', r.grupo_reservante))
      from public.reservas r
      where r.fecha_ingreso::text = hoy or r.fecha_salida::text = hoy
    ), '[]'::jsonb),
    'subs', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth, 'quien', s.quien))
      from public.push_subs s
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.flow_buen_dia(text) from public;
grant execute on function public.flow_buen_dia(text) to anon, authenticated;

-- Manda el aviso ya. La usa el reloj de las 8:00; para probar: select public.flow_buen_dia_ahora();
create or replace function public.flow_buen_dia_ahora()
returns bigint
language sql
security definer
set search_path = public, extensions
as $$
  select net.http_post(
    url := 'https://itze-flow-2.vercel.app/api/push',  -- dirección de la app
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-flow-clave', (select clave from public.flow_secreto where id = 1)
    ),
    body := jsonb_build_object('tipo', 'buen-dia'),
    timeout_milliseconds := 20000
  );
$$;
revoke all on function public.flow_buen_dia_ahora() from public, anon, authenticated;

-- Todos los días a las 8:00 de Progreso (14:00 UTC). Si ya existía, se reemplaza.
select cron.schedule('flow-buen-dia', '0 14 * * *', 'select public.flow_buen_dia_ahora();');
