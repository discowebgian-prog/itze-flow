-- Itzé Flow · Volver atrás los permisos por rol (deshace permisos_por_rol.sql).
-- Deja todo como antes: cualquiera con sesión lee y cambia reservas, gastos, decisiones, avisos y tarifas,
-- y ve y sube fotos de documentos. La tabla perfiles queda (no molesta).

begin;  -- todo junto: si algo falla, no cambia nada

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

create policy "reservas: con sesion" on public.reservas
  for all to authenticated using (true) with check (true);
create policy "gastos: con sesion" on public.gastos
  for all to authenticated using (true) with check (true);
create policy "huespedes_decisiones: con sesion" on public.huespedes_decisiones
  for all to authenticated using (true) with check (true);
create policy "push_subs: con sesion" on public.push_subs
  for all to authenticated using (true) with check (true);
create policy "tarifas: con sesion" on public.tarifas
  for all to authenticated using (true) with check (true);

drop policy if exists "documentos: ver solo dueños" on storage.objects;
drop policy if exists "documentos: subir solo dueños" on storage.objects;
drop policy if exists "documentos: ver con sesion" on storage.objects;
drop policy if exists "documentos: subir con sesion" on storage.objects;
create policy "documentos: ver con sesion" on storage.objects
  for select to authenticated using (bucket_id = 'documentos');
create policy "documentos: subir con sesion" on storage.objects
  for insert to authenticated with check (bucket_id = 'documentos');

commit;
