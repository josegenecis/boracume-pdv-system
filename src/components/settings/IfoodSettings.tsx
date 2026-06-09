import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { invokeEdgeFunction } from '@/utils/invokeEdgeFunction';
import { IfoodLogo } from '@/components/icons/IfoodLogo';

type MerchantOption = {
  id: string;
  name: string;
  corporateName?: string;
};

type IfoodSettingsData = {
  merchant_id: string;
  merchant_name: string;
  merchant_state: string;
  merchant_enabled: boolean;
  status: 'online' | 'offline' | 'paused';
  client_id: string;
  client_secret_configured: boolean;
  access_token_configured: boolean;
  access_token_expires_at: string | null;
  webhook_url: string;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_message: string | null;
};

const emptySettings: IfoodSettingsData = {
  merchant_id: '',
  merchant_name: '',
  merchant_state: 'offline',
  merchant_enabled: false,
  status: 'offline',
  client_id: '',
  client_secret_configured: false,
  access_token_configured: false,
  access_token_expires_at: null,
  webhook_url: '',
  last_sync_at: null,
  last_sync_status: null,
  last_sync_message: null,
};

const IfoodSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [settings, setSettings] = useState<IfoodSettingsData>(emptySettings);
  const [merchants, setMerchants] = useState<MerchantOption[]>([]);
  const [merchantStatus, setMerchantStatus] = useState<any>(null);
  const [formData, setFormData] = useState({
    clientId: '',
    clientSecret: '',
    merchantId: '',
  });

  const loadOverview = async () => {
    try {
      setLoading(true);
      const { data, status } = await invokeEdgeFunction('ifood-manager', { action: 'overview' });
      if (status >= 400 || !data?.ok) {
        throw new Error(String(data?.message || data?.error || 'Não foi possível carregar iFood'));
      }

      const nextSettings = { ...emptySettings, ...(data.settings || {}) };
      setSettings(nextSettings);
      setMerchants(Array.isArray(data.merchants) ? data.merchants : []);
      setMerchantStatus(data.merchantStatus || null);
      setFormData((prev) => ({
        clientId: nextSettings.client_id || prev.clientId,
        clientSecret: '',
        merchantId: nextSettings.merchant_id || prev.merchantId,
      }));
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar iFood',
        description: String(error?.message || error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const handleSaveCredentials = async () => {
    try {
      setLoading(true);
      const { data, status } = await invokeEdgeFunction('ifood-manager', {
        action: 'save_credentials',
        clientId: formData.clientId,
        clientSecret: formData.clientSecret,
        merchantId: formData.merchantId,
        merchantEnabled: settings.merchant_enabled,
      });

      if (status >= 400 || !data?.ok) {
        throw new Error(String(data?.message || data?.error || 'Falha ao validar credenciais'));
      }

      toast({
        title: 'iFood conectado',
        description: 'Credenciais validadas e merchants carregados com sucesso.',
      });

      setFormData((prev) => ({ ...prev, clientSecret: '', merchantId: data?.settings?.merchant_id || prev.merchantId }));
      await loadOverview();
    } catch (error: any) {
      toast({
        title: 'Falha na conexão',
        description: String(error?.message || error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMerchant = async (merchantId: string) => {
    setFormData((prev) => ({ ...prev, merchantId }));
    if (!merchantId) return;

    try {
      setLoading(true);
      const { data, status } = await invokeEdgeFunction('ifood-manager', {
        action: 'select_merchant',
        merchantId,
      });

      if (status >= 400 || !data?.ok) {
        throw new Error(String(data?.message || data?.error || 'Falha ao selecionar merchant'));
      }

      toast({
        title: 'Loja vinculada',
        description: 'Merchant iFood vinculado ao PopSystem.',
      });
      await loadOverview();
    } catch (error: any) {
      toast({
        title: 'Erro ao vincular loja',
        description: String(error?.message || error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = async (checked: boolean) => {
    try {
      setLoading(true);
      const { data, status } = await invokeEdgeFunction('ifood-manager', {
        action: 'toggle_enabled',
        enabled: checked,
      });

      if (status >= 400 || !data?.ok) {
        throw new Error(String(data?.message || data?.error || 'Falha ao alternar integração'));
      }

      setSettings((prev) => ({
        ...prev,
        ...(data.settings || {}),
      }));
      toast({
        title: checked ? 'Integração ativada' : 'Integração pausada',
        description: checked
          ? 'O PopSystem está pronto para receber pedidos do iFood.'
          : 'O PopSystem parou de processar pedidos do iFood.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao alterar status',
        description: String(error?.message || error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncEvents = async () => {
    try {
      setSyncing(true);
      const { data, status } = await invokeEdgeFunction('ifood-manager', {
        action: 'sync_events',
      });

      if (status >= 400 || !data?.ok) {
        throw new Error(String(data?.message || data?.error || 'Falha ao sincronizar eventos'));
      }

      toast({
        title: 'Sincronização concluída',
        description: `${data?.summary?.processed || 0} evento(s) processado(s).`,
      });
      await loadOverview();
    } catch (error: any) {
      toast({
        title: 'Erro na sincronização',
        description: String(error?.message || error),
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  const formatDateTime = (value: string | null) => {
    if (!value) return 'Ainda não sincronizado';
    try {
      return new Date(value).toLocaleString('pt-BR');
    } catch {
      return value;
    }
  };

  const statusTone =
    settings.status === 'online'
      ? 'bg-green-100 text-green-700 border-green-200'
      : 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IfoodLogo className="h-8 w-auto" />
            <span>Integração iFood</span>
          </CardTitle>
          <CardDescription>
            Conecte o aplicativo oficial, vincule a loja e deixe o PopSystem pronto para homologação do módulo de pedidos.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Badge variant="outline" className={statusTone}>
              {settings.status === 'online' ? 'Online' : 'Offline'}
            </Badge>
            <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
              {settings.merchant_name || 'Nenhum merchant selecionado'}
            </Badge>
            {merchantStatus?.state ? (
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                Loja iFood: {String(merchantStatus.state)}
              </Badge>
            ) : null}
          </div>

          <div className="flex items-center justify-between rounded-xl border px-4 py-3">
            <div className="space-y-1">
              <div className="font-medium">Receber pedidos do iFood</div>
              <div className="text-sm text-muted-foreground">
                Ative só quando as credenciais e a loja já estiverem validadas.
              </div>
            </div>
            <Switch
              checked={settings.merchant_enabled}
              onCheckedChange={handleToggleEnabled}
              disabled={loading || !settings.client_secret_configured || !settings.merchant_id}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ifood-client-id">Client ID</Label>
              <Input
                id="ifood-client-id"
                placeholder="Cole o clientId do app iFood"
                value={formData.clientId}
                onChange={(e) => setFormData((prev) => ({ ...prev, clientId: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ifood-client-secret">Client Secret</Label>
              <Input
                id="ifood-client-secret"
                type="password"
                placeholder={settings.client_secret_configured ? 'Já configurado. Preencha só para trocar.' : 'Cole o clientSecret'}
                value={formData.clientSecret}
                onChange={(e) => setFormData((prev) => ({ ...prev, clientSecret: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
            <div className="space-y-2">
              <Label htmlFor="ifood-merchant">Loja iFood</Label>
              <select
                id="ifood-merchant"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={formData.merchantId}
                onChange={(e) => handleSelectMerchant(e.target.value)}
                disabled={loading || merchants.length === 0}
              >
                <option value="">Selecione uma loja</option>
                {merchants.map((merchant) => (
                  <option key={merchant.id} value={merchant.id}>
                    {merchant.name || merchant.corporateName || merchant.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Último sync</Label>
              <div className="flex h-10 items-center rounded-md border bg-slate-50 px-3 text-sm text-slate-600">
                {formatDateTime(settings.last_sync_at)}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Webhook homologável
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Configure esta URL no Developer Portal. O PopSystem valida a assinatura <code className="rounded bg-white px-1 py-0.5 text-xs">X-IFood-Signature</code> com HMAC SHA-256 usando o mesmo client secret do app.
            </p>
            <div className="mt-3 flex flex-col gap-2 rounded-lg bg-white p-3 text-sm">
              <span className="break-all font-mono text-xs text-slate-700">
                {settings.webhook_url || 'Será gerada após conectar o app'}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => window.open('https://developer.ifood.com.br', '_blank')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir Developer Portal
              </Button>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Checklist de homologação coberto por esta base</AlertTitle>
            <AlertDescription className="space-y-1">
              <p>Token centralizado com renovação controlada.</p>
              <p>Webhook com assinatura obrigatória do iFood.</p>
              <p>Polling manual para auditoria e recuperação.</p>
              <p>Persistência e descarte de eventos duplicados.</p>
              <p>Entrada de pedido, confirmação, pronto, despacho e cancelamento com motivo.</p>
            </AlertDescription>
          </Alert>

          {settings.last_sync_message ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Último retorno do módulo</AlertTitle>
              <AlertDescription>
                <span className="font-medium">{settings.last_sync_status || 'status'}</span>
                {' · '}
                {settings.last_sync_message}
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>

        <CardFooter className="flex flex-wrap gap-3">
          <Button
            onClick={handleSaveCredentials}
            disabled={loading || !formData.clientId.trim() || (!formData.clientSecret.trim() && !settings.client_secret_configured)}
          >
            {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Validar credenciais
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleSyncEvents}
            disabled={syncing || !settings.merchant_id || !settings.client_secret_configured}
          >
            {syncing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Sincronizar eventos
          </Button>

          <Button type="button" variant="ghost" onClick={loadOverview} disabled={loading}>
            Recarregar
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default IfoodSettings;
