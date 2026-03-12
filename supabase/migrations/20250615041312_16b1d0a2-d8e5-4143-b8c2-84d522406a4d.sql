-- Criar bucket para sons personalizados dos usuários
INSERT INTO storage.buckets (id, name, public) VALUES ('user-sounds', 'user-sounds', false);

-- Criar políticas para o bucket user-sounds
CREATE POLICY "Users can upload their own sounds" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'user-sounds' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own sounds" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'user-sounds' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own sounds" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'user-sounds' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own sounds" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'user-sounds' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Adicionar colunas para URLs dos sons personalizados na tabela notification_settings
ALTER TABLE public.notification_settings 
ADD COLUMN custom_bell_url text,
ADD COLUMN custom_chime_url text,
ADD COLUMN custom_ding_url text,
ADD COLUMN custom_notification_url text;