-- Itzé Flow · Equipo: habitaciones del día desde las reservas (paso 5, parte 2).
-- Pegalo en Supabase › SQL Editor › Run (después de equipo.sql). Se puede correr más de una vez.
--
-- El equipo (Mary) no puede leer la tabla reservas (permisos_por_rol.sql). Esta función le da solo lo
-- que necesita para saber qué pasa hoy y mañana en cada habitación: habitación, nombre del huésped,
-- fechas, estado y hora del late check-out. Nada de montos, pagos, teléfonos ni documentos.
-- Sin canceladas ni eliminadas.

create or replace function public.equipo_reservas(p_desde date, p_hasta date)
returns table (
  id text, propiedad text, habitacion text, huesped text,
  fecha_ingreso date, fecha_salida date, estado text, late_checkout_hora text, grupo_id text
)
language sql stable security definer set search_path = public as $$
  select r.id::text, coalesce(nullif(r.propiedad::text, ''), 'hostel'), r.habitacion::text, r.huesped::text,
         nullif(r.fecha_ingreso::text, '')::date, nullif(r.fecha_salida::text, '')::date,
         r.estado::text, nullif(r.late_checkout_hora::text, ''), r.grupo_id::text
  from public.reservas r
  where public.tiene_permiso('limpieza')
    and coalesce(r.estado::text, '') not in ('cancelada', 'eliminada')
    and nullif(r.fecha_ingreso::text, '') is not null
    and nullif(r.fecha_salida::text, '') is not null
    and nullif(r.fecha_ingreso::text, '')::date <= p_hasta
    and nullif(r.fecha_salida::text, '')::date >= p_desde
    and p_hasta - p_desde <= 31;  -- solo unos días, no todo el historial
$$;

revoke all on function public.equipo_reservas(date, date) from public, anon;
grant execute on function public.equipo_reservas(date, date) to authenticated;

-- Comprobar: lo que ve el equipo (usuario de prueba de Mary) de ayer a mañana: nombres y fechas, sin montos.
-- Si hace falta, cambiá el correo. No deja nada guardado.
begin;
select from set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'gianpadula@outlook.com'), 'role', 'authenticated')::text, true);
set local role authenticated;
select * from public.equipo_reservas(public.equipo_hoy() - 1, public.equipo_hoy() + 1) order by habitacion, fecha_ingreso;
rollback;
