import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CreditCard, CheckCircle, Link as LinkIcon } from 'lucide-react';

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
  const [bank, setBank] = useState<string>('bb');
  const [pixKey, setPixKey] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');
  const [clientSecret, setClientSecret] = useState<string>('');
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [endpointBase, setEndpointBase] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      try {
        const { data } = await supabase
          .from('pix_settings' as any)
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data) {
          setBank(data.bank || 'bb');
          setPixKey(data.pix_key || '');
          setClientId(data.client_id || '');
          setClientSecret(data.client_secret || '');
          setWebhookUrl(data.webhook_url || '');
          setEndpointBase(data.endpoint_base || '');
        }
      } catch {}
    };
    load();
  }, [user?.id]);

  const save = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const payload = {
        user_id: user.id,
        bank,
        pix_key: pixKey,
        client_id: clientId || null,
        client_secret: clientSecret || null,
        webhook_url: webhookUrl || null,
        endpoint_base: endpointBase || null,
        updated_at: new Date().toISOString(),
      };
      const { data: existing } = await supabase
        .from('pix_settings' as any)
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (existing?.id) {
        await supabase.from('pix_settings' as any).update(payload).eq('id', existing.id);
      } else {
        await supabase.from('pix_settings' as any).insert(payload);
      }
      toast({ title: 'Configurações salvas', description: 'Pix Cobrança configurado' });
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
            <div>
              <Label>Chave Pix</Label>
              <Input value={pixKey} onChange={e => setPixKey(e.target.value)} placeholder="EVP, e-mail ou CNPJ" />
            </div>
            <div>
              <Label>Webhook (Pix Recebido)</Label>
              <Input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://seu-dominio.com/api/pix/webhook" />
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
