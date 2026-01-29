-- Add optional fields to enhance delivery zones definition
ALTER TABLE public.delivery_zones
  ADD COLUMN IF NOT EXISTS zone_type text CHECK (zone_type IN ('neighborhood','polygon','radius','distance_km')),
  ADD COLUMN IF NOT EXISTS center_lat double precision,
  ADD COLUMN IF NOT EXISTS center_lng double precision,
  ADD COLUMN IF NOT EXISTS radius_km double precision,
  ADD COLUMN IF NOT EXISTS max_distance_km double precision,
  ADD COLUMN IF NOT EXISTS polygon_geojson jsonb;

-- Indexes for geospatial queries (basic)
CREATE INDEX IF NOT EXISTS delivery_zones_zone_type_idx ON public.delivery_zones(zone_type);
