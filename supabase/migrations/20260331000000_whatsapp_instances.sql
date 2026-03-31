create table if not exists public.whatsapp_instances (
    id uuid primary key default gen_random_uuid(),
    restaurant_id uuid not null,
    instance_name text not null unique,
    status text not null default 'connecting',
    phone text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.whatsapp_instances enable row level security;

-- Policies
create policy "Users can view their own whatsapp instances"
    on public.whatsapp_instances for select
    using (auth.uid() = restaurant_id);

create policy "Users can insert their own whatsapp instances"
    on public.whatsapp_instances for insert
    with check (auth.uid() = restaurant_id);

create policy "Users can update their own whatsapp instances"
    on public.whatsapp_instances for update
    using (auth.uid() = restaurant_id);

create policy "Users can delete their own whatsapp instances"
    on public.whatsapp_instances for delete
    using (auth.uid() = restaurant_id);

-- Create updated_at trigger
create trigger set_whatsapp_instances_updated_at
    before update on public.whatsapp_instances
    for each row
    execute function public.handle_updated_at();
