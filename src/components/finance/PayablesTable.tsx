import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Ban, CalendarDays, Check, CreditCard, Download, Eye, FileText, History,
  MoreHorizontal, Paperclip, Pencil, Plus, ReceiptText, RotateCcw, Wallet,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getLocalOperatorSession, isAdminOperator } from '@/services/operatorAuth';
import { friendlyErrorMessage } from '@/lib/friendly-error';
import { parseBRL } from '@/lib/currency';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CurrencyTextInput } from '@/components/ui/currency-text-input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

export type Payable = {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  paid_amount?: number | null;
  category?: string | null;
  expense_date?: string | null;
  due_date?: string | null;
  status?: string | null;
  paid_at?: string | null;
  receipt_url?: string | null;
  receipt_path?: string | null;
  receipt_name?: string | null;
  receipt_mime_type?: string | null;
  payable_origin_type?: string | null;
  installment_number?: number | null;
  installment_count?: number | null;
  competence_date?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  cancelled_by_name?: string | null;
};

type FinancialAccount = {
  id: string;
  name: string;
  account_type: 'cash' | 'bank' | 'digital_wallet' | 'other';
  current_balance: number;
};

type ExpensePayment = {
  id: string;
  amount: number;
  payment_date: string;
  paid_at: string;
  payment_method: string;
  note?: string | null;
  proof_path?: string | null;
  proof_name?: string | null;
  responsible_name: string;
  status: 'posted' | 'reversed';
  reversed_at?: string | null;
  reversal_reason?: string | null;
  reversed_by_name?: string | null;
  financial_accounts?: { name?: string | null; account_type?: string | null } | null;
};

type Props = {
  expenses: Payable[];
  userId: string;
  categories: string[];
  onReload: () => Promise<void> | void;
  onOpenAttachment: (params: { id: string; path?: string | null; legacyUrl?: string | null; name?: string | null; download?: boolean }) => Promise<void> | void;
  attachmentBusyId?: string;
};

const PAYMENT_METHODS = [
  ['pix', 'PIX'], ['cash', 'Dinheiro'], ['debit_card', 'Cartão de débito'],
  ['credit_card', 'Cartão de crédito'], ['bank_transfer', 'Transferência'],
  ['boleto', 'Boleto'], ['voucher', 'Voucher'], ['other', 'Outros'],
] as const;

const STATUS_LABELS: Record<string, string> = {
  open: 'EM ABERTO', pending: 'EM ABERTO', partially_paid: 'PARCIALMENTE PAGA',
  paid: 'PAGA', overdue: 'VENCIDA', cancelled: 'CANCELADA',
};

const STATUS_CLASSES: Record<string, string> = {
  open: 'border-blue-200 bg-blue-50 text-blue-800', pending: 'border-blue-200 bg-blue-50 text-blue-800',
  partially_paid: 'border-amber-200 bg-amber-50 text-amber-900',
  paid: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  overdue: 'border-red-200 bg-red-50 text-red-800',
  cancelled: 'border-slate-200 bg-slate-100 text-slate-700',
};

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
const dateLabel = (value?: string | null) => value ? format(new Date(`${value.slice(0, 10)}T12:00:00`), 'dd/MM/yyyy', { locale: ptBR }) : '-';
const amountPaid = (expense: Payable) => Math.max(0, Number(expense.paid_amount || 0));
const remaining = (expense: Payable) => Math.max(0, Number(expense.amount || 0) - amountPaid(expense));
const effectiveStatus = (expense: Payable) => {
  const status = String(expense.status || 'open').toLowerCase();
  if (status === 'cancelled' || status === 'paid' || status === 'partially_paid') return status;
  if (expense.due_date && expense.due_date.slice(0, 10) < format(new Date(), 'yyyy-MM-dd')) return 'overdue';
  return status === 'pending' ? 'open' : status;
};
const canPay = (expense: Payable) => ['open', 'overdue', 'partially_paid'].includes(effectiveStatus(expense)) && remaining(expense) > 0;

export function PayablesTable({ expenses, userId, categories, onReload, onOpenAttachment, attachmentBusyId }: Props) {
  const { toast } = useToast();
  const operator = useMemo(() => getLocalOperatorSession(), []);
  const mayManage = !operator || isAdminOperator(operator)
    || operator.permissions?.expenses_manage === true
    || operator.permissions?.expense_payments_manage === true;
  const mayReverse = !operator || isAdminOperator(operator)
    || operator.permissions?.expense_payments_reverse === true;
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [paymentTargets, setPaymentTargets] = useState<Payable[]>([]);
  const [details, setDetails] = useState<Payable | null>(null);
  const [payments, setPayments] = useState<ExpensePayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [reversePayment, setReversePayment] = useState<ExpensePayment | null>(null);
  const [editExpense, setEditExpense] = useState<Payable | null>(null);
  const [cancelExpense, setCancelExpense] = useState<Payable | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAccounts = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc('ensure_default_financial_accounts');
    if (error) {
      console.error('Erro ao carregar contas financeiras:', error);
      return;
    }
    setAccounts(((data || []) as FinancialAccount[]).map((row) => ({ ...row, current_balance: Number(row.current_balance || 0) })));
  }, []);

  useEffect(() => { void loadAccounts(); }, [loadAccounts]);
  useEffect(() => {
    setSelectedIds((current) => new Set([...current].filter((id) => expenses.some((expense) => expense.id === id && canPay(expense)))));
  }, [expenses]);

  const loadPayments = useCallback(async (expenseId: string) => {
    setPaymentsLoading(true);
    const { data, error } = await (supabase as any)
      .from('expense_payments')
      .select('id,amount,payment_date,paid_at,payment_method,note,proof_path,proof_name,responsible_name,status,reversed_at,reversal_reason,reversed_by_name,financial_accounts(name,account_type)')
      .eq('expense_id', expenseId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    setPaymentsLoading(false);
    if (error) {
      toast({ title: 'Erro ao carregar pagamentos', description: friendlyErrorMessage(error), variant: 'destructive' });
      return;
    }
    setPayments((data || []) as ExpensePayment[]);
  }, [toast, userId]);

  const openDetails = (expense: Payable) => {
    setDetails(expense);
    void loadPayments(expense.id);
  };

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(expenses.filter(canPay).map((expense) => expense.id)) : new Set());
  };

  const duplicateExpense = async (expense: Payable) => {
    if (!mayManage) return;
    setBusy(true);
    const baseDate = expense.due_date || format(new Date(), 'yyyy-MM-dd');
    const { error } = await (supabase as any).from('expenses').insert({
      user_id: userId,
      description: `${expense.description} (cópia)`,
      amount: Number(expense.amount),
      category: expense.category,
      expense_date: format(new Date(), 'yyyy-MM-dd'),
      due_date: baseDate,
      competence_date: baseDate,
      status: baseDate < format(new Date(), 'yyyy-MM-dd') ? 'overdue' : 'open',
      paid_amount: 0,
      payable_origin_type: 'single',
    });
    setBusy(false);
    if (error) toast({ title: 'Não foi possível duplicar', description: friendlyErrorMessage(error), variant: 'destructive' });
    else {
      toast({ title: 'Conta duplicada', description: 'A cópia foi criada em aberto.' });
      await onReload();
    }
  };

  const attachExpenseProof = async (expense: Payable, file: File) => {
    if (!mayManage) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'O comprovante deve ter no máximo 10 MB.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    const extension = file.name.split('.').pop() || 'bin';
    const path = `${userId}/payables/${expense.id}/${crypto.randomUUID()}.${extension}`;
    const upload = await supabase.storage.from('purchase-invoice-attachments').upload(path, file);
    if (upload.error) {
      setBusy(false);
      toast({ title: 'Erro ao anexar', description: friendlyErrorMessage(upload.error), variant: 'destructive' });
      return;
    }
    const { error } = await (supabase as any).from('expenses').update({
      receipt_path: path, receipt_name: file.name, receipt_mime_type: file.type,
    }).eq('id', expense.id).eq('user_id', userId);
    setBusy(false);
    if (error) toast({ title: 'Erro ao vincular comprovante', description: friendlyErrorMessage(error), variant: 'destructive' });
    else {
      toast({ title: 'Comprovante anexado' });
      await onReload();
    }
  };

  const checkedCount = selectedIds.size;
  const selectable = expenses.filter(canPay);

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-sm text-slate-700">
          <Checkbox
            checked={selectable.length > 0 && checkedCount === selectable.length}
            onCheckedChange={(value) => toggleAll(value === true)}
            aria-label="Selecionar todas as contas em aberto"
          />
          <span>{checkedCount ? `${checkedCount} conta(s) selecionada(s)` : 'Selecione contas para pagamento em lote'}</span>
        </div>
        <Button
          type="button"
          disabled={!checkedCount || !mayManage}
          onClick={() => setPaymentTargets(expenses.filter((expense) => selectedIds.has(expense.id)))}
          className="bg-emerald-800 hover:bg-emerald-900"
        >
          <Wallet className="mr-2 h-4 w-4" /> Informar pagamento em lote
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><span className="sr-only">Selecionar</span></TableHead>
              <TableHead>Conta / vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Pago</TableHead>
              <TableHead className="text-right">Restante</TableHead>
              <TableHead className="min-w-[190px] text-right">Ação principal</TableHead>
              <TableHead className="w-12"><span className="sr-only">Menu</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => {
              const status = effectiveStatus(expense);
              const payable = canPay(expense);
              return (
                <TableRow key={expense.id} className={status === 'overdue' ? 'bg-red-50/30' : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(expense.id)}
                      disabled={!payable || !mayManage}
                      onCheckedChange={(value) => setSelectedIds((current) => {
                        const next = new Set(current);
                        if (value === true) next.add(expense.id); else next.delete(expense.id);
                        return next;
                      })}
                      aria-label={`Selecionar ${expense.description}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-slate-950">{expense.description}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="capitalize">{expense.category || 'Sem categoria'}</span>
                      <span>•</span>
                      <span className={status === 'overdue' ? 'font-semibold text-red-700' : ''}>Vence {dateLabel(expense.due_date || expense.expense_date)}</span>
                      {expense.installment_count && expense.installment_count > 1 && (
                        <Badge variant="outline">Parcela {expense.installment_number}/{expense.installment_count}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_CLASSES[status] || STATUS_CLASSES.open}>{STATUS_LABELS[status] || 'EM ABERTO'}</Badge></TableCell>
                  <TableCell className="text-right font-semibold">{money(expense.amount)}</TableCell>
                  <TableCell className="text-right text-emerald-700">{money(amountPaid(expense))}</TableCell>
                  <TableCell className="text-right font-bold">{money(remaining(expense))}</TableCell>
                  <TableCell className="text-right">
                    {payable ? (
                      <div className="flex flex-col justify-end gap-1 sm:flex-row">
                        <Button type="button" size="sm" disabled={!mayManage} onClick={() => setPaymentTargets([expense])} className="bg-emerald-800 hover:bg-emerald-900">
                          <Wallet className="mr-1.5 h-4 w-4" /> Informar pagamento
                        </Button>
                        <Button type="button" size="sm" variant="ghost" disabled={!mayManage} onClick={() => setPaymentTargets([expense])}>
                          <Check className="mr-1 h-4 w-4" /> Marcar como paga
                        </Button>
                      </div>
                    ) : (
                      <Button type="button" size="sm" variant="outline" onClick={() => openDetails(expense)}>
                        <History className="mr-1.5 h-4 w-4" /> Ver pagamento
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label="Mais ações"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        {payable && <DropdownMenuItem onClick={() => setPaymentTargets([expense])}><Wallet className="mr-2 h-4 w-4" />Informar pagamento</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => openDetails(expense)}><FileText className="mr-2 h-4 w-4" />Ver detalhes</DropdownMenuItem>
                        {expense.receipt_path || expense.receipt_url ? (
                          <DropdownMenuItem onClick={() => void onOpenAttachment({ id: expense.id, path: expense.receipt_path, legacyUrl: expense.receipt_url, name: expense.receipt_name })}>
                            <Eye className="mr-2 h-4 w-4" />Ver comprovante
                          </DropdownMenuItem>
                        ) : null}
                        {mayManage && status !== 'cancelled' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setEditExpense(expense)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void duplicateExpense(expense)} disabled={busy}><Plus className="mr-2 h-4 w-4" />Duplicar</DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <label className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent">
                                <Paperclip className="mr-2 h-4 w-4" />Anexar comprovante
                                <input type="file" className="sr-only" accept=".jpg,.jpeg,.png,.webp,.pdf" disabled={busy} onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  if (file) void attachExpenseProof(expense, file);
                                  event.target.value = '';
                                }} />
                              </label>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-700 focus:text-red-800" onClick={() => setCancelExpense(expense)}><Ban className="mr-2 h-4 w-4" />Cancelar conta</DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <PaymentDialog
        open={paymentTargets.length > 0}
        targets={paymentTargets}
        accounts={accounts}
        operatorId={operator?.id || null}
        userId={userId}
        onClose={() => setPaymentTargets([])}
        onPaid={async () => {
          setPaymentTargets([]);
          setSelectedIds(new Set());
          await Promise.all([Promise.resolve(onReload()), loadAccounts()]);
        }}
      />

      <DetailsDialog
        expense={details}
        payments={payments}
        loading={paymentsLoading}
        mayReverse={mayReverse}
        onClose={() => { setDetails(null); setPayments([]); }}
        onReverse={setReversePayment}
        onOpenProof={(payment, download) => void onOpenAttachment({ id: payment.id, path: payment.proof_path, name: payment.proof_name, download })}
        attachmentBusyId={attachmentBusyId}
      />

      <ReversePaymentDialog
        payment={reversePayment}
        onClose={() => setReversePayment(null)}
        onReversed={async () => {
          setReversePayment(null);
          if (details) await loadPayments(details.id);
          await Promise.all([Promise.resolve(onReload()), loadAccounts()]);
        }}
      />

      <EditPayableDialog
        expense={editExpense}
        categories={categories}
        operatorId={operator?.id || null}
        onClose={() => setEditExpense(null)}
        onSaved={async () => { setEditExpense(null); await onReload(); }}
      />

      <CancelPayableDialog
        expense={cancelExpense}
        operatorId={operator?.id || null}
        onClose={() => setCancelExpense(null)}
        onCancelled={async () => { setCancelExpense(null); await onReload(); }}
      />
    </>
  );
}

function PaymentDialog({ open, targets, accounts, operatorId, userId, onClose, onPaid }: {
  open: boolean; targets: Payable[]; accounts: FinancialAccount[]; operatorId: string | null; userId: string;
  onClose: () => void; onPaid: () => Promise<void> | void;
}) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [method, setMethod] = useState('pix');
  const [accountId, setAccountId] = useState('');
  const [note, setNote] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const batch = targets.length > 1;
  const totalRemaining = targets.reduce((sum, expense) => sum + remaining(expense), 0);

  useEffect(() => {
    if (!open) return;
    setAmount(targets.length === 1 ? money(remaining(targets[0])) : money(totalRemaining));
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setMethod('pix');
    setNote('');
    setProof(null);
  }, [open, targets, totalRemaining]);

  useEffect(() => {
    if (!open || accountId || !accounts[0]?.id) return;
    setAccountId(accounts[0].id);
  }, [open, accountId, accounts]);

  const submit = async () => {
    if (!accountId) {
      toast({ title: 'Selecione a conta financeira', variant: 'destructive' });
      return;
    }
    const value = batch ? totalRemaining : parseBRL(amount);
    if (!Number.isFinite(value) || value <= 0 || (!batch && value > remaining(targets[0]) + 0.001)) {
      toast({ title: 'Valor inválido', description: `O máximo disponível é ${money(totalRemaining)}.`, variant: 'destructive' });
      return;
    }
    if (proof && proof.size > 10 * 1024 * 1024) {
      toast({ title: 'Comprovante muito grande', description: 'O limite é 10 MB.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      for (const target of targets) {
        let proofPath: string | null = null;
        if (proof) {
          const extension = proof.name.split('.').pop() || 'bin';
          proofPath = `${userId}/payments/${target.id}/${crypto.randomUUID()}.${extension}`;
          const upload = await supabase.storage.from('purchase-invoice-attachments').upload(proofPath, proof);
          if (upload.error) throw upload.error;
        }
        const { error } = await (supabase as any).rpc('record_expense_payment', {
          p_expense_id: target.id,
          p_amount: batch ? remaining(target) : value,
          p_payment_date: paymentDate,
          p_payment_method: method,
          p_financial_account_id: accountId,
          p_note: note || null,
          p_proof_path: proofPath,
          p_proof_name: proof?.name || null,
          p_proof_mime_type: proof?.type || null,
          p_operator_id: operatorId,
          p_operation_id: crypto.randomUUID(),
        });
        if (error) throw error;
      }
      toast({
        title: batch ? `${targets.length} pagamentos registrados` : 'Pagamento registrado',
        description: 'A baixa e a movimentação financeira foram gravadas com sucesso.',
      });
      await onPaid();
    } catch (error) {
      toast({ title: 'Não foi possível registrar o pagamento', description: friendlyErrorMessage(error), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && !submitting && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Informar pagamento</DialogTitle>
          <DialogDescription>
            {batch ? `${targets.length} contas serão baixadas individualmente.` : targets[0]?.description}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="text-sm text-emerald-800">{batch ? 'Total do lote' : 'Valor da conta'}</div>
            <div className="text-2xl font-bold text-emerald-950">{money(totalRemaining)}</div>
            {batch && <div className="mt-2 text-xs text-emerald-800">Cada conta receberá uma baixa separada pelo seu saldo restante.</div>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentAmount">Valor a pagar</Label>
            <CurrencyTextInput id="paymentAmount" value={amount} onValueChange={setAmount} disabled={batch} />
            {!batch && Number(targets[0]?.paid_amount || 0) > 0 && <p className="text-xs text-muted-foreground">Já pago: {money(amountPaid(targets[0]))}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="paymentDate">Data do pagamento</Label><Input id="paymentDate" type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></div>
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Conta financeira</Label>
            <Select value={accountId} onValueChange={setAccountId}><SelectTrigger><SelectValue placeholder="Banco / Caixa" /></SelectTrigger><SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name} · saldo {money(account.current_balance)}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-2"><Label htmlFor="paymentNote">Observação</Label><Textarea id="paymentNote" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Opcional" /></div>
          <div className="space-y-2"><Label htmlFor="paymentProof">Comprovante</Label><Input id="paymentProof" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(event) => setProof(event.target.files?.[0] || null)} />{proof && <p className="text-xs text-muted-foreground">{proof.name}</p>}</div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button><Button onClick={() => void submit()} disabled={submitting} className="bg-emerald-800 hover:bg-emerald-900">{submitting ? 'Registrando...' : 'Confirmar pagamento'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailsDialog({ expense, payments, loading, mayReverse, onClose, onReverse, onOpenProof, attachmentBusyId }: {
  expense: Payable | null; payments: ExpensePayment[]; loading: boolean; mayReverse: boolean; onClose: () => void;
  onReverse: (payment: ExpensePayment) => void; onOpenProof: (payment: ExpensePayment, download?: boolean) => void; attachmentBusyId?: string;
}) {
  if (!expense) return null;
  const status = effectiveStatus(expense);
  return (
    <Dialog open onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>Detalhes da conta</DialogTitle><DialogDescription>{expense.description}</DialogDescription></DialogHeader>
        <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-4">
          <div><span className="block text-xs text-muted-foreground">Valor</span><strong>{money(expense.amount)}</strong></div>
          <div><span className="block text-xs text-muted-foreground">Pago</span><strong className="text-emerald-700">{money(amountPaid(expense))}</strong></div>
          <div><span className="block text-xs text-muted-foreground">Restante</span><strong>{money(remaining(expense))}</strong></div>
          <div><span className="block text-xs text-muted-foreground">Status</span><Badge variant="outline" className={STATUS_CLASSES[status]}>{STATUS_LABELS[status]}</Badge></div>
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div><CalendarDays className="mb-1 h-4 w-4" /><span className="text-muted-foreground">Vencimento</span><div className="font-medium">{dateLabel(expense.due_date || expense.expense_date)}</div></div>
          <div><ReceiptText className="mb-1 h-4 w-4" /><span className="text-muted-foreground">Categoria</span><div className="font-medium capitalize">{expense.category || '-'}</div></div>
          <div><FileText className="mb-1 h-4 w-4" /><span className="text-muted-foreground">Competência</span><div className="font-medium">{dateLabel(expense.competence_date)}</div></div>
        </div>
        {status === 'cancelled' && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900"><strong>Conta cancelada{expense.cancelled_by_name ? ` por ${expense.cancelled_by_name}` : ''}:</strong> {expense.cancellation_reason || 'Motivo não informado'}</div>}
        <div>
          <h3 className="mb-3 flex items-center gap-2 font-semibold"><History className="h-4 w-4" />Histórico de pagamentos</h3>
          {loading ? <p className="py-6 text-center text-muted-foreground">Carregando pagamentos...</p> : payments.length === 0 ? <div className="rounded-xl border border-dashed py-6 text-center text-sm text-muted-foreground">Nenhuma baixa registrada.</div> : (
            <div className="space-y-2">{payments.map((payment) => (
              <div key={payment.id} className={`rounded-xl border p-3 ${payment.status === 'reversed' ? 'bg-slate-50 opacity-75' : 'bg-white'}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><div className="font-bold">{dateLabel(payment.payment_date)} · {PAYMENT_METHODS.find(([value]) => value === payment.payment_method)?.[1] || payment.payment_method} · {money(payment.amount)}</div><div className="text-xs text-muted-foreground">{payment.financial_accounts?.name || 'Conta financeira'} · {payment.responsible_name}</div>{payment.note && <div className="mt-1 text-sm">{payment.note}</div>}</div>
                  <div className="flex flex-wrap gap-2">
                    {payment.proof_path && <><Button size="sm" variant="outline" disabled={attachmentBusyId === payment.id} onClick={() => onOpenProof(payment)}><Eye className="mr-1 h-3.5 w-3.5" />Ver</Button><Button size="sm" variant="outline" disabled={attachmentBusyId === payment.id} onClick={() => onOpenProof(payment, true)}><Download className="mr-1 h-3.5 w-3.5" />Baixar</Button></>}
                    {payment.status === 'posted' && mayReverse && <Button size="sm" variant="outline" className="text-red-700" onClick={() => onReverse(payment)}><RotateCcw className="mr-1 h-3.5 w-3.5" />Estornar</Button>}
                  </div>
                </div>
                {payment.status === 'reversed' && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">Estornado{payment.reversed_by_name ? ` por ${payment.reversed_by_name}` : ''}: {payment.reversal_reason || 'Motivo não informado'}</div>}
              </div>
            ))}</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReversePaymentDialog({ payment, onClose, onReversed }: { payment: ExpensePayment | null; onClose: () => void; onReversed: () => Promise<void> | void }) {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (payment) { setReason(''); setPin(''); } }, [payment]);
  if (!payment) return null;
  const submit = async () => {
    setBusy(true);
    const { error } = await (supabase as any).rpc('reverse_expense_payment', { p_payment_id: payment.id, p_reason: reason, p_admin_pin: pin, p_operation_id: crypto.randomUUID() });
    setBusy(false);
    if (error) toast({ title: 'Não foi possível estornar', description: friendlyErrorMessage(error), variant: 'destructive' });
    else { toast({ title: 'Pagamento estornado', description: 'O saldo foi revertido e o histórico foi preservado.' }); await onReversed(); }
  };
  return <Dialog open onOpenChange={(value) => !value && !busy && onClose()}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Estornar pagamento</DialogTitle><DialogDescription>O pagamento de {money(payment.amount)} será revertido, sem apagar a baixa.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Motivo</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} /></div><div className="space-y-2"><Label>PIN de autorização</Label><Input type="password" inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button><Button variant="destructive" onClick={() => void submit()} disabled={busy || !reason.trim() || !pin.trim()}>{busy ? 'Estornando...' : 'Confirmar estorno'}</Button></DialogFooter></DialogContent></Dialog>;
}

function EditPayableDialog({ expense, categories, operatorId, onClose, onSaved }: { expense: Payable | null; categories: string[]; operatorId: string | null; onClose: () => void; onSaved: () => Promise<void> | void }) {
  const { toast } = useToast();
  const [description, setDescription] = useState(''); const [amount, setAmount] = useState(''); const [category, setCategory] = useState(''); const [dueDate, setDueDate] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (expense) { setDescription(expense.description); setAmount(money(expense.amount)); setCategory(expense.category || 'outros'); setDueDate((expense.due_date || expense.expense_date || '').slice(0, 10)); } }, [expense]);
  if (!expense) return null;
  const submit = async () => { setBusy(true); const { error } = await (supabase as any).rpc('update_payable', { p_expense_id: expense.id, p_description: description, p_amount: parseBRL(amount), p_category: category, p_due_date: dueDate, p_operator_id: operatorId }); setBusy(false); if (error) toast({ title: 'Não foi possível editar', description: friendlyErrorMessage(error), variant: 'destructive' }); else { toast({ title: 'Conta atualizada' }); await onSaved(); } };
  return <Dialog open onOpenChange={(value) => !value && !busy && onClose()}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Editar conta a pagar</DialogTitle><DialogDescription>Pagamentos já registrados não serão alterados.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Descrição</Label><Input value={description} onChange={(event) => setDescription(event.target.value)} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Valor</Label><CurrencyTextInput value={amount} onValueChange={setAmount} /></div><div className="space-y-2"><Label>Vencimento</Label><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div></div><div className="space-y-2"><Label>Categoria</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button><Button onClick={() => void submit()} disabled={busy || !description.trim() || !dueDate}>{busy ? 'Salvando...' : 'Salvar alterações'}</Button></DialogFooter></DialogContent></Dialog>;
}

function CancelPayableDialog({ expense, operatorId, onClose, onCancelled }: { expense: Payable | null; operatorId: string | null; onClose: () => void; onCancelled: () => Promise<void> | void }) {
  const { toast } = useToast(); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (expense) setReason(''); }, [expense]);
  if (!expense) return null;
  const submit = async () => { setBusy(true); const { error } = await (supabase as any).rpc('cancel_payable', { p_expense_id: expense.id, p_reason: reason, p_operator_id: operatorId }); setBusy(false); if (error) toast({ title: 'Não foi possível cancelar', description: friendlyErrorMessage(error), variant: 'destructive' }); else { toast({ title: 'Conta cancelada', description: 'A obrigação foi preservada no histórico.' }); await onCancelled(); } };
  return <Dialog open onOpenChange={(value) => !value && !busy && onClose()}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Cancelar conta</DialogTitle><DialogDescription>{expense.description}. Pagamentos existentes precisam ser estornados antes.</DialogDescription></DialogHeader><div className="space-y-2"><Label>Motivo do cancelamento</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} /></div><DialogFooter><Button variant="outline" onClick={onClose} disabled={busy}>Voltar</Button><Button variant="destructive" onClick={() => void submit()} disabled={busy || !reason.trim()}>{busy ? 'Cancelando...' : 'Cancelar conta'}</Button></DialogFooter></DialogContent></Dialog>;
}
