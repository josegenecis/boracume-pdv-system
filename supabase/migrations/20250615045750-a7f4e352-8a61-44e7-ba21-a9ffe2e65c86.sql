-- Criar políticas para acesso aos sons personalizados (apenas se não existem)
DO $$ 
BEGIN
    -- Política para visualização pública
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Sounds are publicly accessible'
    ) THEN
        CREATE POLICY "Sounds are publicly accessible" 
        ON storage.objects 
        FOR SELECT 
        USING (bucket_id = 'user-sounds');
    END IF;

    -- Política para upload de usuários
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can upload their own sounds'
    ) THEN
        CREATE POLICY "Users can upload their own sounds" 
        ON storage.objects 
        FOR INSERT 
        WITH CHECK (bucket_id = 'user-sounds' AND auth.uid()::text = (storage.foldername(name))[1]);
    END IF;

    -- Política para atualização de usuários
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can update their own sounds'
    ) THEN
        CREATE POLICY "Users can update their own sounds" 
        ON storage.objects 
        FOR UPDATE 
        USING (bucket_id = 'user-sounds' AND auth.uid()::text = (storage.foldername(name))[1]);
    END IF;

    -- Política para remoção de usuários
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can delete their own sounds'
    ) THEN
        CREATE POLICY "Users can delete their own sounds" 
        ON storage.objects 
        FOR DELETE 
        USING (bucket_id = 'user-sounds' AND auth.uid()::text = (storage.foldername(name))[1]);
    END IF;
END $$;