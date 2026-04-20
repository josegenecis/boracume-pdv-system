alter table public.printer_settings
  add column if not exists print_kitchen_ticket boolean not null default false;
