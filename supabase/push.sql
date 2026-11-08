-- Avisos con la app cerrada (notificaciones del celular).
-- Cada aparato que toca "🔔 Activar avisos" guarda acá su suscripción del navegador.
-- quien = nombre de "¿Quién usa este dispositivo?" (para no avisarle a quien hizo el cambio).
-- Correr una vez en Supabase → SQL Editor.
create table if not exists public.push_subs (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  quien text default '',
  creado_en timestamptz default now(),
  actualizado_en timestamptz default now()
);

alter table public.push_subs enable row level security;

-- Solo usuarios con sesión (como el resto de las tablas)
drop policy if exists "push_subs: ver con sesion" on public.push_subs;
create policy "push_subs: ver con sesion" on public.push_subs for select to authenticated using (true);
drop policy if exists "push_subs: crear con sesion" on public.push_subs;
create policy "push_subs: crear con sesion" on public.push_subs for insert to authenticated with check (true);
drop policy if exists "push_subs: cambiar con sesion" on public.push_subs;
create policy "push_subs: cambiar con sesion" on public.push_subs for update to authenticated using (true) with check (true);
drop policy if exists "push_subs: borrar con sesion" on public.push_subs;
create policy "push_subs: borrar con sesion" on public.push_subs for delete to authenticated using (true);
