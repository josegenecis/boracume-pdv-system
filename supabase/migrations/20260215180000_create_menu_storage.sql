
-- Create a public bucket for temporary menu imports
insert into storage.buckets (id, name, public)
values ('menu-imports', 'menu-imports', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload files
create policy "Authenticated users can upload menu images"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'menu-imports' );

-- Allow public access to read files (so OpenAI can access them)
create policy "Public access to menu images"
on storage.objects for select
to public
using ( bucket_id = 'menu-imports' );
