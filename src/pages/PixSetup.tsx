import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { invokeEdgeFunction } from '@/utils/invokeEdgeFunction';
import { ShieldCheck, WalletCards } from 'lucide-react';

export default function PixSetup() {
  const { user } = useAuth();
  const activeUserId = user?.id || '';

  const { toast } = useToast();
  const [enabled, setEnabled] = useState<boolean>(false);
  const [mpPdvEnabled, setMpPdvEnabled] = useState<boolean>(false);
  const [mpWaiterEnabled, setMpWaiterEnabled] = useState<boolean>(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [popPayLoading, setPopPayLoading] = useState(false);
  const [popPayConfigured, setPopPayConfigured] = useState(false);
  const [popPayConnected, setPopPayConnected] = useState(false);
  const [popPayExpiresAt, setPopPayExpiresAt] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!activeUserId) return;
      try {
        console.log('Carregando configurações Pix para usuário:', activeUserId);
        const { data, error } = await (supabase as any)
          .from('pix_settings')
          .select('enabled, mp_pdv_enabled, mp_waiter_enabled')
          .eq('user_id', activeUserId)
          .maybeSingle();

        if (error) {
          console.error('Erro ao carregar configurações:', error);
          toast({ 
            title: 'Erro ao carregar', 
            description: error.message, 
            variant: 'destructive' 
          });
          return;
        }

        console.log('Dados carregados:', data);

        if (data) {
          setEnabled(!!data.enabled);
          setMpPdvEnabled(Boolean((data as any)?.mp_pdv_enabled));
          setMpWaiterEnabled(Boolean((data as any)?.mp_waiter_enabled));
        }
      } catch (e) {
        console.error('Exceção ao carregar:', e);
      } finally {
        setLoaded(true);
      }
    };
    load();
  }, [activeUserId]);

  const loadPopPay = useCallback(async () => {
    if (!activeUserId) return;
    const { data } = await invokeEdgeFunction('poppay-settings', { action: 'status' }, { timeoutMs: 20000 });
    setPopPayConfigured(Boolean(data?.configured));
    setPopPayConnected(data?.connection?.status === 'connected' && data?.connection?.enabled !== false);
    setPopPayExpiresAt(String(data?.connection?.expires_at || ''));
  }, [activeUserId]);

  useEffect(() => {
    void loadPopPay();
  }, [loadPopPay]);

  const connectPopPay = async () => {
    setPopPayLoading(true);
    try {
      const { data, status } = await invokeEdgeFunction('poppay-oauth-start', {}, { timeoutMs: 60000 });
      if (status >= 400 || !data?.ok || !data?.url) throw new Error(data?.message || data?.error || 'Não foi possível iniciar o PopPay.');
      window.location.href = String(data.url);
    } catch (error: unknown) {
      toast({ title: 'PopPay indisponível', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    } finally {
      setPopPayLoading(false);
    }
  };

  const save = async () => {
    if (!activeUserId) {
      toast({ title: 'Faça login', description: 'Entre no sistema para salvar a chave PIX.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      console.log('Salvando configurações Pix (Upsert)...', { user_id: activeUserId });
      
      const payload = {
        user_id: activeUserId,
        enabled: !!enabled,
        bank: 'mercadopago',
        mp_pdv_enabled: !!mpPdvEnabled,
        mp_waiter_enabled: !!mpWaiterEnabled,
        updated_at: new Date().toISOString(),
      };

      // Usar upsert para simplificar e evitar erros de "check existence"
      const result = await (supabase as any)
        .from('pix_settings')
        .upsert(payload, { onConflict: 'user_id' })
        .select();

      if (result.error) throw result.error;

      console.log('Salvo com sucesso:', result.data);
      toast({ title: 'Configurações salvas', description: 'PopPay configurado para o restaurante.' });
    } catch (e: any) {
      console.error('Erro detalhado ao salvar:', e);
      toast({ 
        title: 'Erro ao salvar', 
        description: `Erro: ${e.message || 'Desconhecido'} ${e.details ? `(${e.details})` : ''} ${e.hint ? `- Dica: ${e.hint}` : ''}`, 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loaded || !activeUserId) return;
    if (!popPayConnected) return;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const payload = {
            user_id: activeUserId,
            enabled: !!enabled,
            bank: 'mercadopago',
            mp_pdv_enabled: !!mpPdvEnabled,
            mp_waiter_enabled: !!mpWaiterEnabled,
            updated_at: new Date().toISOString(),
          };

          const result = await (supabase as any)
            .from('pix_settings')
            .upsert(payload, { onConflict: 'user_id' })
            .select();

          if (result.error) throw result.error;
        } catch (e: any) {
          toast({
            title: 'Erro ao salvar',
            description: e?.message || 'Não foi possível salvar as configurações.',
            variant: 'destructive',
          });
        }
      })();
    }, 400);
    return () => clearTimeout(timer);
  }, [loaded, activeUserId, popPayConnected, enabled, mpPdvEnabled, mpWaiterEnabled]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <Card className="overflow-hidden border-emerald-200 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-emerald-950 via-emerald-800 to-orange-500 text-white">
          <CardTitle className="flex items-center gap-2"><WalletCards className="h-5 w-5" />PopPay</CardTitle>
          <p className="text-sm text-emerald-50">Recebimento PIX integrado, conciliação e devolução pelo próprio PopSystem.</p>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div>
              <p className="font-medium text-emerald-950">Pagamento integrado</p>
              <p className="text-sm text-emerald-800">O PopPay gera o QR Code, confirma o pagamento e atualiza o pedido automaticamente.</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{popPayConnected ? 'Conta conectada ao PopPay' : 'Conecte sua conta Mercado Pago'}</p>
              <p className="text-sm text-muted-foreground">
                {popPayConnected
                  ? `Conta pronta para receber pagamentos.${popPayExpiresAt ? ` Autorização válida até ${new Date(popPayExpiresAt).toLocaleDateString('pt-BR')}.` : ''}`
                  : popPayConfigured ? 'A autorização é feita diretamente no Mercado Pago.' : 'A aplicação PopPay ainda aguarda as credenciais de produção.'}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={connectPopPay} disabled={popPayLoading || !popPayConfigured} className="bg-emerald-700 hover:bg-emerald-800">
                {popPayConnected ? 'Reconectar PopPay' : 'Conectar PopPay'}
              </Button>
            </div>
          </div>
          <div className="border-t border-emerald-100 pt-5">
            <p className="mb-4 text-sm text-muted-foreground">Escolha onde o pagamento PIX online do PopPay estará disponível.</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="flex-1">
                  <Label>Ativar PIX online (PopPay)</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <Switch checked={enabled} onCheckedChange={setEnabled} disabled={!popPayConnected} />
                    <span className="text-sm text-muted-foreground">{enabled ? 'Ativo' : 'Inativo'}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Exibe o pagamento imediato no Cardápio Digital.</p>
                </div>
                <div className="flex-1">
                  <Label>Ativar PopPay no PDV</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <Switch checked={mpPdvEnabled} onCheckedChange={setMpPdvEnabled} disabled={!popPayConnected || !enabled} />
                    <span className="text-sm text-muted-foreground">{mpPdvEnabled ? 'Ativo' : 'Inativo'}</span>
                  </div>
                </div>
                <div className="flex-1">
                  <Label>Gerar QR Code PopPay no App Garçom</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <Switch checked={mpWaiterEnabled} onCheckedChange={setMpWaiterEnabled} disabled={!popPayConnected || !enabled} />
                    <span className="text-sm text-muted-foreground">{mpWaiterEnabled ? 'Ativo' : 'Inativo'}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Quando ativo, o garçom pode receber PIX online por QR Code no celular ou no app web.
                  </p>
                </div>
            </div>
              {!popPayConnected ? (
                <p className="text-xs text-muted-foreground mt-2">
                  Conecte o PopPay para habilitar o PIX online.
                </p>
              ) : null}
          </div>
          <div className="flex gap-4 border-t border-emerald-100 pt-4">
            <Button onClick={save} disabled={loading}>
              {loading ? 'Processando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
