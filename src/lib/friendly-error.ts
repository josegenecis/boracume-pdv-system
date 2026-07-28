type ErrorLike = {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
};

const textFromError = (error: unknown): string => {
  if (typeof error === 'string') return error.trim();
  if (error instanceof Error) return error.message.trim();
  if (!error || typeof error !== 'object') return '';

  const value = error as ErrorLike;
  return [value.message, value.details, value.hint]
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .join(' ')
    .trim();
};

const looksTechnical = (message: string) =>
  /(?:schema cache|pgrst\d+|postgres|supabase|edge function|foreign key|constraint|duplicate key|row-level security|jwt|unauthorized|permission denied|invalid input syntax|relation ".+"|column ".+"|failed to fetch|networkerror|typeerror|cannot read propert|non-2xx|http \d{3}|sqlstate|violates)/i.test(
    message,
  );

export function friendlyErrorMessage(
  error: unknown,
  fallback = 'Não foi possível concluir esta ação. Tente novamente.',
): string {
  const raw = textFromError(error).replace(/^(?:error|erro):\s*/i, '').trim();
  if (!raw) return fallback;

  if (/could not find the ['"].+['"] column of ['"].+['"] in the schema cache/i.test(raw)) {
    return 'O sistema ainda não reconheceu uma atualização necessária. Atualize a página e tente novamente.';
  }
  if (/schema cache|pgrst204/i.test(raw)) {
    return 'Os dados do sistema estão sendo atualizados. Aguarde alguns instantes e tente novamente.';
  }
  if (/column .+ does not exist|relation .+ does not exist|undefined column/i.test(raw)) {
    return 'Uma atualização necessária ainda não foi aplicada. Tente novamente em alguns instantes.';
  }
  if (/duplicate key|unique constraint|already exists/i.test(raw)) {
    return 'Já existe um cadastro com essas informações. Confira os dados e tente novamente.';
  }
  if (/foreign key constraint|is still referenced|update or delete on table/i.test(raw)) {
    return 'Este registro está sendo usado em outra parte do sistema e não pode ser removido. Prefira desativá-lo.';
  }
  if (/not-null constraint|null value in column|required field/i.test(raw)) {
    return 'Falta preencher uma informação obrigatória. Confira os campos e tente novamente.';
  }
  if (/check constraint|violates check/i.test(raw)) {
    return 'Um dos valores informados não é permitido. Revise os dados e tente novamente.';
  }
  if (/invalid input syntax|invalid uuid|malformed/i.test(raw)) {
    return 'Um dos dados informados é inválido. Atualize a página, confira as informações e tente novamente.';
  }
  if (/row-level security|permission denied|unauthorized|forbidden|jwt|not authorized|status 401|status 403/i.test(raw)) {
    return 'Sua sessão não tem permissão para realizar esta ação. Entre novamente ou solicite acesso ao administrador.';
  }
  if (/failed to fetch|networkerror|network request|connection reset|load failed|fetch failed/i.test(raw)) {
    return 'Não foi possível conectar ao servidor. Confira sua internet e tente novamente.';
  }
  if (/timeout|timed out|deadline exceeded/i.test(raw)) {
    return 'A operação demorou mais que o esperado. Tente novamente em alguns instantes.';
  }
  if (/edge function returned a non-2xx|failed to send a request|http 5\d\d/i.test(raw)) {
    return 'O serviço não conseguiu concluir esta ação agora. Tente novamente em alguns instantes.';
  }
  if (/cannot read propert|typeerror|referenceerror|syntaxerror/i.test(raw)) {
    return 'Encontramos uma falha inesperada nesta tela. Atualize a página e tente novamente.';
  }

  if (looksTechnical(raw) || (/[a-z]{4,}/i.test(raw) && !/[áàâãéêíóôõúç]/i.test(raw) && /\b(?:the|this|with|from|cannot|could|failed|invalid|not|found)\b/i.test(raw))) {
    return fallback;
  }

  return raw;
}

export function friendlyErrorTitle(title: unknown): string {
  if (typeof title !== 'string' || !title.trim()) return 'Não foi possível concluir';
  const value = title.trim();
  if (/^erro$/i.test(value)) return 'Não foi possível concluir';
  if (/^erro ao /i.test(value)) return value.replace(/^Erro ao /i, 'Não foi possível ');
  if (/^falha$/i.test(value)) return 'Não foi possível concluir';
  return value;
}
