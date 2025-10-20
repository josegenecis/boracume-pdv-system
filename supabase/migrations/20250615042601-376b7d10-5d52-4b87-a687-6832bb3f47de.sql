-- Tornar o bucket user-sounds público para permitir acesso às URLs
UPDATE storage.buckets 
SET public = true 
WHERE id = 'user-sounds';

-- Atualizar políticas para permitir acesso público aos arquivos
DROP POLICY IF EXISTS "Users can view their own sounds" ON storage.objects;

CREATE POLICY "Users can view their own sounds" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'user-sounds' AND (auth.uid()::text = (storage.foldername(name))[1] OR bucket_id = 'user-sounds'));

-- Política para acesso público de leitura aos sons
CREATE POLICY "Public access to user sounds" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'user-sounds');