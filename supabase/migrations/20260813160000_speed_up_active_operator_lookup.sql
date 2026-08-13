-- A entrada operacional consulta apenas os operadores ativos da loja,
-- ordenados por nome. O indice parcial evita varrer todo o historico da equipe
-- sem alterar dados, permissoes ou o comportamento dos operadores existentes.
CREATE INDEX IF NOT EXISTS idx_waiters_active_user_name
  ON public.waiters (user_id, name)
  WHERE active IS TRUE;
