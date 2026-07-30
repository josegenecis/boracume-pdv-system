-- Permite configurar a cor dos precos do Totem sem vincula-la aos botoes.

alter table public.totem_settings
  add column if not exists price_color text not null default '#EF6C20';
