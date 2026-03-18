import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { invokeEdgeFunction } from '@/utils/invokeEdgeFunction';
import { CreditCard, Copy, RefreshCw } from 'lucide-react';

export default function PixSetup() {
  const { user } = useAuth();
  const activeUserId = user?.id || '';

  const { toast } = useToast();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const [enabled, setEnabled] = useState<boolean>(false);
  const [webhookSecret, setWebhookSecret] = useState<string>('');
  const [mpPdvEnabled, setMpPdvEnabled] = useState<boolean>(false);
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
          .select('*')
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
          setWebhookSecret(data.webhook_secret || '');
          setMpPdvEnabled(Boolean((data as any)?.mp_pdv_enabled));
          setMpConnected(Boolean(data.mp_access_token || data.client_id));
          setMpExpiresAt(data.mp_expires_at || '');
        }
      } catch (e) {
        console.error('Exceção ao carregar:', e);
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

  const generateWebhookSecret = () => {
    try {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      const secret = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      setWebhookSecret(secret);
      toast({ title: 'Segredo gerado', description: 'Copie e cadastre no seu banco/provedor' });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível gerar o segredo', variant: 'destructive' });
    }
  };

  const webhookEndpoint = supabaseUrl ? `${supabaseUrl}/functions/v1/pix-webhook?secret=${encodeURIComponent(webhookSecret || '')}` : '';

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copiado', description: label });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível copiar', variant: 'destructive' });
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
        webhook_secret: webhookSecret || null,
        mp_pdv_enabled: !!mpPdvEnabled,
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

  const testPix = async () => {
    if (!activeUserId) return alert('Faça login para testar.');
    if (!enabled || !mpConnected) return alert('Conecte o Mercado Pago e ative o PIX antes de testar.');
    
    setLoading(true);
    try {
      console.log('Iniciando teste Pix...');
      const { data, status } = await invokeEdgeFunction<any>('pix-start-checkout', {
        restaurantUserId: activeUserId,
        orderPayload: { total: 1.0, customer_name: 'Teste Admin', payment_method: 'pix' },
        preferredMethod: 'pix'
      })

      console.log('Resposta do teste:', data);

      if (!data) {
        throw new Error(`Sem resposta JSON (HTTP ${status})`)
      }

      if (!data.ok) {
        throw new Error(data.error || `Erro desconhecido na resposta (HTTP ${status})`)
      }

      toast({ 
        title: 'Teste com Sucesso!', 
        description: 'QR Code gerado corretamente. Integração OK.' 
      });
      
      if (data.brCode) {
        console.log('Copia e Cola:', data.brCode);
        alert(`Sucesso! Copia e Cola gerado (veja console). Link: ${data.paymentLinkUrl}`);
      }

    } catch (e: any) {
      console.error('Erro no teste:', e);
      alert(`Erro no teste: ${e.message}. Verifique o console.`);
    } finally {
      setLoading(false);
    }
  };

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
                Você será redirecionado para autorizar o BoraCumê.
              </p>
              {mpConnected ? (
                <p className="text-xs text-blue-700 mt-2">
                  Conectado. {mpExpiresAt ? `Token expira em: ${new Date(mpExpiresAt).toLocaleString('pt-BR')}` : ''}
                </p>
              ) : null}
            </div>

            <div className="md:col-span-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>
              {!mpConnected ? (
                <p className="text-xs text-muted-foreground mt-2">
                  Conecte o Mercado Pago para habilitar o PIX.
                </p>
              ) : null}
            </div>
            <div className="md:col-span-3">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label>Segredo do Webhook</Label>
                  <Input value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)} placeholder="Gere um segredo para validar o webhook" />
                </div>
                <Button variant="outline" onClick={generateWebhookSecret}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Gerar
                </Button>
                <Button variant="outline" onClick={() => copy(webhookSecret, 'Segredo do webhook')}>
                  <Copy className="h-4 w-4 mr-1" />
                  Copiar
                </Button>
              </div>
            </div>
            <div className="md:col-span-3">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label>URL do Webhook (copiar e cadastrar no Mercado Pago)</Label>
                  <Input value={webhookEndpoint} readOnly placeholder="Configure VITE_SUPABASE_URL para gerar a URL" />
                </div>
                <Button variant="outline" onClick={() => copy(webhookEndpoint, 'URL do webhook')} disabled={!webhookEndpoint}>
                  <Copy className="h-4 w-4 mr-1" />
                  Copiar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                No Mercado Pago, configure a notificação/webhook para esta URL. O sistema cria o pedido automaticamente quando o pagamento ficar aprovado.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <Button onClick={save} disabled={loading}>
              {loading ? 'Processando...' : 'Salvar Configurações'}
            </Button>
            
            <Button variant="secondary" onClick={testPix} disabled={loading || !enabled || !mpConnected}>
              Testar Integração (R$ 1,00)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
