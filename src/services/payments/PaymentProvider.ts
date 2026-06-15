export type PosPaymentType = 'pix' | 'debit' | 'credit' | 'cash';
export type PaymentProviderName = 'stone' | 'manual' | 'mercadopago';
export type PaymentStatus = 'approved' | 'pending' | 'cancelled' | 'failed';

export type PaymentRequest = {
  amount: number;
  paymentType: PosPaymentType;
  installments?: number;
  accountId?: string;
  sessionId?: string;
  tableId?: string;
  accountName?: string;
  tableLabel?: string;
  operatorId?: string;
  restaurantId?: string;
  reference?: string;
};

export type PaymentResult = {
  provider: PaymentProviderName;
  transaction_id?: string;
  atk?: string;
  nsu?: string;
  authorization_code?: string;
  amount: number;
  payment_type: PosPaymentType;
  installments?: number;
  status: PaymentStatus;
  date: string;
  device_id?: string;
  terminal?: string;
  stone_code?: string;
  receiptText?: string;
  raw?: unknown;
};

export type StoneStatus = {
  available: boolean;
  sdkStatus: string;
  sdkVersion?: string;
  terminal?: string;
  stoneCode?: string;
  sak?: string;
  lastCommunication?: string;
  deviceId?: string;
  message?: string;
};

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  startPayment(request: PaymentRequest): Promise<PaymentResult>;
  cancelPayment(transactionId: string): Promise<void>;
  refundPayment(transactionId: string, amount?: number): Promise<PaymentResult>;
  getTransaction(transactionId: string): Promise<PaymentResult | null>;
  getStatus?(): Promise<StoneStatus>;
  reprintReceipt?(transactionId: string): Promise<void>;
}
