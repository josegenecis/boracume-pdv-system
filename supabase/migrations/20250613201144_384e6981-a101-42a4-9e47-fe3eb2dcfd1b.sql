-- Adicionar campos de localização à tabela orders
ALTER TABLE public.orders 
ADD COLUMN customer_latitude DECIMAL(10, 8),
ADD COLUMN customer_longitude DECIMAL(11, 8),
ADD COLUMN customer_location_accuracy INTEGER,
ADD COLUMN google_maps_link TEXT;