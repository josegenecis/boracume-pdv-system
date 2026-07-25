alter table public.table_order_flow_settings
  alter column table_order_mode set default 'all_items',
  alter column show_table_orders_in_manager set default true,
  alter column auto_accept_table_orders set default true;

comment on column public.table_order_flow_settings.table_order_mode is
  'Fluxo dos itens de mesa. O padrão envia todos ao gestor e à cozinha; restaurantes podem optar por itens marcados ou somente conta.';
