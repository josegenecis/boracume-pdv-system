import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ReceiptText, UserRoundCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import AdminPinDialog from '@/components/security/AdminPinDialog';
import { verifyAdminPin } from '@/services/adminPin';
import { getLocalOperatorSession, isAdminOperator } from '@/services/operatorAuth';

interface StaffConsumption {
  id: string;
  employee_name: string;
  amount: number;
  due_date?: string | null;
  notes?: string | null;
  status: 'open' | 'paid' | 'cancelled';
  payment_method?: string | null;
  paid_at?: string | null;
  created_at: string;
  debtor_type?: 'employee' | 'customer' | 'supplier' | 'other';
  source_type?: 'table' | 'pdv' | 'manual';
  items?: Array<{
    id?: string;
    name?: string;
    product_name?: string;
    quantity?: number;
    price?: number;
    unit_price?: number;
    subtotal?: number;
    total?: number;
  }> | null;
}

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const paymentLabels: Record<string, string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  desconto_folha: 'Desconto em folha',
};

const debtorLabels: Record<string, string> = {
  employee: 'Funcionário',
  customer: 'Cliente',
  supplier: 'Fornecedor',
  other: 'Outro',
};

const sourceLabels: Record<string, string> = {
  table: 'Mesa',
  pdv: 'PDV',
  manual: 'Manual',
};

const getDefaultPaymentMethod = (row: StaffConsumption) =>
  row.debtor_type === 'employee' ? 'desconto_folha' : 'dinheiro';

const getItemName = (item: NonNullable<StaffConsumption['items']>[number]) =>
  item.product_name || item.name || 'Item';

const getItemTotal = (item: NonNullable<StaffConsumption['items']>[number]) => {
  const explicitTotal = Number(item.subtotal ?? item.total);
  if (Number.isFinite(explicitTotal)) return explicitTotal;
  return Number(item.quantity || 0) * Number(item.price ?? item.unit_price ?? 0);
};

const StaffConsumptionManager: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<StaffConsumption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<Record<string, string>>({});
  const [pendingSettlement, setPendingSettlement] = useState<StaffConsumption | null>(null);

  const loadRows = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('staff_consumptions')
      .select('id,employee_name,amount,due_date,notes,status,payment_method,paid_at,created_at,debtor_type,source_type,items')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setLoading(false);

    if (error) {
      toast({
        title: 'Não foi possível carregar as contas',
        description: 'Atualize a página e tente novamente.',
        variant: 'destructive',
      });
      return;
    }
    setRows((data || []) as StaffConsumption[]);
  }, [toast, user?.id]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const pendingCount = useMemo(() => rows.filter((row) => row.status === 'open').length, [rows]);
  const pendingTotal = useMemo(
    () => rows.filter((row) => row.status === 'open').reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [rows],
  );

  const executeSettlement = async (row: StaffConsumption, authorizedWaiterId: string) => {
    const paymentMethod = paymentMethods[row.id] || getDefaultPaymentMethod(row);
    const { error } = await (supabase as any).rpc('settle_staff_consumption_authorized', {
      p_receivable_id: row.id,
      p_payment_method: paymentMethod,
      p_authorized_waiter_id: authorizedWaiterId,
    });
    if (error) {
      toast({
        title: 'Pagamento não registrado',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: 'Conta recebida',
      description: `Pagamento de ${row.employee_name} registrado com sucesso.`,
    });
    await loadRows();
  };

  const settle = async (row: StaffConsumption) => {
    const operator = getLocalOperatorSession();
    if (operator?.id && isAdminOperator(operator)) {
      await executeSettlement(row, operator.id);
      return;
    }
    setPendingSettlement(row);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <ReceiptText size={16} />
          <span className="hidden sm:inline">Contas a receber</span>
          {pendingCount > 0 && <Badge className="ml-1 bg-amber-500 text-white">{pendingCount}</Badge>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundCheck size={20} />
            Contas a receber
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm text-amber-800">Total pendente</div>
          <div className="mt-1 text-2xl font-black text-amber-950">{currency.format(pendingTotal)}</div>
          <p className="mt-1 text-xs text-amber-700">
            Vendas de mesa e do PDV permanecem registradas até o pagamento, sem apagar o histórico.
          </p>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Carregando contas...</div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
            Nenhuma conta a receber registrada.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded-xl border bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-[#082F23]">{row.employee_name}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="outline">{debtorLabels[row.debtor_type || 'employee'] || 'Pessoa'}</Badge>
                      <Badge variant="outline">Origem: {sourceLabels[row.source_type || 'table'] || 'Sistema'}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Lançado em {new Date(row.created_at).toLocaleString('pt-BR')}
                      {row.due_date ? ` • vence ${new Date(`${row.due_date}T12:00:00`).toLocaleDateString('pt-BR')}` : ''}
                    </div>
                    {row.notes && <p className="mt-2 break-words text-sm text-slate-600">{row.notes}</p>}
                    {Array.isArray(row.items) && row.items.length > 0 && (
                      <details className="mt-3 rounded-lg border bg-slate-50 px-3 py-2">
                        <summary className="cursor-pointer text-xs font-bold text-[#082F23]">
                          Ver itens da conta ({row.items.length})
                        </summary>
                        <div className="mt-2 space-y-1.5">
                          {row.items.map((item, index) => (
                            <div
                              key={item.id || `${row.id}-${index}`}
                              className="flex items-start justify-between gap-3 text-xs text-slate-600"
                            >
                              <span>{Number(item.quantity || 1)}x {getItemName(item)}</span>
                              <strong className="shrink-0 text-[#082F23]">{currency.format(getItemTotal(item))}</strong>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-[#082F23]">{currency.format(Number(row.amount || 0))}</div>
                    <Badge variant={row.status === 'open' ? 'destructive' : 'secondary'}>
                      {row.status === 'open' ? 'Pendente' : row.status === 'paid' ? 'Pago' : 'Cancelado'}
                    </Badge>
                  </div>
                </div>

                {row.status === 'open' ? (
                  <div className="mt-4 flex flex-col gap-2 border-t pt-3 sm:flex-row">
                    <Select
                      value={paymentMethods[row.id] || getDefaultPaymentMethod(row)}
                      onValueChange={(value) => setPaymentMethods((current) => ({ ...current, [row.id]: value }))}
                    >
                      <SelectTrigger className="sm:w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(paymentLabels)
                          .filter(([value]) => value !== 'desconto_folha' || row.debtor_type === 'employee')
                          .map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={() => void settle(row)} className="sm:flex-1">
                      Registrar pagamento
                    </Button>
                  </div>
                ) : row.payment_method ? (
                  <div className="mt-3 border-t pt-3 text-xs text-slate-500">
                    Baixado por {paymentLabels[row.payment_method] || row.payment_method}
                    {row.paid_at ? ` em ${new Date(row.paid_at).toLocaleString('pt-BR')}` : ''}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
    <AdminPinDialog
      open={pendingSettlement !== null}
      title="Autorizar baixa da conta"
      description="A baixa altera o saldo pendente e exige o PIN de um administrador."
      confirmLabel="Registrar pagamento"
      onCancel={() => setPendingSettlement(null)}
      onConfirm={async (pin) => {
        if (!user?.id || !pendingSettlement) return;
        const authorization = await verifyAdminPin({ restaurantUserId: user.id, pin });
        if (!authorization.ok || !authorization.waiterId) {
          toast({ title: 'Sem permissão', description: 'PIN inválido ou o operador não é administrador.', variant: 'destructive' });
          return;
        }
        const row = pendingSettlement;
        setPendingSettlement(null);
        await executeSettlement(row, authorization.waiterId);
      }}
    />
    </>
  );
};

export default StaffConsumptionManager;
