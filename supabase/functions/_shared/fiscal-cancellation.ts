export type FiscalDocumentModel = "55" | "65";

export const FISCAL_CANCELLATION_LIMIT_HOURS: Record<
  FiscalDocumentModel,
  number
> = {
  "55": 720,
  "65": 0.5,
};

interface FiscalCancellationDocument {
  model_code?: string | null;
  data_hora_autorizacao?: string | null;
  data_hora_emissao?: string | null;
}

export function normalizeFiscalDocumentModel(
  value: unknown,
): FiscalDocumentModel {
  return String(value || "") === "55" ? "55" : "65";
}

export function assertFiscalCancellationWindow(
  document: FiscalCancellationDocument,
  now = new Date(),
): void {
  const modelCode = normalizeFiscalDocumentModel(document.model_code);
  const authorizedAtValue = document.data_hora_autorizacao ||
    document.data_hora_emissao;
  const authorizedAt = new Date(String(authorizedAtValue || ""));

  if (!Number.isFinite(authorizedAt.getTime())) {
    throw new Error(
      `O documento fiscal modelo ${modelCode} não possui data de autorização válida para conferir o prazo de cancelamento.`,
    );
  }

  const elapsedMs = Math.max(0, now.getTime() - authorizedAt.getTime());
  const limitHours = FISCAL_CANCELLATION_LIMIT_HOURS[modelCode];
  const limitMs = limitHours * 60 * 60 * 1000;

  if (elapsedMs > limitMs) {
    const readableLimit = modelCode === "65" ? "30 minutos" : "720 horas";
    throw new Error(
      `O prazo de ${readableLimit} para cancelar o documento fiscal modelo ${modelCode} expirou. A venda não foi cancelada.`,
    );
  }
}
