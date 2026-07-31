-- O cardápio digital é público. Banners ativos precisam permanecer visíveis
-- mesmo quando o visitante possui uma sessão autenticada de outra loja no
-- mesmo navegador. Políticas RLS são aplicadas pelo papel atual, portanto a
-- regra anterior (somente "anon") gerava desaparecimento intermitente.

drop policy if exists "Anon can read active banners" on public.promotional_banners;
drop policy if exists "Public can read active banners" on public.promotional_banners;

create policy "Public can read active banners"
  on public.promotional_banners for select
  to anon, authenticated
  using (
    active = true
    and (start_date is null or start_date <= now())
    and (end_date is null or end_date >= now())
  );
