
-- Create table_accounts table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.table_accounts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    table_id uuid NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
    items jsonb NOT NULL DEFAULT '[]'::jsonb,
    total numeric NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'open',
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    
    -- Ensure only one open account per table
    UNIQUE(table_id, status) DEFERRABLE INITIALLY DEFERRED
);

-- Add RLS policies
ALTER TABLE public.table_accounts ENABLE ROW LEVEL SECURITY;

-- Policy for users to manage their own table accounts
CREATE POLICY "Users can manage their own table accounts" ON public.table_accounts
    FOR ALL USING (auth.uid() = user_id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_table_accounts_user_id ON public.table_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_table_accounts_table_id ON public.table_accounts(table_id);
CREATE INDEX IF NOT EXISTS idx_table_accounts_status ON public.table_accounts(status);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_table_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_table_accounts_updated_at
    BEFORE UPDATE ON public.table_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_table_accounts_updated_at();
