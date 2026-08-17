import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type RtcSettings = {
  rtc_enabled?: boolean;
  rtc_strict_validation?: boolean;
  rtc_nt_version?: string | null;
  rtc_cclass_table_version?: string | null;
};

type FiscalRule = {
  id: string;
  name: string;
  active: boolean;
  ibs_cbs_cst?: string | null;
  cclass_trib?: string | null;
  ibs_cbs_config?: Record<string, unknown> | null;
  is_cst?: string | null;
  is_cclass_trib?: string | null;
  is_config?: Record<string, unknown> | null;
  rtc_source_version?: string | null;
  rtc_table_version?: string | null;
  accountant_approved_at?: string | null;
  accountant_approved_by?: string | null;
  valid_from: string;
  valid_until?: string | null;
};

const objectValue = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, unknown>
  : {};

function validateRule(rule: FiscalRule, settings: RtcSettings | null): string[] {
  const errors: string[] = [];
  const rtc = objectValue(rule.ibs_cbs_config);
  const selective = objectValue(rule.is_config);
  const hasRtc = Boolean(rule.ibs_cbs_cst || rule.cclass_trib || Object.keys(rtc).length);
  const hasIs = Boolean(rule.is_cst || rule.is_cclass_trib || Object.keys(selective).length);

  if (hasRtc) {
    if (!/^\d{3}$/.test(rule.ibs_cbs_cst || '')) errors.push('CST IBS/CBS inválido');
    if (!/^\d{6}$/.test(rule.cclass_trib || '')) errors.push('cClassTrib inválido');
    if (!rule.rtc_source_version) errors.push('Versão da NT não informada');
    if (!rule.rtc_table_version) errors.push('Versão da tabela CST/cClassTrib não informada');
    if (settings?.rtc_nt_version && rule.rtc_source_version && rule.rtc_source_version !== settings.rtc_nt_version) errors.push('Regra usa outra versão da Nota Técnica');
    if (settings?.rtc_cclass_table_version && rule.rtc_table_version && rule.rtc_table_version !== settings.rtc_cclass_table_version) errors.push('Regra usa outra versão da tabela CST/cClassTrib');
    const mode = String(rtc.mode || '');
    if (!['standard', 'monophase', 'transfer_credit', 'none'].includes(mode)) {
      errors.push('Modo RTC não definido');
    }
    if (mode === 'standard') {
      for (const field of ['ibsUf', 'ibsMun', 'cbs']) {
        const jurisdiction = objectValue(rtc[field]);
        if (!Number.isFinite(Number(jurisdiction.rate))) errors.push(`Alíquota ${field} ausente`);
      }
    }
    if (mode === 'monophase' && !Object.keys(objectValue(rtc.monophase)).length) {
      errors.push('Parâmetros monofásicos ausentes');
    }
    if (mode === 'transfer_credit' && !Object.keys(objectValue(rtc.transferCredit)).length) {
      errors.push('Valores de transferência de crédito ausentes');
    }
  }

  if (hasIs) {
    if (!/^\d{3}$/.test(rule.is_cst || '')) errors.push('CST do IS inválido');
    if (!/^\d{6}$/.test(rule.is_cclass_trib || '')) errors.push('cClassTrib do IS inválido');
    if (selective.enabled !== true) errors.push('Configuração do IS não está habilitada');
    if (!Number.isFinite(Number(selective.rate)) && !Number.isFinite(Number(selective.specificRate))) {
      errors.push('IS sem alíquota percentual ou específica');
    }
    if (Number.isFinite(Number(selective.specificRate)) && (!selective.unit || Number(selective.quantity) <= 0)) {
      errors.push('IS específico exige unidade e quantidade');
    }
  }

  if ((hasRtc || hasIs) && !rule.accountant_approved_at) errors.push('Aguardando aprovação fiscal');
  return errors;
}

export default function FiscalRtcValidation() {
  const { activeStoreId, user } = useAuth();
  const storeId = activeStoreId || user?.id;
  const [settings, setSettings] = useState<RtcSettings | null>(null);
  const [rules, setRules] = useState<FiscalRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setError(null);
    // Tabelas adicionadas pela migração RTC ainda não constam nos tipos gerados.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const [settingsResult, rulesResult] = await Promise.all([
      client.from('fiscal_settings')
        .select('rtc_enabled,rtc_strict_validation,rtc_nt_version,rtc_cclass_table_version')
        .eq('user_id', storeId)
        .maybeSingle(),
      client.from('fiscal_tax_rules')
        .select('id,name,active,ibs_cbs_cst,cclass_trib,ibs_cbs_config,is_cst,is_cclass_trib,is_config,rtc_source_version,rtc_table_version,accountant_approved_at,accountant_approved_by,valid_from,valid_until')
        .eq('user_id', storeId)
        .order('priority', { ascending: true }),
    ]);
    if (settingsResult.error || rulesResult.error) {
      setError(settingsResult.error?.message || rulesResult.error?.message || 'Falha ao carregar a matriz RTC.');
    } else {
      setSettings(settingsResult.data || null);
      setRules((rulesResult.data || []) as FiscalRule[]);
    }
    setLoading(false);
  }, [storeId]);

  useEffect(() => { void load(); }, [load]);

  const validations = useMemo(() => rules.map((rule) => ({ rule, errors: validateRule(rule, settings) })), [rules, settings]);
  const rtcRules = validations.filter(({ rule }) => rule.ibs_cbs_cst || rule.is_cst);
  const validRules = rtcRules.filter(({ errors }) => errors.length === 0).length;
  const ready = Boolean(settings?.rtc_enabled && settings?.rtc_strict_validation && settings?.rtc_cclass_table_version && rtcRules.length > 0 && validRules === rtcRules.length);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" />Validação da Reforma Tributária</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">Auditoria de IBS-UF, IBS-Mun, CBS e Imposto Seletivo antes da habilitação na NF-e/NFC-e.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Atualizar</Button>
        </CardHeader>
        <CardContent>
          {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : (
            <div className="grid gap-3 md:grid-cols-4">
              <StatusCard label="Situação" value={ready ? 'Pronto para homologação' : 'Bloqueado para emissão'} ok={ready} />
              <StatusCard label="Nota Técnica" value={settings?.rtc_nt_version || 'Não informada'} ok={Boolean(settings?.rtc_nt_version)} />
              <StatusCard label="Tabela CST/cClassTrib" value={settings?.rtc_cclass_table_version || 'Não carregada'} ok={Boolean(settings?.rtc_cclass_table_version)} />
              <StatusCard label="Regras validadas" value={`${validRules}/${rtcRules.length}`} ok={rtcRules.length > 0 && validRules === rtcRules.length} />
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant={settings?.rtc_enabled ? 'default' : 'secondary'}>Geração RTC {settings?.rtc_enabled ? 'habilitada' : 'desabilitada'}</Badge>
            <Badge variant={settings?.rtc_strict_validation ? 'default' : 'destructive'}>Validação estrita {settings?.rtc_strict_validation ? 'ativa' : 'inativa'}</Badge>
            <Badge variant="outline">NT 2025.002</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Matriz fiscal exposta para conferência</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!loading && rtcRules.length === 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="mr-2 inline h-4 w-4" />Nenhuma regra IBS/CBS ou IS foi cadastrada. A emissão permanece bloqueada quando a RTC estiver habilitada.</div>}
          {rtcRules.map(({ rule, errors }) => (
            <div key={rule.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 font-semibold">{errors.length ? <XCircle className="h-4 w-4 text-red-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}{rule.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Vigência: {rule.valid_from}{rule.valid_until ? ` até ${rule.valid_until}` : ' sem término'} • {rule.rtc_source_version || 'NT não versionada'} • {rule.rtc_table_version || 'tabela não versionada'}</div>
                </div>
                <div className="flex gap-2"><Badge variant={rule.active ? 'default' : 'secondary'}>{rule.active ? 'Ativa' : 'Inativa'}</Badge><Badge variant={rule.accountant_approved_at ? 'outline' : 'destructive'}>{rule.accountant_approved_at ? 'Aprovada' : 'Sem aprovação'}</Badge></div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <TaxSnapshot title="IBS/CBS" codes={`${rule.ibs_cbs_cst || '—'} / ${rule.cclass_trib || '—'}`} value={rule.ibs_cbs_config} />
                <TaxSnapshot title="Imposto Seletivo" codes={`${rule.is_cst || '—'} / ${rule.is_cclass_trib || '—'}`} value={rule.is_config} />
              </div>
              {errors.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-red-700">{errors.map((item) => <li key={item}>{item}</li>)}</ul>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusCard({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return <div className={`rounded-xl border p-3 ${ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 text-sm font-semibold">{value}</div></div>;
}

function TaxSnapshot({ title, codes, value }: { title: string; codes: string; value: unknown }) {
  return <div className="rounded-lg bg-slate-950 p-3 text-slate-100"><div className="flex items-center justify-between text-xs font-semibold"><span>{title}</span><span>{codes}</span></div><pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap text-[11px] text-slate-300">{JSON.stringify(objectValue(value), null, 2)}</pre></div>;
}
