alter table public.products
  add column if not exists receipt_ingredients_enabled boolean not null default false,
  add column if not exists receipt_ingredients text;

comment on column public.products.receipt_ingredients_enabled is 'Quando true, imprime os ingredientes fixos do produto no cupom.';
comment on column public.products.receipt_ingredients is 'Texto curto com ingredientes fixos a serem impressos no cupom.';
