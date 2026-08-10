import { useEffect, useState } from 'react';
import { FileCheck2, ReceiptText, Save, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type FiscalModel = {
  id?: string;
  model_code: '55' | '65';
  document_name: string;
  enabled: boolean;
  automatic_emission: boolean;
  series: string;
  next_number: number;
  environment: 'homologacao' | 'producao';
  operation_nature?: string | null;
};

const defaults: FiscalModel[] = [
  { model_code: '55', document_name: 'NF-e', enabled: false, automatic_emission: false, series: '1', next_number: 1, environment: 'homologacao', operation_nature: 'Venda de mercadoria' },
  { model_code: '65', document_name: 'NFC-e', enabled: false, automatic_emission: false, series: '1', next_number: 1, environment: 'homologacao' },
];

export default function FiscalDocumentModelSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [models, setModels] = useState<FiscalModel[]>(defaults);
  const [saving, setSaving] = useState(false);
  const [nfceExtras, setNfceExtras] = useState({ csc_id: '', csc_token: '' });

  useEffect(() => {
    if (!user?.id) return;
    void (async () => {
      const { data, error } = await (supabase as any).from('fiscal_document_models').select('*').eq('user_id', user.id).order('model_code');
      if (!error && data?.length) setModels(defaults.map((fallback) => data.find((item: FiscalModel) => item.model_code === fallback.model_code) || fallback));
      const { data: fiscal } = await (supabase as any).from('fiscal_settings').select('csc_id,csc_token').eq('user_id', user.id).maybeSingle();
      if (fiscal) setNfceExtras({ csc_id: String(fiscal.csc_id || ''), csc_token: String(fiscal.csc_token || '') });
    })();
  }, [user?.id]);

  const updateModel = (code: '55' | '65', patch: Partial<FiscalModel>) => {
    setModels((current) => current.map((model) => model.model_code === code ? { ...model, ...patch } : model));
  };

  const save = async () => {
    if (!user?.id) return;
    try {
      setSaving(true);
      const payload = models.map(({ id: _id, ...model }) => ({ ...model, user_id: user.id, updated_at: new Date().toISOString() }));
      const { error } = await (supabase as any).from('fiscal_document_models').upsert(payload, { onConflict: 'user_id,model_code' });
      if (error) throw error;

      const nfce = models.find((model) => model.model_code === '65')!;
      const { error: legacyError } = await (supabase as any).from('fiscal_settings').update({
        ativo: nfce.enabled && nfce.automatic_emission,
        nfce_serie: nfce.series,
        nfce_numero_atual: nfce.next_number,
        ambiente: nfce.environment,
        csc_id: nfceExtras.csc_id,
        csc_token: nfceExtras.csc_token,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);
      if (legacyError) throw legacyError;
      toast({ title: 'Configurações fiscais salvas', description: 'As regras de cada modelo foram atualizadas.' });
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error?.message || 'Não foi possível salvar os modelos fiscais.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Modelos de documentos</h2>
        <p className="text-sm text-muted-foreground">Cada modelo possui ativação, numeração e ambiente independentes.</p>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {models.map((model) => {
          const isNfe = model.model_code === '55';
          return (
            <Card key={model.model_code} className="overflow-hidden border-slate-200 shadow-sm">
              <div className={isNfe ? 'h-1.5 bg-blue-600' : 'h-1.5 bg-emerald-600'} />
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">{isNfe ? <FileCheck2 className="h-5 w-5 text-blue-600" /> : <ReceiptText className="h-5 w-5 text-emerald-600" />}{model.document_name} <span className="text-sm font-normal text-muted-foreground">Modelo {model.model_code}</span></span>
                  <Switch checked={model.enabled} onCheckedChange={(enabled) => updateModel(model.model_code, { enabled, automatic_emission: enabled ? model.automatic_emission : false })} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                  {isNfe ? 'Usada principalmente em vendas para empresas, operações interestaduais e circulação de mercadorias.' : 'Usada principalmente na venda presencial ao consumidor final.'}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Série</Label><Input value={model.series} onChange={(event) => updateModel(model.model_code, { series: event.target.value })} /></div>
                  <div className="space-y-2"><Label>Próximo número</Label><Input type="number" min="1" value={model.next_number} onChange={(event) => updateModel(model.model_code, { next_number: Math.max(1, Number(event.target.value) || 1) })} /></div>
                </div>
                <div className="space-y-2"><Label>Ambiente</Label><Select value={model.environment} onValueChange={(environment: 'homologacao' | 'producao') => updateModel(model.model_code, { environment })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="homologacao">Homologação</SelectItem><SelectItem value="producao">Produção</SelectItem></SelectContent></Select></div>
                {isNfe && <div className="space-y-2"><Label>Natureza da operação padrão</Label><Input value={model.operation_nature || ''} onChange={(event) => updateModel(model.model_code, { operation_nature: event.target.value })} /></div>}
                {!isNfe && <div className="rounded-lg border p-4 space-y-3"><div><Label>CSC da NFC-e (quando exigido pela UF)</Label><p className="text-xs text-muted-foreground">Usado exclusivamente na geração do QR Code do modelo 65.</p></div><div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>CSC ID</Label><Input value={nfceExtras.csc_id} onChange={(event) => setNfceExtras((current) => ({ ...current, csc_id: event.target.value.replace(/\D/g, '').slice(0, 6) }))} /></div><div className="space-y-2"><Label>CSC Token</Label><Input type="password" value={nfceExtras.csc_token} onChange={(event) => setNfceExtras((current) => ({ ...current, csc_token: event.target.value }))} /></div></div></div>}
                <div className="flex items-center justify-between rounded-lg border p-3"><div><Label>Emissão automática</Label><p className="text-xs text-muted-foreground">Emitir quando a regra da venda indicar este modelo.</p></div><Switch checked={model.automatic_emission} disabled={!model.enabled || isNfe} onCheckedChange={(automatic_emission) => updateModel(model.model_code, { automatic_emission })} /></div>
                {isNfe && <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3"><Button type="button" variant="outline" className="w-full border-blue-200 bg-white text-blue-800 hover:bg-blue-50" onClick={() => navigate('/fiscal?tab=recipients')}><UserPlus className="mr-2 h-4 w-4" />Cadastrar ou completar cliente da NF-e</Button><p className="text-xs text-blue-800">No PDV, informe o destinatário no fechamento. O sistema emitirá exclusivamente o modelo 55 e validará o cadastro antes de transmitir.</p></div>}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="flex justify-end"><Button onClick={save} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? 'Salvando...' : 'Salvar modelos fiscais'}</Button></div>
    </div>
  );
}
