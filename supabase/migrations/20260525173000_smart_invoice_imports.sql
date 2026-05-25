alter table public.ingredients
  add column if not exists subcategory text,
  add column if not exists stock_controlled boolean not null default true;

create table if not exists public.smart_invoice_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null default 'image' check (source_type in ('image', 'pdf')),
  supplier_name text,
  supplier_document text,
  invoice_number text,
  invoice_date date,
  total_amount numeric(12, 2) not null default 0,
  expense_category text not null default 'insumos',
  receipt_url text,
  raw_ai_response jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'committed', 'cancelled')),
  expense_id uuid references public.expenses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.smart_invoice_import_items (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.smart_invoice_imports(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  normalized_name text not null,
  category text not null default 'Insumos',
  subcategory text,
  quantity numeric(12, 3) not null default 1,
  unit text not null default 'un',
  unit_price numeric(12, 4) not null default 0,
  total_price numeric(12, 2) not null default 0,
  stock_unit text not null default 'un',
  confidence numeric(5, 2) not null default 0,
  similar_to text,
  control_stock boolean not null default true,
  ingredient_id uuid references public.ingredients(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.smart_invoice_imports enable row level security;
alter table public.smart_invoice_import_items enable row level security;

drop policy if exists "Owners can manage smart invoice imports" on public.smart_invoice_imports;
create policy "Owners can manage smart invoice imports"
  on public.smart_invoice_imports
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Owners can manage smart invoice import items" on public.smart_invoice_import_items;
create policy "Owners can manage smart invoice import items"
  on public.smart_invoice_import_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_smart_invoice_imports_user_created
  on public.smart_invoice_imports(user_id, created_at desc);

create index if not exists idx_smart_invoice_import_items_import
  on public.smart_invoice_import_items(import_id);
