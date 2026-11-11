-- Itzé Flow · Paso 9, parte 1: el equipo (Mary) cotiza, reserva, hace check-in/out y cobra.
-- Pegalo en Supabase › SQL Editor › Run (después de equipo_avisos.sql). Se puede correr más de una vez.
-- Para volver atrás: supabase/equipo_reservas_mary_volver_atras.sql. Pruebas: equipo_reservas_mary_comprobar.sql.
--
-- Qué cambia (decisiones de Gian, 9 y 10 nov 2026):
--   · Mary ve completas (con montos) y puede editar o cancelar SOLO las reservas que cargó ella.
--   · De las demás ve todo menos los montos y las notas internas (sí el saldo, para cobrarlo;
--     en Booking no hay saldo para ella). Sí ve teléfono, documento y fotos del documento.
--   · Check-in, check-out, cobro y completar contacto/documento de cualquier reserva: por funciones
--     de la base que solo tocan eso (no puede cambiar precios ni fechas de reservas ajenas).
--   · Cada reserva guarda quién la cargó (usuario y nombre). Todo lo que hace el equipo con reservas
--     queda en "movimientos" (para que los dueños marquen Visto) y les avisa al celular.
-- Los dueños siguen igual: ven y cambian todo.

begin;

do $$
begin
  if to_regprocedure('public.equipo_aviso()') is null then
    raise exception 'Falta correr antes equipo_avisos.sql.';
  end if;
end $$;

-- 1) Quién cargó cada reserva
alter table public.reservas add column if not exists cargada_por uuid;
alter table public.reservas add column if not exists cargada_por_nombre text;

create or replace function public.mi_nombre() returns text
language sql stable security definer set search_path = public as
$$ select nombre from public.perfiles where id = auth.uid() $$;
revoke all on function public.mi_nombre() from public, anon;
grant execute on function public.mi_nombre() to authenticated;

-- 2) Movimientos del equipo con reservas (para "Visto" de los dueños y los avisos)
create table if not exists public.equipo_movimientos (
  id               uuid primary key default gen_random_uuid(),
  propiedad        text not null default 'hostel',
  reserva_id       text not null,
  tipo             text not null check (tipo in ('nueva', 'edicion', 'cancelacion', 'checkin', 'checkout', 'cobro')),
  huesped          text,
  habitacion       text,
  fecha_ingreso    text,
  fecha_salida     text,
  canal            text,
  monto            numeric,        -- nueva: total; cobro: lo que cobró
  pagado           numeric,        -- nueva: lo que pagó al cargarla
  forma_pago       text,
  por_nombre       text,
  por_usuario      uuid,
  creado_en        timestamptz not null default now(),
  visto            boolean not null default false,
  visto_en         timestamptz,
  visto_por_nombre text
);
create index if not exists equipo_movimientos_creado_idx on public.equipo_movimientos (creado_en desc);
alter table public.equipo_movimientos enable row level security;
drop policy if exists "equipo_movimientos: dueños" on public.equipo_movimientos;
create policy "equipo_movimientos: dueños" on public.equipo_movimientos
  for all to authenticated using (public.es_dueno()) with check (public.es_dueno());
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'equipo_movimientos') then
    alter publication supabase_realtime add table public.equipo_movimientos;
  end if;
end $$;

-- 3) La base firma lo que escribe el equipo (no se confía en el aparato)
create or replace function public.reservas_equipo_firmar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.es_dueno() then
    if tg_op = 'UPDATE' then new.cargada_por := coalesce(new.cargada_por, old.cargada_por); end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.cargada_por := auth.uid();
    new.cargada_por_nombre := public.mi_nombre();
  else
    new.cargada_por := old.cargada_por;
    new.cargada_por_nombre := old.cargada_por_nombre;
  end if;
  new.modificado_por := public.mi_nombre();
  return new;
end $$;
revoke all on function public.reservas_equipo_firmar() from public, anon, authenticated;
drop trigger if exists reservas_equipo_firmar on public.reservas;
create trigger reservas_equipo_firmar before insert or update on public.reservas
  for each row execute function public.reservas_equipo_firmar();

-- 4) Reglas: el equipo con permiso "reservar" ve, carga y cambia SOLO las suyas (las de "solo dueños" siguen)
drop policy if exists "reservas: equipo ve las suyas" on public.reservas;
create policy "reservas: equipo ve las suyas" on public.reservas
  for select to authenticated using (cargada_por = auth.uid() and public.tiene_permiso('reservar'));
drop policy if exists "reservas: equipo carga" on public.reservas;
create policy "reservas: equipo carga" on public.reservas
  for insert to authenticated with check (cargada_por = auth.uid() and public.tiene_permiso('reservar'));
drop policy if exists "reservas: equipo cambia las suyas" on public.reservas;
create policy "reservas: equipo cambia las suyas" on public.reservas
  for update to authenticated using (cargada_por = auth.uid() and public.tiene_permiso('reservar'))
  with check (cargada_por = auth.uid() and public.tiene_permiso('reservar'));

-- 5) Todas las reservas para el equipo (Cotizar, panel, huéspedes anteriores): sin montos ni notas internas
--    en las ajenas; con "saldo" (no en Booking) y "propia". Sin eliminadas.
create or replace function public.equipo_reservas_todas() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.tiene_permiso('reservar') or public.tiene_permiso('checkin') or public.tiene_permiso('cotizar')) then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(
      case when (j->>'cargada_por') = auth.uid()::text then j || jsonb_build_object('propia', true)
      else (j - 'monto' - 'monto_pagado' - 'tarifa_base' - 'descuento' - 'tipo_descuento' - 'motivo_descuento'
              - 'adicionales' - 'late_checkout_costo' - 'forma_pago' - 'notas')
           || jsonb_build_object('propia', false, 'saldo',
                case when coalesce(j->>'canal', '') ilike '%booking%' then null
                     else greatest(coalesce(nullif(j->>'monto', '')::numeric, 0) - coalesce(nullif(j->>'monto_pagado', '')::numeric, 0), 0) end)
      end)
    from (select to_jsonb(r) as j from public.reservas r) x
    where coalesce(j->>'estado', '') <> 'eliminada'
  ), '[]'::jsonb);
end $$;
revoke all on function public.equipo_reservas_todas() from public, anon;
grant execute on function public.equipo_reservas_todas() to authenticated;

-- 6) Acciones sobre cualquier reserva (también ajenas): solo lo justo
create or replace function public.equipo_puede_reserva(p_id text, p_permiso text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare j jsonb;
begin
  if not public.tiene_permiso(p_permiso) then raise exception 'Sin permiso.'; end if;
  select to_jsonb(r) into j from public.reservas r where r.id::text = p_id;
  if j is null or coalesce(j->>'estado', '') = 'eliminada' then raise exception 'No se encontró la reserva.'; end if;
  return j;
end $$;
revoke all on function public.equipo_puede_reserva(text, text) from public, anon, authenticated;

create or replace function public.equipo_checkin(p_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.equipo_puede_reserva(p_id, 'checkin');
  execute format('update public.reservas set estado = %L where id::text = %L', 'hospedado', p_id);
end $$;

-- Check-out = "Ya salieron": también marca que salieron en las habitaciones del día (un solo aviso)
create or replace function public.equipo_checkout(p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare j jsonb;
begin
  j := public.equipo_puede_reserva(p_id, 'checkin');
  execute format('update public.reservas set estado = %L where id::text = %L', 'finalizada', p_id);
  if nullif(j->>'habitacion', '') is not null then
    insert into public.equipo_habitaciones (propiedad, fecha, habitacion, salieron_en, salieron_por_nombre)
    values (coalesce(nullif(j->>'propiedad', ''), 'hostel'), public.equipo_hoy(), j->>'habitacion', now(), public.mi_nombre())
    on conflict (propiedad, fecha, habitacion) do update
      set salieron_en = coalesce(public.equipo_habitaciones.salieron_en, excluded.salieron_en),
          salieron_por_nombre = coalesce(public.equipo_habitaciones.salieron_por_nombre, excluded.salieron_por_nombre);
  end if;
end $$;

-- Cobro: suma al pagado (sin pasarse del total). En Booking no (lo paga Booking con la VCC).
create or replace function public.equipo_cobrar(p_id text, p_monto numeric, p_forma text) returns void
language plpgsql security definer set search_path = public as $$
declare j jsonb; total numeric; pagado numeric;
begin
  j := public.equipo_puede_reserva(p_id, 'checkin');
  if coalesce(j->>'canal', '') ilike '%booking%' then raise exception 'Las reservas de Booking no se cobran desde aquí.'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'Falta el monto.'; end if;
  total := coalesce(nullif(j->>'monto', '')::numeric, 0);
  pagado := coalesce(nullif(j->>'monto_pagado', '')::numeric, 0);
  if pagado + p_monto > total then raise exception 'El cobro es mayor que el saldo.'; end if;
  execute format('update public.reservas set monto_pagado = %L, forma_pago = %L where id::text = %L',
                 (pagado + p_monto)::text, coalesce(nullif(p_forma, ''), 'Efectivo'), p_id);
end $$;

-- Contacto y documento (escáner, teléfono, fotos): solo estos datos
create or replace function public.equipo_contacto(p_id text, p_datos jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare k text; sets text := '';
  permitidos text[] := array['huesped', 'telefono', 'email', 'nacionalidad', 'tipo_doc', 'num_doc',
                             'url_ine_frente', 'url_ine_dorso', 'fecha_nacimiento', 'acompanantes'];
begin
  if not (public.tiene_permiso('checkin') or public.tiene_permiso('reservar')) then raise exception 'Sin permiso.'; end if;
  perform 1 from public.reservas r where r.id::text = p_id;
  if not found then raise exception 'No se encontró la reserva.'; end if;
  for k in select jsonb_object_keys(p_datos) loop
    if k = any(permitidos) and exists (select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'reservas' and column_name = k) then
      sets := sets || case when sets = '' then '' else ', ' end || format('%I = %L', k,
                case when jsonb_typeof(p_datos->k) in ('object', 'array') then (p_datos->k)::text else p_datos->>k end);
    end if;
  end loop;
  if sets = '' then return; end if;
  execute format('update public.reservas set %s where id::text = %L', sets, p_id);
end $$;

revoke all on function public.equipo_checkin(text) from public, anon;
revoke all on function public.equipo_checkout(text) from public, anon;
revoke all on function public.equipo_cobrar(text, numeric, text) from public, anon;
revoke all on function public.equipo_contacto(text, jsonb) from public, anon;
grant execute on function public.equipo_checkin(text) to authenticated;
grant execute on function public.equipo_checkout(text) to authenticated;
grant execute on function public.equipo_cobrar(text, numeric, text) to authenticated;
grant execute on function public.equipo_contacto(text, jsonb) to authenticated;

-- 7) Movimientos: lo que hace el equipo con reservas queda anotado (y avisa a los dueños)
create or replace function public.reservas_equipo_movimiento() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  n jsonb := to_jsonb(new);
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  t text;
  pag_n numeric := coalesce(nullif(n->>'monto_pagado', '')::numeric, 0);
  pag_o numeric := coalesce(nullif(o->>'monto_pagado', '')::numeric, 0);
  monto numeric := null;
begin
  if auth.uid() is null or public.es_dueno() then return null; end if;
  if tg_op = 'INSERT' then t := 'nueva'; monto := nullif(n->>'monto', '')::numeric;
  elsif (n->>'estado') is distinct from (o->>'estado') and n->>'estado' = 'hospedado' then t := 'checkin';
  elsif (n->>'estado') is distinct from (o->>'estado') and n->>'estado' = 'finalizada' then t := 'checkout';
  elsif (n->>'estado') is distinct from (o->>'estado') and n->>'estado' in ('cancelada', 'eliminada') then t := 'cancelacion';
  elsif pag_n > pag_o then t := 'cobro'; monto := pag_n - pag_o;
  elsif (n - 'modificado_por' - 'actualizado_en') is distinct from (o - 'modificado_por' - 'actualizado_en') then t := 'edicion';
  else return null;
  end if;
  insert into public.equipo_movimientos (propiedad, reserva_id, tipo, huesped, habitacion, fecha_ingreso, fecha_salida,
                                         canal, monto, pagado, forma_pago, por_nombre, por_usuario)
  values (coalesce(nullif(n->>'propiedad', ''), 'hostel'), n->>'id', t, n->>'huesped', n->>'habitacion',
          left(n->>'fecha_ingreso', 10), left(n->>'fecha_salida', 10), n->>'canal', monto,
          case when t = 'nueva' then pag_n end, n->>'forma_pago', public.mi_nombre(), auth.uid());
  return null;
end $$;
revoke all on function public.reservas_equipo_movimiento() from public, anon, authenticated;
drop trigger if exists reservas_equipo_movimiento on public.reservas;
create trigger reservas_equipo_movimiento after insert or update on public.reservas
  for each row execute function public.reservas_equipo_movimiento();

-- El movimiento avisa a los dueños (la app arma el texto; el check-out ya avisa como "Hab N: ya salieron")
drop trigger if exists equipo_aviso_movimiento on public.equipo_movimientos;
create trigger equipo_aviso_movimiento after insert on public.equipo_movimientos
  for each row when (new.tipo <> 'checkout') execute function public.equipo_aviso();

-- 8) Fotos de documentos: el equipo también las ve y las sube (escáner del check-in)
drop policy if exists "documentos: equipo ver" on storage.objects;
create policy "documentos: equipo ver" on storage.objects
  for select to authenticated using (bucket_id = 'documentos' and (public.tiene_permiso('checkin') or public.tiene_permiso('reservar')));
drop policy if exists "documentos: equipo subir" on storage.objects;
create policy "documentos: equipo subir" on storage.objects
  for insert to authenticated with check (bucket_id = 'documentos' and (public.tiene_permiso('checkin') or public.tiene_permiso('reservar')));

commit;

notify pgrst, 'reload schema';

-- Comprobar: tienen que salir la tabla de movimientos, las columnas nuevas y 5 funciones.
select 'tabla' as que, 'equipo_movimientos' as nombre where to_regclass('public.equipo_movimientos') is not null
union all select 'columna', column_name from information_schema.columns where table_name = 'reservas' and column_name in ('cargada_por', 'cargada_por_nombre')
union all select 'función', proname from pg_proc where proname in ('equipo_reservas_todas', 'equipo_checkin', 'equipo_checkout', 'equipo_cobrar', 'equipo_contacto');
