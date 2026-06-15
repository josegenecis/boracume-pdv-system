import { recordWaiterPayments, type WaiterPaymentInput } from '@/services/waiterWebClient';
import type { PaymentResult } from './PaymentProvider';

const OFFLINE_PAYMENT_QUEUE_KEY = 'popsystem_waiter_offline_payments';

export type OfflinePaymentRecord = {
  id: string;
  sessionId: string;
  payments: WaiterPaymentInput[];
  serviceCharge?: { enabled: boolean; percentage?: number };
  stoneResult?: PaymentResult;
  createdAt: string;
};

const readQueue = (): OfflinePaymentRecord[] => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(OFFLINE_PAYMENT_QUEUE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = (queue: OfflinePaymentRecord[]) => {
  window.localStorage.setItem(OFFLINE_PAYMENT_QUEUE_KEY, JSON.stringify(queue));
};

export const enqueueOfflinePayment = (record: Omit<OfflinePaymentRecord, 'id' | 'createdAt'>) => {
  const queue = readQueue();
  queue.push({
    ...record,
    id: `${record.sessionId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
  });
  writeQueue(queue);
};

export const getOfflinePaymentQueue = () => readQueue();

export const syncOfflinePayments = async () => {
  const queue = readQueue();
  if (!queue.length) return { synced: 0, remaining: 0 };

  const remaining: OfflinePaymentRecord[] = [];
  let synced = 0;

  for (const record of queue) {
    try {
      await recordWaiterPayments(record.sessionId, record.payments, record.serviceCharge);
      synced += 1;
    } catch {
      remaining.push(record);
    }
  }

  writeQueue(remaining);
  return { synced, remaining: remaining.length };
};
