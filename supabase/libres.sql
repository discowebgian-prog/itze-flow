-- Avisos de habitaciones libres para esta noche, con el precio de hoy (solo a los dueños):
--   8:00  → va dentro del "Buen día" (ver buen_dia.sql; no hace falta otro reloj)
--   13:00 → "Quedan 2 libres para esta noche" (no se manda si está todo lleno)
--   18:00 → lo mismo + cómo viene mañana (reemplaza al de las 13:00)
-- Tocar el aviso abre Cotizar con la entrada de hoy.
-- Correr una vez en Supabase → SQL Editor, DESPUÉS de publicar la app (la base llama a /api/push).
-- Se puede volver a correr sin problema. Necesita buen_dia.sql y equipo_avisos.sql (ya corridos).
-- Volver atrás: libres_volver_atras.sql

-- Lo que necesita el aviso: reservas que ocupan hoy o mañana y el tarifario. Solo con la clave correcta.
create or replace function public.flow_libres(p_clave text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hoy date := (now() at time zone 'America/Merida')::date;
begin
  if p_clave is null or p_clave <> (select clave from public.flow_secreto where id = 1) then
    return null;
  end if;
  return jsonb_build_object(
    'reservas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'huesped', r.huesped, 'habitacion', r.habitacion,
        'fecha_ingreso', r.fecha_ingreso, 'fecha_salida', r.fecha_salida, 'estado', r.estado,
        'late_checkout_hora', r.late_checkout_hora,
        'propiedad', to_jsonb(r) ->> 'propiedad'))
      from public.reservas r
      where r.fecha_ingreso::date <= hoy + 1 and r.fecha_salida::date >= hoy
        and coalesce(r.estado, '') not in ('cancelada', 'eliminada')
    ), '[]'::jsonb),
    'tarifas', coalesce((select jsonb_agg(to_jsonb(t)) from public.tarifas t), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.flow_libres(text) from public;
grant execute on function public.flow_libres(text) to anon, authenticated;

-- Manda el aviso ya. cuando: 'mediodia' o 'tarde'. Para probar: select public.flow_libres_ahora('tarde');
create or replace function public.flow_libres_ahora(cuando text default 'mediodia')
returns bigint
language sql
security definer
set search_path = public, extensions
as $$
  select net.http_post(
    url := public.flow_url() || '/api/push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-flow-clave', (select clave from public.flow_secreto where id = 1)
    ),
    body := jsonb_build_object('tipo', 'libres', 'cuando', cuando),
    timeout_milliseconds := 20000
  );
$$;
revoke all on function public.flow_libres_ahora(text) from public, anon, authenticated;

-- 13:00 de Progreso = 19:00 UTC · 18:00 de Progreso = 00:00 UTC (Yucatán no cambia la hora)
select cron.schedule('flow-libres-mediodia', '0 19 * * *', $c$select public.flow_libres_ahora('mediodia');$c$);
select cron.schedule('flow-libres-tarde', '0 0 * * *', $c$select public.flow_libres_ahora('tarde');$c$);
