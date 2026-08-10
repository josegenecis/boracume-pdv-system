-- Assistente de migracao de sistemas legados.
-- Os arquivos ficam privados e cada execucao mantem auditoria e referencias
-- externas para que uma repeticao nao duplique vendas ou cadastros.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'data-imports',
  'data-imports',
  false,
  52428800,
  array[
    'text/csv',
    'text/plain',
    'application/json',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.data_import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('upload', 'url')),
  source_name text not null,
  source_system text not null,
  source_fingerprint text,
  storage_path text,
  source_url text,
  status text not null default 'analyzing' check (status in ('analyzing', 'ready', 'importing', 'completed', 'failed')),
  analysis jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.data_import_external_refs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.data_import_jobs(id) on delete cascade,
  source_system text not null,
  entity_type text not null check (entity_type in ('category', 'product', 'customer', 'order')),
  external_id text not null,
  internal_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, source_system, entity_type, external_id)
);

create index if not exists data_import_jobs_user_created_idx
  on public.data_import_jobs(user_id, created_at desc);
create index if not exists data_import_refs_lookup_idx
  on public.data_import_external_refs(user_id, source_system, entity_type, external_id);

alter table public.data_import_jobs enable row level security;
alter table public.data_import_external_refs enable row level security;

drop policy if exists data_import_jobs_store_access on public.data_import_jobs;
create policy data_import_jobs_store_access on public.data_import_jobs
  for select to authenticated
  using (public.can_access_store(user_id));

drop policy if exists data_import_refs_store_access on public.data_import_external_refs;
create policy data_import_refs_store_access on public.data_import_external_refs
  for select to authenticated
  using (public.can_access_store(user_id));

drop policy if exists data_import_files_insert on storage.objects;
create policy data_import_files_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'data-imports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists data_import_files_select on storage.objects;
create policy data_import_files_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'data-imports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists data_import_files_delete on storage.objects;
create policy data_import_files_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'data-imports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

comment on table public.data_import_jobs is 'Auditoria dos arquivos analisados e importados pelo assistente de migracao.';
comment on table public.data_import_external_refs is 'Vinculos entre IDs do sistema legado e IDs PopSystem para deduplicacao.';
