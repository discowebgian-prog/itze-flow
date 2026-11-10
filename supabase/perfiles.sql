-- Itzé Flow · Perfiles y roles (paso 4, parte 1). Pegalo en Supabase › SQL Editor › Run.
-- Se puede correr más de una vez sin romper nada.
-- Todavía NO cambia qué puede leer cada uno: eso es la parte 3 (permisos por rol).

-- 1) Tabla de perfiles: qué rol tiene cada usuario
create table if not exists public.perfiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  nombre    text not null,
  rol       text not null check (rol in ('dueno', 'equipo', 'staff')),
  permisos  text[] not null default '{}',   -- solo para equipo: limpieza, cotizar, reservar, precio, checkin
  creado_en timestamptz not null default now()
);

-- 2) Ayudas para las reglas de la base (las usa la parte 3)
create or replace function public.es_dueno() returns boolean
language sql security definer set search_path = public stable as
$$ select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'dueno') $$;

create or replace function public.tiene_permiso(p text) returns boolean
language sql security definer set search_path = public stable as
$$ select exists (
     select 1 from public.perfiles
     where id = auth.uid() and (rol = 'dueno' or p = any(permisos))
   ) $$;

revoke all on function public.es_dueno() from public, anon;
revoke all on function public.tiene_permiso(text) from public, anon;
grant execute on function public.es_dueno() to authenticated;
grant execute on function public.tiene_permiso(text) to authenticated;

-- 3) Seguridad: cada uno lee su propio perfil; los dueños leen todos.
--    Nadie crea ni cambia perfiles desde la app (se hace acá, en Supabase).
alter table public.perfiles enable row level security;
drop policy if exists "perfiles: ver el propio o dueños" on public.perfiles;
create policy "perfiles: ver el propio o dueños" on public.perfiles
  for select to authenticated using (id = auth.uid() or public.es_dueno());

-- 4) El usuario que usan Gian y Marce queda como dueño.
--    Cambiá CORREO_DE_FLOW por el correo con el que entran a Flow (entre las comillas).
insert into public.perfiles (id, nombre, rol)
select id, 'Gian y Marce', 'dueno' from auth.users where email = 'CORREO_DE_FLOW'
on conflict (id) do update set rol = 'dueno';

-- 5) Comprobar: tiene que aparecer una fila con su correo y rol dueno.
select u.email, p.nombre, p.rol from public.perfiles p join auth.users u on u.id = p.id;
