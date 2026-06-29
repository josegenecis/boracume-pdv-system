import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { invokeEdgeFunction } from '@/utils/invokeEdgeFunction';
import { CreditCard } from 'lucide-react';

export default function PixSetup() {
  const { user } = useAuth();
  const activeUserId = user?.id || '';

  const { toast } = useToast();
  const [enabled, setEnabled] = useState<boolean>(false);
  const [mpPdvEnabled, setMpPdvEnabled] = useState<boolean>(false);
  const [mpWaiterEnabled, setMpWaiterEnabled] = useState<boolean>(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mpConnected, setMpConnected] = useState(false);
  const [mpExpiresAt, setMpExpiresAt] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      if (!activeUserId) return;
      try {
        console.log('Carregando configurações Pix para usuário:', activeUserId);
        const { data, error } = await (supabase as any)
          .from('pix_settings')
          .select('enabled, mp_pdv_enabled, mp_waiter_enabled, mp_access_token, client_id, mp_expires_at')
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
          setMpConnected(Boolean(data.mp_access_token || data.client_id));
          setMpExpiresAt(data.mp_expires_at || '');
        }
      } catch (e) {
        console.error('Exceção ao carregar:', e);
      } finally {
        setLoaded(true);
      }
    };
    load();
  }, [activeUserId]);

  const connectMercadoPago = async () => {
    if (!activeUserId) {
      toast({ title: 'Faça login', description: 'Entre no sistema para conectar o Mercado Pago.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, status } = await invokeEdgeFunction<any>('mp-oauth-start', {}, { timeoutMs: 60000 });
      if (!data || !data.ok || !data.url) {
        throw new Error(data?.message || data?.error || `Falha ao iniciar OAuth (HTTP ${status})`);
      }
      window.location.href = String(data.url);
    } catch (e: any) {
      toast({ title: 'Erro ao conectar', description: e.message || 'Falha ao iniciar conexão.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const disconnectMercadoPago = async () => {
    if (!activeUserId) return;
    setLoading(true);
    try {
      const { error } = await (supabase as any)
        .from('pix_settings')
        .upsert({
          user_id: activeUserId,
          enabled: false,
          mp_pdv_enabled: false,
          mp_waiter_enabled: false,
          mp_access_token: null,
          mp_refresh_token: null,
          mp_expires_at: null,
          client_id: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) throw error;
      setEnabled(false);
      setMpPdvEnabled(false);
      setMpWaiterEnabled(false);
      setMpConnected(false);
      setMpExpiresAt('');
      toast({ title: 'Mercado Pago desconectado', description: 'A conta foi removida do sistema com sucesso.' });
    } catch (e: any) {
      toast({ title: 'Erro ao desconectar', description: e?.message || 'Não foi possível desconectar.', variant: 'destructive' });
    } finally {
      setLoading(false);
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
      toast({ title: 'Configurações salvas', description: 'Mercado Pago configurado para o restaurante' });
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
    if (!mpConnected) return;
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
  }, [loaded, activeUserId, mpConnected, enabled, mpPdvEnabled, mpWaiterEnabled]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Pagamentos (Mercado Pago)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <p className="text-sm text-muted-foreground">
                Configure PIX do Mercado Pago para o Cardápio Digital e PDV.
              </p>
            </div>
            <div className="md:col-span-3 bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
              <h3 className="font-semibold text-blue-900 mb-2">Conexão Recomendada (Mercado Pago)</h3>
              <p className="text-sm text-blue-700 mb-4">
                Conecte sua conta Mercado Pago automaticamente para receber pagamentos via PIX.
                Não é necessário copiar chaves manualmente.
              </p>
              <Button 
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700" 
                onClick={connectMercadoPago}
                disabled={loading}
              >
                {mpConnected ? 'Reconectar Mercado Pago' : 'Conectar com Mercado Pago'}
              </Button>
              <p className="text-xs text-blue-500 mt-2">
                Você será redirecionado para autorizar o PopSystem.
              </p>
              {mpConnected ? (
                <p className="text-xs text-blue-700 mt-2">
                  Conectado. {mpExpiresAt ? `Token expira em: ${new Date(mpExpiresAt).toLocaleString('pt-BR')}` : ''}
                </p>
              ) : null}
              {mpConnected ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto border-red-200 text-red-700 hover:bg-red-50"
                    onClick={disconnectMercadoPago}
                    disabled={loading}
                  >
                    Desconectar Mercado Pago
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="md:col-span-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex-1">
                  <Label>Ativar PIX (Mercado Pago)</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <Switch checked={enabled} onCheckedChange={setEnabled} disabled={!mpConnected} />
                    <span className="text-sm text-muted-foreground">{enabled ? 'Ativo' : 'Inativo'}</span>
                  </div>
                </div>
                <div className="flex-1">
                  <Label>Ativar Mercado Pago no PDV</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <Switch checked={mpPdvEnabled} onCheckedChange={setMpPdvEnabled} disabled={!mpConnected || !enabled} />
                    <span className="text-sm text-muted-foreground">{mpPdvEnabled ? 'Ativo' : 'Inativo'}</span>
                  </div>
                </div>
                <div className="flex-1">
                  <Label>Gerar QR Code no App Garçom</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <Switch checked={mpWaiterEnabled} onCheckedChange={setMpWaiterEnabled} disabled={!mpConnected || !enabled} />
                    <span className="text-sm text-muted-foreground">{mpWaiterEnabled ? 'Ativo' : 'Inativo'}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Quando ativo, o garçom pode receber PIX online por QR Code no celular ou no app web.
                  </p>
                </div>
              </div>
              {!mpConnected ? (
                <p className="text-xs text-muted-foreground mt-2">
                  Conecte o Mercado Pago para habilitar o PIX.
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex gap-4">
            <Button onClick={save} disabled={loading}>
              {loading ? 'Processando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
