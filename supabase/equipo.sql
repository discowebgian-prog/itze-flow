-- Itzé Flow · Equipo (paso 5, parte 1): la base de lo que hoy es Itzé Limpieza, dentro de Flow.
-- Pegalo en Supabase › SQL Editor › Run. Se puede correr más de una vez sin romper nada.
-- Antes: perfiles.sql y permisos_por_rol.sql (usa es_dueno() y tiene_permiso()).
-- Para volver atrás: supabase/equipo_volver_atras.sql. Para comprobar: supabase/equipo_comprobar.sql.
--
-- Quién puede qué (igual que en Limpieza, con un hueco cerrado):
--   · Ven todo: los dueños y el equipo con el permiso "limpieza" (Mary).
--   · Tareas, rutinas, programadas y mensajes para Mary: solo dueños.
--   · Mary: crea sus notas ("Anotar lo que vi"), corrige o borra las suyas, y marca hecho / Entendido.
--     En Limpieza podía cambiar por dentro cualquier tarea; acá la base solo le deja tocar el "hecho".
--   · Insumos: Mary avisa que falta; reponer y borrar, solo dueños.
--   · Día (empezó / cerró) y habitaciones del día (salieron / lista): dueños y Mary.
-- Todo con "propiedad" (por ahora 'hostel', como las reservas) para cuando haya más de una.

begin;  -- todo junto: si algo falla, no cambia nada

-- 0) Freno: hacen falta los perfiles del paso 4
do $$
begin
  if to_regprocedure('public.es_dueno()') is null or to_regprocedure('public.tiene_permiso(text)') is null then
    raise exception 'Faltan los perfiles: corré primero supabase/perfiles.sql.';
  end if;
end $$;

-- Hoy en Progreso (la base está en UTC)
create or replace function public.equipo_hoy() returns date
language sql stable as $$ select (now() at time zone 'America/Merida')::date $$;

-- 1) Tareas: de hoy, rutina diaria, mensajes (de dueños para Mary y notas de Mary) y programadas
create table if not exists public.equipo_tareas (
  id                 uuid primary key default gen_random_uuid(),
  propiedad          text not null default 'hostel',
  texto              text not null check (length(texto) between 1 and 300),
  zona               text not null default '',          -- "Hab 3 · Cocina" (vacío = sin lugar)
  tipo               text not null check (tipo in ('hoy', 'rutina', 'mensaje', 'programada')),
  fecha              date not null default public.equipo_hoy(),
  hecha              boolean not null default false,    -- hoy / mensaje (Entendido, Atendido)
  hecha_fecha        date,                              -- rutina: último día que se marcó
  hecha_en           timestamptz,
  hecha_por_nombre   text,
  de_rol             text not null default 'dueno' check (de_rol in ('dueno', 'equipo')),  -- lo pone la base
  creada_por         uuid default auth.uid(),
  creada_por_nombre  text,                              -- "Gian", "Marce", "Mary"
  creada_en          timestamptz not null default now(),
  foto               text,                              -- ruta en el bucket equipo_fotos
  orden              integer,
  editada_en         timestamptz,
  editada_por_rol    text check (editada_por_rol in ('dueno', 'equipo')),
  editada_por_nombre text,
  dias_semana        smallint[],                        -- programada: 0 = domingo … 6 = sábado (vacío = un solo día)
  plantilla_id       uuid references public.equipo_tareas(id) on delete set null  -- copia de una programada
);
create index if not exists equipo_tareas_fecha_idx on public.equipo_tareas (propiedad, fecha);
create unique index if not exists equipo_tareas_copia_unica on public.equipo_tareas (plantilla_id, fecha) where plantilla_id is not null;

-- 2) El día de Mary: cuándo empezó y cuándo cerró
create table if not exists public.equipo_dias (
  propiedad          text not null default 'hostel',
  fecha              date not null,
  empezo_en          timestamptz,
  cerrado            boolean not null default false,
  cerrado_en         timestamptz,
  cerrado_por_nombre text,
  pendientes         integer not null default 0,
  primary key (propiedad, fecha)
);

-- 3) Insumos que faltan
create table if not exists public.equipo_insumos (
  id                uuid primary key default gen_random_uuid(),
  propiedad         text not null default 'hostel',
  nombre            text not null check (length(nombre) between 1 and 60),
  sector            text not null default 'otros' check (sector in ('banos', 'cocina', 'pisos', 'bolsas', 'otros')),
  urgente           boolean not null default false,     -- true = "ya se acabó"; false = "queda poco"
  estado            text not null default 'falta' check (estado in ('falta', 'repuesto')),
  de_rol            text not null default 'equipo' check (de_rol in ('dueno', 'equipo')),
  creado_por        uuid default auth.uid(),
  creado_por_nombre text,
  creado_en         timestamptz not null default now(),
  repuesto_en       timestamptz,
  repuesto_por_nombre text
);

-- 4) Habitaciones del día: lo que marca el equipo (quién está y quién llega sale de las reservas)
create table if not exists public.equipo_habitaciones (
  propiedad          text not null default 'hostel',
  fecha              date not null,
  habitacion         text not null,                     -- 'P1' … como en las reservas
  salieron_en        timestamptz,
  salieron_por_rol   text check (salieron_por_rol in ('dueno', 'equipo')),
  salieron_por_nombre text,
  lista_en           timestamptz,
  lista_por_rol      text check (lista_por_rol in ('dueno', 'equipo')),
  lista_por_nombre   text,
  sabanas            boolean,                           -- cambio de sábanas forzado (vacío = automático cada 5 días)
  actualizado_en     timestamptz not null default now(),
  primary key (propiedad, fecha, habitacion)
);

-- 5) La base completa quién hizo qué (no se confía en lo que manda el aparato)
create or replace function public.equipo_firmar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rol text := case when public.es_dueno() then 'dueno' else 'equipo' end;
begin
  if auth.uid() is null then return new; end if;  -- tareas automáticas de la base (programadas)
  if tg_table_name = 'equipo_tareas' then
    if tg_op = 'INSERT' then
      new.de_rol := rol; new.creada_por := auth.uid();
    else
      new.de_rol := old.de_rol; new.creada_por := old.creada_por; new.creada_en := old.creada_en;
      if new.editada_en is distinct from old.editada_en then new.editada_por_rol := rol; end if;
      -- Mary solo toca el "hecho"; en sus propias notas, también el texto, el lugar y la foto
      if rol = 'equipo' then
        if (old.de_rol = 'equipo' and old.tipo = 'mensaje' and old.creada_por = auth.uid()) then
          if (new.tipo, new.fecha, new.orden, new.dias_semana, new.plantilla_id, new.propiedad)
             is distinct from (old.tipo, old.fecha, old.orden, old.dias_semana, old.plantilla_id, old.propiedad) then
            raise exception 'El equipo solo puede corregir el texto, el lugar y la foto de sus notas.';
          end if;
        elsif (new.texto, new.zona, new.tipo, new.fecha, new.foto, new.orden, new.dias_semana, new.plantilla_id,
               new.propiedad, new.editada_en, new.creada_por_nombre)
              is distinct from (old.texto, old.zona, old.tipo, old.fecha, old.foto, old.orden, old.dias_semana,
               old.plantilla_id, old.propiedad, old.editada_en, old.creada_por_nombre) then
          raise exception 'El equipo solo puede marcar esta tarea como hecha.';
        end if;
      end if;
    end if;
  elsif tg_table_name = 'equipo_insumos' then
    if tg_op = 'INSERT' then new.de_rol := rol; new.creado_por := auth.uid(); end if;
  elsif tg_table_name = 'equipo_habitaciones' then
    if new.salieron_en is distinct from old.salieron_en then new.salieron_por_rol := case when new.salieron_en is null then null else rol end; end if;
    if new.lista_en is distinct from old.lista_en then new.lista_por_rol := case when new.lista_en is null then null else rol end; end if;
    new.actualizado_en := now();
  end if;
  return new;
end $$;

-- En habitaciones, un insert también tiene que firmar (old no existe)
create or replace function public.equipo_firmar_hab_nueva() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rol text := case when public.es_dueno() then 'dueno' else 'equipo' end;
begin
  if auth.uid() is null then return new; end if;
  new.salieron_por_rol := case when new.salieron_en is null then null else rol end;
  new.lista_por_rol := case when new.lista_en is null then null else rol end;
  new.actualizado_en := now();
  return new;
end $$;

drop trigger if exists equipo_tareas_firmar on public.equipo_tareas;
create trigger equipo_tareas_firmar before insert or update on public.equipo_tareas
  for each row execute function public.equipo_firmar();
drop trigger if exists equipo_insumos_firmar on public.equipo_insumos;
create trigger equipo_insumos_firmar before insert on public.equipo_insumos
  for each row execute function public.equipo_firmar();
drop trigger if exists equipo_habitaciones_firmar on public.equipo_habitaciones;
create trigger equipo_habitaciones_firmar before update on public.equipo_habitaciones
  for each row execute function public.equipo_firmar();
drop trigger if exists equipo_habitaciones_firmar_nueva on public.equipo_habitaciones;
create trigger equipo_habitaciones_firmar_nueva before insert on public.equipo_habitaciones
  for each row execute function public.equipo_firmar_hab_nueva();

-- 6) Reglas
alter table public.equipo_tareas       enable row level security;
alter table public.equipo_dias         enable row level security;
alter table public.equipo_insumos      enable row level security;
alter table public.equipo_habitaciones enable row level security;

do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies where schemaname = 'public'
    and tablename in ('equipo_tareas', 'equipo_dias', 'equipo_insumos', 'equipo_habitaciones')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- Tareas
create policy "equipo_tareas: ver" on public.equipo_tareas
  for select to authenticated using (public.tiene_permiso('limpieza'));
create policy "equipo_tareas: crear" on public.equipo_tareas
  for insert to authenticated with check (
    public.es_dueno() or (public.tiene_permiso('limpieza') and tipo = 'mensaje' and plantilla_id is null and dias_semana is null));
create policy "equipo_tareas: cambiar" on public.equipo_tareas
  for update to authenticated using (public.tiene_permiso('limpieza')) with check (public.tiene_permiso('limpieza'));
create policy "equipo_tareas: borrar" on public.equipo_tareas
  for delete to authenticated using (
    public.es_dueno() or (public.tiene_permiso('limpieza') and de_rol = 'equipo' and tipo = 'mensaje' and creada_por = auth.uid()));

-- Día
create policy "equipo_dias: ver" on public.equipo_dias
  for select to authenticated using (public.tiene_permiso('limpieza'));
create policy "equipo_dias: crear" on public.equipo_dias
  for insert to authenticated with check (public.tiene_permiso('limpieza'));
create policy "equipo_dias: cambiar" on public.equipo_dias
  for update to authenticated using (public.tiene_permiso('limpieza')) with check (public.tiene_permiso('limpieza'));
create policy "equipo_dias: borrar" on public.equipo_dias
  for delete to authenticated using (public.es_dueno());

-- Insumos
create policy "equipo_insumos: ver" on public.equipo_insumos
  for select to authenticated using (public.tiene_permiso('limpieza'));
create policy "equipo_insumos: avisar" on public.equipo_insumos
  for insert to authenticated with check (public.tiene_permiso('limpieza') and estado = 'falta');
create policy "equipo_insumos: reponer" on public.equipo_insumos
  for update to authenticated using (public.es_dueno()) with check (public.es_dueno());
create policy "equipo_insumos: borrar" on public.equipo_insumos
  for delete to authenticated using (public.es_dueno());

-- Habitaciones del día
create policy "equipo_habitaciones: ver" on public.equipo_habitaciones
  for select to authenticated using (public.tiene_permiso('limpieza'));
create policy "equipo_habitaciones: crear" on public.equipo_habitaciones
  for insert to authenticated with check (public.tiene_permiso('limpieza'));
create policy "equipo_habitaciones: cambiar" on public.equipo_habitaciones
  for update to authenticated using (public.tiene_permiso('limpieza')) with check (public.tiene_permiso('limpieza'));
create policy "equipo_habitaciones: borrar" on public.equipo_habitaciones
  for delete to authenticated using (public.es_dueno());

-- 7) Programadas: cada día se copian a "Tareas de hoy" (las de un solo día se borran al copiarse).
--    La llama el reloj de la base a las 00:05 de Progreso y la app al abrir (por las dudas; no repite).
create or replace function public.equipo_programadas_hoy() returns integer
language plpgsql security definer set search_path = public as $$
declare
  hoy date := public.equipo_hoy();
  dow smallint := extract(dow from public.equipo_hoy())::smallint;
  n integer := 0;
  p record;
begin
  if auth.uid() is not null and not public.tiene_permiso('limpieza') then return 0; end if;
  for p in
    select * from public.equipo_tareas
    where tipo = 'programada'
      and ((coalesce(array_length(dias_semana, 1), 0) > 0 and dow = any(dias_semana) and fecha <= hoy)
        or (coalesce(array_length(dias_semana, 1), 0) = 0 and fecha = hoy))
  loop
    insert into public.equipo_tareas (propiedad, texto, zona, tipo, fecha, de_rol, creada_por, creada_por_nombre, foto, plantilla_id)
    values (p.propiedad, p.texto, p.zona, 'hoy', hoy, 'dueno', p.creada_por, p.creada_por_nombre, p.foto, p.id)
    on conflict (plantilla_id, fecha) where plantilla_id is not null do nothing;
    if found then n := n + 1; end if;
    if coalesce(array_length(p.dias_semana, 1), 0) = 0 then
      delete from public.equipo_tareas where id = p.id;  -- un solo día: ya está copiada
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.equipo_programadas_hoy() from public, anon;
grant execute on function public.equipo_programadas_hoy() to authenticated;
revoke all on function public.equipo_firmar() from public, anon, authenticated;
revoke all on function public.equipo_firmar_hab_nueva() from public, anon, authenticated;

-- 8) Tiempo real (los cambios de Mary se ven al instante y al revés)
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['equipo_tareas', 'equipo_dias', 'equipo_insumos', 'equipo_habitaciones'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- 9) Fotos de las tareas: bucket privado (en Limpieza era público); se abren con enlace temporal
insert into storage.buckets (id, name, public) values ('equipo_fotos', 'equipo_fotos', false)
on conflict (id) do update set public = false;
drop policy if exists "equipo_fotos: ver" on storage.objects;
create policy "equipo_fotos: ver" on storage.objects
  for select to authenticated using (bucket_id = 'equipo_fotos' and public.tiene_permiso('limpieza'));
drop policy if exists "equipo_fotos: subir" on storage.objects;
create policy "equipo_fotos: subir" on storage.objects
  for insert to authenticated with check (bucket_id = 'equipo_fotos' and public.tiene_permiso('limpieza'));
drop policy if exists "equipo_fotos: borrar" on storage.objects;
create policy "equipo_fotos: borrar" on storage.objects
  for delete to authenticated using (bucket_id = 'equipo_fotos' and (public.es_dueno() or owner = auth.uid()));

commit;

-- 10) Reloj: copiar las programadas a las 00:05 de Progreso (06:05 UTC). Fuera de la transacción.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
select cron.unschedule('equipo-programadas') where exists (select 1 from cron.job where jobname = 'equipo-programadas');
select cron.schedule('equipo-programadas', '5 6 * * *', 'select public.equipo_programadas_hoy();');

-- 11) Comprobar: tienen que aparecer las 4 tablas, el bucket y la tarea del reloj.
select 'tabla' as que, tablename as nombre from pg_tables where schemaname = 'public' and tablename like 'equipo_%'
union all select 'bucket', id from storage.buckets where id = 'equipo_fotos'
union all select 'reloj', jobname from cron.job where jobname = 'equipo-programadas';
