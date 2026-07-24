alter table public.poppay_oauth_states
  add column if not exists enable_pix boolean not null default true,
  add column if not exists enable_credit_online boolean not null default true,
  add column if not exists terms_version text;

comment on column public.poppay_oauth_states.enable_pix is
  'Canal PIX escolhido no aceite que iniciou a autorizacao OAuth.';

comment on column public.poppay_oauth_states.enable_credit_online is
  'Canal de credito online escolhido no aceite que iniciou a autorizacao OAuth.';
