alter table public.subscriptions
  drop constraint if exists subscriptions_status_check;

alter table public.subscriptions
  add constraint subscriptions_status_check
  check (
    status in (
      'trial',
      'trialing',
      'active',
      'pending',
      'awaiting_payment',
      'payment_pending',
      'overdue',
      'past_due',
      'suspended',
      'canceled',
      'cancelled',
      'expired',
      'inactive'
    )
  );
