import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PaymentProvider, PaymentRequest, PaymentResult, StoneStatus } from './PaymentProvider';

type StoneNativePaymentRequest = {
  amountCents: number;
  type: 'PIX' | 'DEBIT' | 'CREDIT';
  installments?: number;
  reference?: string;
  metadata?: Record<string, unknown>;
};

type StoneNativePaymentResult = {
  transactionId?: string;
  transaction_id?: string;
  atk?: string;
  nsu?: string;
  authorizationCode?: string;
  authorization_code?: string;
  amount?: number;
  amountCents?: number;
  paymentType?: string;
  payment_type?: string;
  installments?: number;
  status?: string;
  date?: string;
  deviceId?: string;
  device_id?: string;
  terminal?: string;
  stoneCode?: string;
  stone_code?: string;
  receiptText?: string;
};

type StonePosPlugin = {
  startPayment(request: StoneNativePaymentRequest): Promise<StoneNativePaymentResult>;
  cancelPayment(options: { transactionId: string }): Promise<void>;
  refundPayment(options: { transactionId: string; amountCents?: number }): Promise<StoneNativePaymentResult>;
  getTransaction(options: { transactionId: string }): Promise<StoneNativePaymentResult | null>;
  getStatus(): Promise<StoneStatus>;
  reprintReceipt(options: { transactionId: string }): Promise<void>;
};

const StonePos = registerPlugin<StonePosPlugin>('StonePos');

const toStoneType = (type: PaymentRequest['paymentType']) => {
  if (type === 'pix') return 'PIX';
  if (type === 'debit') return 'DEBIT';
  if (type === 'credit') return 'CREDIT';
  throw new Error('Dinheiro nao usa Stone. Registre direto no PopSystem.');
};

const normalizeStatus = (status?: string): PaymentResult['status'] => {
  const value = String(status || '').toLowerCase();
  if (['approved', 'success', 'paid', 'autorizado', 'authorized'].includes(value)) return 'approved';
  if (['cancelled', 'canceled', 'voided', 'cancelado'].includes(value)) return 'cancelled';
  if (['pending', 'processing', 'processando'].includes(value)) return 'pending';
  return 'failed';
};

const normalizePaymentType = (value: unknown, fallback: PaymentRequest['paymentType']) => {
  const method = String(value || '').toLowerCase();
  if (method.includes('debit')) return 'debit';
  if (method.includes('credit')) return 'credit';
  if (method.includes('pix')) return 'pix';
  return fallback;
};

const normalizeResult = (result: StoneNativePaymentResult, fallback: PaymentRequest): PaymentResult => {
  const amountFromCents = typeof result.amountCents === 'number' ? result.amountCents / 100 : undefined;
  const amount = typeof result.amount === 'number' ? result.amount : amountFromCents ?? fallback.amount;

  return {
    provider: 'stone',
    transaction_id: result.transaction_id || result.transactionId,
    atk: result.atk,
    nsu: result.nsu,
    authorization_code: result.authorization_code || result.authorizationCode,
    amount,
    payment_type: normalizePaymentType(result.payment_type || result.paymentType, fallback.paymentType),
    installments: result.installments || fallback.installments,
    status: normalizeStatus(result.status),
    date: result.date || new Date().toISOString(),
    device_id: result.device_id || result.deviceId,
    terminal: result.terminal,
    stone_code: result.stone_code || result.stoneCode,
    receiptText: result.receiptText,
    raw: result,
  };
};

const unavailable = () =>
  new Error('Stone indisponivel neste dispositivo. Abra no POS Android homologado e confira se o plugin StonePos esta instalado.');

export class StoneProvider implements PaymentProvider {
  readonly name = 'stone' as const;

  async startPayment(request: PaymentRequest): Promise<PaymentResult> {
    if (!Capacitor.isNativePlatform()) {
      throw unavailable();
    }

    const result = await StonePos.startPayment({
      amountCents: Math.round(request.amount * 100),
      type: toStoneType(request.paymentType),
      installments: request.installments,
      reference: request.reference,
      metadata: {
        sessionId: request.sessionId,
        accountId: request.accountId,
        tableId: request.tableId,
        tableLabel: request.tableLabel,
        accountName: request.accountName,
        operatorId: request.operatorId,
        restaurantId: request.restaurantId,
      },
    });

    const normalized = normalizeResult(result, request);
    if (normalized.status !== 'approved') {
      throw new Error(`Pagamento Stone nao aprovado: ${normalized.status}`);
    }
    return normalized;
  }

  async cancelPayment(transactionId: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) throw unavailable();
    await StonePos.cancelPayment({ transactionId });
  }

  async refundPayment(transactionId: string, amount?: number): Promise<PaymentResult> {
    if (!Capacitor.isNativePlatform()) throw unavailable();
    const result = await StonePos.refundPayment({
      transactionId,
      amountCents: amount ? Math.round(amount * 100) : undefined,
    });
    return normalizeResult(result, { amount: amount || 0, paymentType: 'credit' });
  }

  async getTransaction(transactionId: string): Promise<PaymentResult | null> {
    if (!Capacitor.isNativePlatform()) throw unavailable();
    const result = await StonePos.getTransaction({ transactionId });
    return result ? normalizeResult(result, { amount: 0, paymentType: 'credit' }) : null;
  }

  async getStatus(): Promise<StoneStatus> {
    if (!Capacitor.isNativePlatform()) {
      return {
        available: false,
        sdkStatus: 'Somente POS Android',
        message: 'A integracao Stone aparece ativa quando o app roda dentro do POS Android homologado.',
      };
    }

    try {
      return await StonePos.getStatus();
    } catch (error: any) {
      return {
        available: false,
        sdkStatus: 'Plugin StonePos nao respondeu',
        message: String(error?.message || error || 'Instale o plugin nativo StonePos no projeto Android.'),
      };
    }
  }

  async reprintReceipt(transactionId: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) throw unavailable();
    await StonePos.reprintReceipt({ transactionId });
  }
}

export const stoneProvider = new StoneProvider();
