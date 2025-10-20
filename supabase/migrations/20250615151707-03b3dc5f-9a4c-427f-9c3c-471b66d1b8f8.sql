-- Recriar a função handle_new_user com melhor tratamento de conflitos
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create profile for new user with conflict handling
  INSERT INTO public.profiles (id, created_at, updated_at)
  VALUES (new.id, now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- Create trial subscription for new user with conflict handling
  INSERT INTO public.subscriptions (
    user_id,
    status,
    trial_start,
    trial_end,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    'trialing',
    now(),
    now() + interval '7 days',
    now(),
    now()
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Garantir que o trigger está ativo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();