import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CreditCard, Link as LinkIcon, Copy, RefreshCw } from 'lucide-react';

const BANKS = [
  { id: 'bb', name: 'Banco do Brasil', brandColor: '#FFCC00', site: 'https://developers.bb.com.br', steps: ['Habilitar Pix Cobrança (PJ)', 'Criar credenciais OAuth/MTLS', 'Cadastrar URL de webhook', 'Gerar QR Dinâmico por pedido'] },
  { id: 'itau', name: 'Itaú', brandColor: '#FF6900', site: 'https://developer.itau.com.br', steps: ['Habilitar Pix Cobrança', 'Criar client id/secret', 'Cadastrar webhook (pix)', 'Usar txid para conciliação'] },
  { id: 'bradesco', name: 'Bradesco', brandColor: '#C40018', site: 'https://portaldesenvolvedor.bradesco', steps: ['Habilitar Pix', 'Credenciais e certificados (se exigido)', 'Webhook de recebimento', 'Consulta de cobrança'] },
  { id: 'inter', name: 'Inter', brandColor: '#FF6C00', site: 'https://developers.inter.co', steps: ['Habilitar API Pix', 'Gerar client id/secret', 'Webhook de pagamento', 'QR dinâmico por pedido'] },
  { id: 'sicoob', name: 'Sicoob', brandColor: '#0A6D5E', site: 'https://developers.sicoob.com.br', steps: ['Habilitar Pix PJ', 'Credenciais e certificado', 'Webhook (pix)', 'Conciliação automática'] },
  { id: 'c6', name: 'C6 Bank', brandColor: '#000000', site: 'https://developers.c6bank.com.br', steps: ['Habilitar Pix', 'Client id/secret', 'Webhook de recebimento', 'QR dinâmico'] },
];

export default function PixSetup() {
  const { user } = useAuth();
  const { toast } = useToast();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const [bank, setBank] = useState<string>('bb');
  const [enabled, setEnabled] = useState<boolean>(false);
  const [pixKey, setPixKey] = useState<string>('');
  const [merchantName, setMerchantName] = useState<string>('');
  const [merchantCity, setMerchantCity] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');
  const [clientSecret, setClientSecret] = useState<string>('');
  const [webhookSecret, setWebhookSecret] = useState<string>('');
  const [endpointBase, setEndpointBase] = useState<string>('');
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
          setBank(data.bank || 'bb');
          setEnabled(!!data.enabled);
          setPixKey(data.pix_key || '');
          setMerchantName(data.merchant_name || '');
          setMerchantCity(data.merchant_city || '');
          setClientId(data.client_id || '');
          setClientSecret(data.client_secret || '');
          setWebhookSecret(data.webhook_secret || '');
          setEndpointBase(data.endpoint_base || '');
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
        pix_key: pixKey,
        merchant_name: merchantName || null,
        merchant_city: merchantCity || null,
        client_id: clientId || null,
        client_secret: clientSecret || null,
        webhook_secret: webhookSecret || null,
        endpoint_base: endpointBase || null,
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
      toast({ title: 'Configurações salvas', description: 'Pix configurado para o restaurante' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message || 'Verifique campos e tente novamente', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const selected = BANKS.find(b => b.id === bank)!;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Configurar Pix Cobrança
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Banco</Label>
              <Select value={bank} onValueChange={setBank}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BANKS.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: b.brandColor }} />
                        {b.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label>Ativar PIX</Label>
                <div className="mt-2 flex items-center gap-2">
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                  <span className="text-sm text-muted-foreground">{enabled ? 'Ativo' : 'Inativo'}</span>
                </div>
              </div>
            </div>
            <div>
              <Label>Chave Pix</Label>
              <Input value={pixKey} onChange={e => setPixKey(e.target.value)} placeholder="EVP, e-mail ou CNPJ" />
            </div>
            <div>
              <Label>Nome do Recebedor</Label>
              <Input value={merchantName} onChange={e => setMerchantName(e.target.value)} placeholder="Nome que aparece no PIX" />
            </div>
            <div>
              <Label>Cidade do Recebedor</Label>
              <Input value={merchantCity} onChange={e => setMerchantCity(e.target.value)} placeholder="Ex.: SAO PAULO" />
            </div>
            <div>
              <Label>Client ID</Label>
              <Input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="Opcional (bancos com OAuth)" />
            </div>
            <div>
              <Label>Client Secret</Label>
              <Input type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} placeholder="Opcional" />
            </div>
            <div>
              <Label>Endpoint Base da API</Label>
              <Input value={endpointBase} onChange={e => setEndpointBase(e.target.value)} placeholder="ex.: https://api.seubanco.com/pix" />
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
                  <Label>URL do Webhook (copiar e cadastrar no banco)</Label>
                  <Input value={webhookEndpoint} readOnly placeholder="Configure VITE_SUPABASE_URL para gerar a URL" />
                </div>
                <Button variant="outline" onClick={() => copy(webhookEndpoint, 'URL do webhook')} disabled={!webhookEndpoint}>
                  <Copy className="h-4 w-4 mr-1" />
                  Copiar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                O banco/provedor deve enviar: order_id e status=paid/approved. O sistema libera o pedido automaticamente.
              </p>
            </div>
          </div>
          <Button onClick={save} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge style={{ backgroundColor: selected.brandColor }} className="text-white">{selected.name}</Badge>
              <Button variant="outline" size="sm" onClick={() => window.open(selected.site, '_blank')}>
                <LinkIcon className="h-4 w-4 mr-1" />
                Portal do Desenvolvedor
              </Button>
            </div>
            <ul className="list-disc list-inside text-sm text-muted-foreground">
              {selected.steps.map((s, i) => (<li key={i}>{s}</li>))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Após habilitar, o sistema gera o QR Dinâmico por pedido e confirma automaticamente via webhook.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
