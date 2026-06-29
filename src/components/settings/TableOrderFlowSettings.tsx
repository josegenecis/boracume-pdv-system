import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BadgePercent, Save, UtensilsCrossed } from 'lucide-react';

type TableOrderMode = 'marked_items' | 'all_items' | 'account_only';

const modeDescriptions: Record<TableOrderMode, string> = {
  marked_items: 'Somente produtos marcados para cozinha aparecem no preparo e no gestor de pedidos.',
  all_items: 'Tudo que o garçom lançar na mesa vira pedido para preparo e aparece no gestor.',
  account_only: 'Itens entram apenas na conta da mesa. Ideal para self-service, buffet, consumo rápido e balcão interno.',
};

const TableOrderFlowSettings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<TableOrderMode>('marked_items');
  const [showInManager, setShowInManager] = useState(true);
  const [autoAccept, setAutoAccept] = useState(false);
  const [serviceChargeAutoApply, setServiceChargeAutoApply] = useState(false);
  const [serviceChargePercentage, setServiceChargePercentage] = useState(10);
  const [serviceChargeTaxWithhold, setServiceChargeTaxWithhold] = useState(0);

  useEffect(() => {
    if (user?.id) void loadSettings();
  }, [user?.id]);

  const loadSettings = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('table_order_flow_settings')
        .select('table_order_mode, show_table_orders_in_manager, auto_accept_table_orders')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setMode((data.table_order_mode || 'marked_items') as TableOrderMode);
        setShowInManager(data.show_table_orders_in_manager !== false);
        setAutoAccept(Boolean(data.auto_accept_table_orders));
      }

      const { data: serviceData, error: serviceError } = await (supabase as any)
        .from('waiter_service_charge_settings')
        .select('enabled, auto_apply, percentage, tax_withhold_percent')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (serviceError && serviceError.code !== 'PGRST116') throw serviceError;
      if (serviceData) {
        setServiceChargeAutoApply(Boolean(serviceData.auto_apply));
        setServiceChargePercentage(Number(serviceData.percentage ?? 10));
        setServiceChargeTaxWithhold(Number(serviceData.tax_withhold_percent ?? 0));
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar mesas',
        description: error?.message || 'Não foi possível carregar a configuração de mesas.',
        variant: 'destructive',
      });
    }
  };

  const saveSettings = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const payload = {
        user_id: user.id,
        table_order_mode: mode,
        show_table_orders_in_manager: mode === 'account_only' ? false : showInManager,
        auto_accept_table_orders: mode === 'account_only' ? false : autoAccept,
      };
      const percentage = Math.min(30, Math.max(0, Number(serviceChargePercentage || 0)));
      const taxWithholdPercent = Math.min(100, Math.max(0, Number(serviceChargeTaxWithhold || 0)));

      const { error } = await (supabase as any)
        .from('table_order_flow_settings')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) throw error;

      const { error: serviceError } = await (supabase as any)
        .from('waiter_service_charge_settings')
        .upsert({
          user_id: user.id,
          enabled: true,
          auto_apply: serviceChargeAutoApply,
          percentage,
          tax_withhold_percent: taxWithholdPercent,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (serviceError) throw serviceError;
      setServiceChargePercentage(percentage);
      setServiceChargeTaxWithhold(taxWithholdPercent);

      toast({
        title: 'Configuração salva',
        description: 'O fluxo das mesas foi atualizado.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error?.message || 'Não foi possível salvar a configuração de mesas.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const managerDisabled = mode === 'account_only';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#003223]">
          <UtensilsCrossed className="h-5 w-5 text-[#FF6400]" />
          Mesas e comandas
        </CardTitle>
        <CardDescription>
          Defina se os pedidos lançados em mesa vão para a cozinha, aparecem no gestor de pedidos ou ficam só na conta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Fluxo dos itens lançados na mesa</Label>
          <Select value={mode} onValueChange={(value) => setMode(value as TableOrderMode)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="marked_items">Somente itens marcados para cozinha</SelectItem>
              <SelectItem value="all_items">Todos os itens vão para cozinha/gestor</SelectItem>
              <SelectItem value="account_only">Self-service: apenas conta da mesa</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">{modeDescriptions[mode]}</p>
        </div>

        <div className="rounded-lg border bg-[#F8FAF8] p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-base">Mostrar pedidos de mesa no gestor de pedidos</Label>
              <p className="text-sm text-muted-foreground">
                Quando desligado, o garçom lança na mesa, mas não cria pedido na tela de Pedidos/Cozinha.
              </p>
            </div>
            <Switch
              checked={!managerDisabled && showInManager}
              disabled={managerDisabled}
              onCheckedChange={setShowInManager}
            />
          </div>
        </div>

        <div className="rounded-lg border bg-[#F8FAF8] p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-base">Entrar direto em preparo</Label>
              <p className="text-sm text-muted-foreground">
                Use quando a cozinha não precisa aceitar o pedido antes de começar.
              </p>
            </div>
            <Switch
              checked={!managerDisabled && autoAccept}
              disabled={managerDisabled}
              onCheckedChange={setAutoAccept}
            />
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4">
          <div className="mb-4 flex items-start gap-3">
            <BadgePercent className="mt-1 h-5 w-5 text-[#FF6400]" />
            <div>
              <Label className="text-base">Taxa de serviço do garçom</Label>
              <p className="text-sm text-muted-foreground">
                Controle os 10% nas mesas. Se a cobrança automática estiver desligada, o app garçom ainda pode perguntar quando o cliente autorizar.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr,0.55fr,0.55fr]">
            <div className="flex items-center justify-between gap-4 rounded-lg border bg-white/70 p-4">
              <div>
                <Label className="text-base">Cobrar 10% automaticamente no app garçom</Label>
                <p className="text-sm text-muted-foreground">
                  Ao fechar a mesa, a taxa já entra marcada. O garçom pode desmarcar se o cliente não aceitar.
                </p>
              </div>
              <Switch checked={serviceChargeAutoApply} onCheckedChange={setServiceChargeAutoApply} />
            </div>

            <div className="space-y-2">
              <Label>Percentual</Label>
              <Input
                type="number"
                min="0"
                max="30"
                step="0.1"
                value={serviceChargePercentage}
                onChange={(event) => setServiceChargePercentage(Number(event.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label>Retenção (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={serviceChargeTaxWithhold}
                onChange={(event) => setServiceChargeTaxWithhold(Number(event.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={saveSettings} disabled={loading} className="bg-[#FF6400] hover:bg-[#E55A00]">
            <Save className="mr-2 h-4 w-4" />
            {loading ? 'Salvando...' : 'Salvar configuração'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TableOrderFlowSettings;
