-- ── FOTOS DE DOCUMENTOS PRIVADAS ──────────────────────────────────────────────
-- Corrido en Supabase > SQL Editor el 5 nov 2026, después de publicar el PR #14
-- (la app abre las fotos con enlace temporal firmado).
--
-- Qué hizo:
--   1. Borró los dos permisos que dejaban subir y reemplazar archivos a cualquiera
--      (rol public, sin condición, valían para todas las carpetas).
--   2. Permite ver y subir fotos del bucket "documentos" solo con sesión iniciada.
--   3. Pasó el bucket a privado: los enlaces públicos responden "Bucket not found".
--
-- Para volver atrás (si algo falla):
--   update storage.buckets set public = true where id = 'documentos';

-- 1. Permisos abiertos a cualquiera
drop policy if exists "Permitir subidas 1ljx2yn_1" on storage.objects; -- INSERT, public
drop policy if exists "Permitir subidas 1ljx2yn_2" on storage.objects; -- UPDATE, public

-- 2. Ver y subir solo con sesión
create policy "documentos: ver con sesion"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documentos');

create policy "documentos: subir con sesion"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documentos');

-- 3. Bucket privado
update storage.buckets set public = false where id = 'documentos';

-- Comprobación: documentos tiene que decir public = false
select id, public from storage.buckets;
