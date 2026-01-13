import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CreditCard, Copy, RefreshCw } from 'lucide-react';

export default function PixSetup() {
  const { user } = useAuth();
  const { toast } = useToast();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const bank = 'mercadopago';
  const [enabled, setEnabled] = useState<boolean>(false);
  const [accessToken, setAccessToken] = useState<string>('');
  const [webhookSecret, setWebhookSecret] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      try {
        const { data } = await (supabase as any)
          .from('pix_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data) {
          setEnabled(!!data.enabled);
          setAccessToken(data.client_id || '');
          setWebhookSecret(data.webhook_secret || '');
        }
      } catch {}
    };
    load();
  }, [user?.id]);

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
    if (!user?.id) return;
    setLoading(true);
    try {
      const payload = {
        user_id: user.id,
        enabled,
        bank,
        client_id: accessToken || null,
        pix_key: null,
        merchant_name: null,
        merchant_city: null,
        client_secret: null,
        webhook_secret: webhookSecret || null,
        endpoint_base: null,
        updated_at: new Date().toISOString(),
      };
      const { data: existing } = await (supabase as any)
        .from('pix_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (existing?.id) {
        await (supabase as any).from('pix_settings').update(payload).eq('id', existing.id);
      } else {
        await (supabase as any).from('pix_settings').insert(payload);
      }
      toast({ title: 'Configurações salvas', description: 'Mercado Pago configurado para o restaurante' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message || 'Verifique campos e tente novamente', variant: 'destructive' });
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
                Use o Mercado Pago como gateway para PIX, crédito e débito. O pedido só entra no sistema após confirmação do pagamento.
              </p>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label>Ativar pagamentos</Label>
                <div className="mt-2 flex items-center gap-2">
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                  <span className="text-sm text-muted-foreground">{enabled ? 'Ativo' : 'Inativo'}</span>
                </div>
              </div>
            </div>
            <div>
              <Label>Access Token (Mercado Pago)</Label>
              <Input type="password" value={accessToken} onChange={e => setAccessToken(e.target.value)} placeholder="Cole o Access Token da conta do restaurante" />
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
          <Button onClick={save} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
