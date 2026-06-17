import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Save, UtensilsCrossed } from 'lucide-react';

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
      if (!data) return;

      setMode((data.table_order_mode || 'marked_items') as TableOrderMode);
      setShowInManager(data.show_table_orders_in_manager !== false);
      setAutoAccept(Boolean(data.auto_accept_table_orders));
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

      const { error } = await (supabase as any)
        .from('table_order_flow_settings')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) throw error;

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
