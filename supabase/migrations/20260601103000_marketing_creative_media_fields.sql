alter table public.marketing_creatives
  add column if not exists logo_url text,
  add column if not exists generated_image_prompt text;

insert into public.marketing_creatives (
  campaign_id,
  format,
  type,
  image_url,
  logo_url,
  generated_image_prompt,
  headline,
  primary_text,
  description,
  cta,
  status
)
select
  campaign.id,
  creative.value->>'format',
  coalesce(creative.value->>'type', 'static'),
  creative.value->>'image_url',
  creative.value->>'logo_url',
  creative.value->>'generated_image_prompt',
  creative.value->>'headline',
  creative.value->>'primary_text',
  creative.value->>'description',
  coalesce(creative.value->>'cta', 'ORDER_NOW'),
  'draft'
from public.marketing_campaigns campaign
cross join lateral jsonb_array_elements(campaign.review_snapshot->'creatives') as creative(value)
where jsonb_typeof(campaign.review_snapshot->'creatives') = 'array'
  and not exists (
    select 1
    from public.marketing_creatives existing
    where existing.campaign_id = campaign.id
  );
