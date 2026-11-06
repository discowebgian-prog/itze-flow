-- ── FOTOS DE DOCUMENTOS PRIVADAS ──────────────────────────────────────────────
-- Correr en Supabase > SQL Editor SOLO DESPUÉS de publicar en main el cambio
-- que abre las fotos con enlace temporal (PR "Fotos de documentos privadas").
--
-- Qué hace:
--   1. Permite ver y subir fotos del bucket "documentos" solo con sesión iniciada.
--   2. Pasa el bucket a privado: los enlaces públicos dejan de abrir.
--
-- Para volver atrás (si algo falla):
--   update storage.buckets set public = true where id = 'documentos';

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'documentos: ver con sesion'
  ) then
    create policy "documentos: ver con sesion"
      on storage.objects for select
      to authenticated
      using (bucket_id = 'documentos');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'documentos: subir con sesion'
  ) then
    create policy "documentos: subir con sesion"
      on storage.objects for insert
      to authenticated
      with check (bucket_id = 'documentos');
  end if;
end $$;

update storage.buckets set public = false where id = 'documentos';

-- Comprobación: tiene que decir public = false
select id, public from storage.buckets where id = 'documentos';
