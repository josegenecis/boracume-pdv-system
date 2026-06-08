alter table public.marketing_creatives
  add column if not exists source_product_image_url text,
  add column if not exists variation text,
  add column if not exists mode text,
  add column if not exists warning text,
  add column if not exists image_error text;

insert into public.marketing_creatives (
  campaign_id,
  format,
  type,
  image_url,
  video_url,
  logo_url,
  generated_image_prompt,
  source_product_image_url,
  variation,
  mode,
  warning,
  image_error,
  headline,
  primary_text,
  description,
  cta,
  status
)
select
  campaign.id,
  creative.value->>'format',
  coalesce(creative.value->>'type', 'ai_ad_creative'),
  creative.value->>'image_url',
  creative.value->>'video_url',
  creative.value->>'logo_url',
  creative.value->>'generated_image_prompt',
  creative.value->>'source_product_image_url',
  creative.value->>'variation',
  creative.value->>'mode',
  creative.value->>'warning',
  creative.value->>'image_error',
  creative.value->>'headline',
  creative.value->>'primary_text',
  creative.value->>'description',
  coalesce(creative.value->>'cta', 'ORDER_NOW'),
  'draft'
from public.marketing_campaigns campaign
cross join lateral jsonb_array_elements(campaign.review_snapshot->'creatives') as creative(value)
where jsonb_typeof(campaign.review_snapshot->'creatives') = 'array'
  and coalesce(creative.value->>'image_url', '') <> ''
  and not exists (
    select 1
    from public.marketing_creatives existing
    where existing.campaign_id = campaign.id
      and existing.format = creative.value->>'format'
      and coalesce(existing.variation, '') = coalesce(creative.value->>'variation', '')
      and coalesce(existing.image_url, '') = coalesce(creative.value->>'image_url', '')
  );
