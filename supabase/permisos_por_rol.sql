-- Itzé Flow · Permisos por rol (paso 4, parte 3). Pegalo en Supabase › SQL Editor › Run.
-- Antes: cualquiera con sesión leía y cambiaba todo. Después: solo los dueños (perfiles.rol = 'dueno').
-- El equipo (Mary) no lee reservas, gastos ni decisiones; ve las tarifas pero no las cambia.
-- Lo que el equipo necesite de las reservas (habitaciones de hoy, disponibilidad, sus reservas)
-- llega más adelante por funciones de la base sin montos (pasos 5, 6 y 9 del plan).
-- Rige apenas se corre, también para la app publicada: antes, perfiles.sql y su usuario como dueño.
-- Para volver atrás: supabase/permisos_volver_atras.sql.

begin;  -- todo junto: si algo falla, no cambia nada

-- 0) Freno de seguridad: si no hay ningún dueño en perfiles, no cambia nada.
do $$
begin
  if not exists (select 1 from public.perfiles where rol = 'dueno') then
    raise exception 'No hay ningún dueño en perfiles: corré primero supabase/perfiles.sql con su correo.';
  end if;
end $$;

-- 1) Sacar las reglas de antes ("con sesión") de las tablas de Flow
do $$
declare p record;
begin
  for p in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('reservas', 'gastos', 'huespedes_decisiones', 'tarifas', 'push_subs')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- 2) Reservas, gastos, decisiones de huéspedes y avisos del celular: solo dueños
alter table public.reservas             enable row level security;
alter table public.gastos               enable row level security;
alter table public.huespedes_decisiones enable row level security;
alter table public.push_subs            enable row level security;
alter table public.tarifas              enable row level security;

create policy "reservas: solo dueños" on public.reservas
  for all to authenticated using (public.es_dueno()) with check (public.es_dueno());
create policy "gastos: solo dueños" on public.gastos
  for all to authenticated using (public.es_dueno()) with check (public.es_dueno());
create policy "huespedes_decisiones: solo dueños" on public.huespedes_decisiones
  for all to authenticated using (public.es_dueno()) with check (public.es_dueno());
create policy "push_subs: solo dueños" on public.push_subs
  for all to authenticated using (public.es_dueno()) with check (public.es_dueno());

-- 3) Tarifas: las ven todos los que tienen sesión (Libres hoy muestra el precio); las cambian los dueños
create policy "tarifas: ver con sesion" on public.tarifas
  for select to authenticated using (true);
create policy "tarifas: crear solo dueños" on public.tarifas
  for insert to authenticated with check (public.es_dueno());
create policy "tarifas: cambiar solo dueños" on public.tarifas
  for update to authenticated using (public.es_dueno()) with check (public.es_dueno());
create policy "tarifas: borrar solo dueños" on public.tarifas
  for delete to authenticated using (public.es_dueno());

-- 4) Fotos de documentos (bucket documentos): ver y subir solo dueños
drop policy if exists "documentos: ver con sesion" on storage.objects;
drop policy if exists "documentos: subir con sesion" on storage.objects;
drop policy if exists "documentos: ver solo dueños" on storage.objects;
drop policy if exists "documentos: subir solo dueños" on storage.objects;
create policy "documentos: ver solo dueños" on storage.objects
  for select to authenticated using (bucket_id = 'documentos' and public.es_dueno());
create policy "documentos: subir solo dueños" on storage.objects
  for insert to authenticated with check (bucket_id = 'documentos' and public.es_dueno());

commit;

-- 5) Cómo quedó: una fila por regla
select tablename as tabla, policyname as regla, cmd as que
from pg_policies
where (schemaname = 'public' and tablename in ('reservas', 'gastos', 'huespedes_decisiones', 'tarifas', 'push_subs', 'perfiles'))
   or (schemaname = 'storage' and policyname like 'documentos:%')
order by 1, 2;
