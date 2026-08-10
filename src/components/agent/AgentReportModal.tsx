import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, Eye, FileText, Loader2, Printer, ReceiptText, TrendingUp, WalletCards } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { agentReportTitles, buildAgentReportPdf, fetchAgentReportData, type AgentReportType } from '@/services/agentReportService';

type Preset = 'today' | 'yesterday' | '7days' | 'month' | 'custom';

interface Props {
  open: boolean;
  userId: string;
  initialType?: AgentReportType;
  initialPreset?: Preset;
  onOpenChange: (open: boolean) => void;
  onGenerated?: (description: string) => void;
}

const reportOptions = [
  { type: 'sales' as const, icon: BarChart3, description: 'Faturamento, pedidos, ticket médio e vendas por dia.' },
  { type: 'products' as const, icon: ReceiptText, description: 'Quantidade em unidades ou quilos, receita e pedidos.' },
  { type: 'cmv' as const, icon: TrendingUp, description: 'Custo identificado, lucro bruto, margem e pendências.' },
  { type: 'payments' as const, icon: WalletCards, description: 'Totais e participação por forma de pagamento.' },
];

const dateInput = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const periodFor = (preset: Preset) => {
  const today = new Date();
  const from = new Date(today); const to = new Date(today);
  if (preset === 'yesterday') { from.setDate(from.getDate() - 1); to.setDate(to.getDate() - 1); }
  if (preset === '7days') from.setDate(from.getDate() - 6);
  if (preset === 'month') from.setDate(1);
  return { from, to };
};

export function AgentReportModal({ open, userId, initialType = 'sales', initialPreset = 'today', onOpenChange, onGenerated }: Props) {
  const [type, setType] = useState<AgentReportType>(initialType);
  const [preset, setPreset] = useState<Preset>(initialPreset);
  const initialPeriod = useMemo(() => periodFor(initialPreset), [initialPreset]);
  const [from, setFrom] = useState(dateInput(initialPeriod.from));
  const [to, setTo] = useState(dateInput(initialPeriod.to));
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [filename, setFilename] = useState('');
  const { toast } = useToast();

  useEffect(() => { setType(initialType); }, [initialType]);
  useEffect(() => {
    setPreset(initialPreset);
    const period = periodFor(initialPreset); setFrom(dateInput(period.from)); setTo(dateInput(period.to));
  }, [initialPreset]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const selectPreset = (next: Preset) => {
    setPreset(next);
    if (next !== 'custom') { const period = periodFor(next); setFrom(dateInput(period.from)); setTo(dateInput(period.to)); }
  };

  const generate = async () => {
    if (!from || !to || new Date(`${from}T12:00:00`) > new Date(`${to}T12:00:00`)) {
      toast({ title: 'Período inválido', description: 'Confira as datas inicial e final.', variant: 'destructive' }); return;
    }
    setLoading(true);
    try {
      const data = await fetchAgentReportData(userId, { from: new Date(`${from}T12:00:00`), to: new Date(`${to}T12:00:00`) });
      const pdf = buildAgentReportPdf(data, type);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(pdf.blob)); setFilename(pdf.filename);
      onGenerated?.(`${agentReportTitles[type]} gerado para ${new Date(`${from}T12:00:00`).toLocaleDateString('pt-BR')} a ${new Date(`${to}T12:00:00`).toLocaleDateString('pt-BR')}.`);
      toast({ title: 'Relatório pronto', description: 'Você já pode visualizar, baixar ou imprimir o PDF.' });
    } catch (error: unknown) {
      toast({ title: 'Não foi possível gerar o relatório', description: error instanceof Error ? error.message : 'Tente novamente.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const download = () => {
    if (!previewUrl) return;
    const anchor = document.createElement('a'); anchor.href = previewUrl; anchor.download = filename; anchor.click();
  };
  const print = () => {
    if (!previewUrl) return;
    const frame = document.createElement('iframe'); frame.style.position = 'fixed'; frame.style.opacity = '0'; frame.src = previewUrl;
    document.body.appendChild(frame); frame.onload = () => { frame.contentWindow?.focus(); frame.contentWindow?.print(); window.setTimeout(() => frame.remove(), 1000); };
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto rounded-[28px] p-0">
      <DialogHeader className="bg-[#00523a] px-6 py-5 text-left text-white">
        <DialogTitle className="flex items-center gap-3 text-2xl font-black"><FileText className="h-6 w-6" /> Relatórios do Pop Agente</DialogTitle>
        <DialogDescription className="text-emerald-50">Escolha o relatório e o período. O PDF sai pronto para conferir, baixar ou imprimir.</DialogDescription>
      </DialogHeader>
      <div className="space-y-5 p-6">
        <div className="grid gap-3 md:grid-cols-2">
          {reportOptions.map(({ type: option, icon: Icon, description }) => <button key={option} type="button" onClick={() => { setType(option); setPreviewUrl(''); }}
            className={`rounded-2xl border p-4 text-left transition ${type === option ? 'border-[#0f7a55] bg-emerald-50 ring-2 ring-emerald-600/15' : 'bg-white hover:border-emerald-300'}`}>
            <div className="flex gap-3"><div className="rounded-xl bg-[#00523a] p-2 text-white"><Icon className="h-5 w-5" /></div><div><p className="font-black text-[#003223]">{agentReportTitles[option]}</p><p className="mt-1 text-sm text-slate-600">{description}</p></div></div>
          </button>)}
        </div>
        <div className="rounded-2xl border bg-slate-50 p-4">
          <p className="mb-3 text-sm font-black text-[#003223]">Período</p>
          <div className="flex flex-wrap gap-2">
            {([['today', 'Hoje'], ['yesterday', 'Ontem'], ['7days', 'Últimos 7 dias'], ['month', 'Este mês'], ['custom', 'Personalizado']] as Array<[Preset, string]>).map(([value, label]) =>
              <Button key={value} type="button" size="sm" variant={preset === value ? 'default' : 'outline'} onClick={() => selectPreset(value)} className={preset === value ? 'bg-[#0f7a55] hover:bg-[#096443]' : ''}>{label}</Button>)}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Data inicial<Input type="date" value={from} onChange={event => { setFrom(event.target.value); setPreset('custom'); }} className="mt-1 bg-white" /></label><label className="text-sm font-semibold">Data final<Input type="date" value={to} onChange={event => { setTo(event.target.value); setPreset('custom'); }} className="mt-1 bg-white" /></label></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={generate} disabled={loading} className="h-11 bg-[#0f7a55] px-6 font-bold hover:bg-[#096443]">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}Gerar PDF</Button>
          <Button variant="outline" disabled={!previewUrl} onClick={() => window.open(previewUrl, '_blank')}><Eye className="mr-2 h-4 w-4" />Visualizar</Button>
          <Button variant="outline" disabled={!previewUrl} onClick={download}><Download className="mr-2 h-4 w-4" />Baixar</Button>
          <Button variant="outline" disabled={!previewUrl} onClick={print}><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
        </div>
        {previewUrl && <div className="overflow-hidden rounded-2xl border bg-slate-100"><iframe src={previewUrl} title="Pré-visualização do relatório" className="h-[520px] w-full" /></div>}
      </div>
    </DialogContent>
  </Dialog>;
}
