alter table public.printer_settings
  add column if not exists receipt_logo_url text;
