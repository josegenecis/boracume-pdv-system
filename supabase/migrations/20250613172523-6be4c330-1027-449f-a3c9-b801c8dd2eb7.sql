-- Criar tabela separada para variações globais
CREATE TABLE public.global_variations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  max_selections INTEGER NOT NULL DEFAULT 1,
  required BOOLEAN NOT NULL DEFAULT false,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.global_variations ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own global variations" 
ON public.global_variations 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own global variations" 
ON public.global_variations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own global variations" 
ON public.global_variations 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own global variations" 
ON public.global_variations 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_global_variations_updated_at
BEFORE UPDATE ON public.global_variations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();