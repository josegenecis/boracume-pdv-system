import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ReceiptText, UserRoundCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

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

const StaffConsumptionManager: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<StaffConsumption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<Record<string, string>>({});

  const loadRows = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('staff_consumptions')
      .select('id,employee_name,amount,due_date,notes,status,payment_method,paid_at,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setLoading(false);

    if (error) {
      toast({
        title: 'Não foi possível carregar os consumos',
        description: error.message,
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

  const settle = async (row: StaffConsumption) => {
    const paymentMethod = paymentMethods[row.id] || 'desconto_folha';
    const { error } = await supabase.rpc('settle_staff_consumption', {
      p_receivable_id: row.id,
      p_payment_method: paymentMethod,
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
      title: 'Consumo baixado',
      description: `Pagamento de ${row.employee_name} registrado com sucesso.`,
    });
    await loadRows();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <ReceiptText size={16} />
          <span className="hidden sm:inline">Consumo de funcionários</span>
          {pendingCount > 0 && <Badge className="ml-1 bg-amber-500 text-white">{pendingCount}</Badge>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundCheck size={20} />
            Consumos de funcionários
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm text-amber-800">Total pendente</div>
          <div className="mt-1 text-2xl font-black text-amber-950">{currency.format(pendingTotal)}</div>
          <p className="mt-1 text-xs text-amber-700">
            A conta permanece registrada e a mesa é liberada sem apagar o histórico.
          </p>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Carregando consumos...</div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
            Nenhum consumo de funcionário registrado.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded-xl border bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-[#082F23]">{row.employee_name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Lançado em {new Date(row.created_at).toLocaleString('pt-BR')}
                      {row.due_date ? ` • vence ${new Date(`${row.due_date}T12:00:00`).toLocaleDateString('pt-BR')}` : ''}
                    </div>
                    {row.notes && <p className="mt-2 break-words text-sm text-slate-600">{row.notes}</p>}
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
                      value={paymentMethods[row.id] || 'desconto_folha'}
                      onValueChange={(value) => setPaymentMethods((current) => ({ ...current, [row.id]: value }))}
                    >
                      <SelectTrigger className="sm:w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(paymentLabels).map(([value, label]) => (
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
  );
};

export default StaffConsumptionManager;
