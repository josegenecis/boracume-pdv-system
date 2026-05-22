alter table public.whatsapp_marketing_campaigns
  add column if not exists product_id uuid,
  add column if not exists product_name text,
  add column if not exists product_price numeric,
  add column if not exists promo_image_url text;

alter table public.whatsapp_marketing_recipients
  add column if not exists promo_image_url text;

create index if not exists whatsapp_marketing_campaigns_product_idx
  on public.whatsapp_marketing_campaigns(user_id, product_id)
  where product_id is not null;
