alter table public.poppay_oauth_states
  add column if not exists code_verifier text;

