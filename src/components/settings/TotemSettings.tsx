import { useMemo, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, Megaphone, Monitor, MonitorUp, QrCode, ShieldCheck, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function TotemSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const totemUrl = useMemo(() => user?.id ? `${window.location.origin}/totem/${user.id}` : '', [user?.id]);

  const copyLink = async () => {
    if (!totemUrl) return;
    try {
      await navigator.clipboard.writeText(totemUrl);
      setCopied(true);
      toast({ title: 'Link copiado', description: 'Abra este endereço no equipamento que será usado como totem.' });
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({ title: 'Não foi possível copiar', description: 'Selecione o endereço e copie manualmente.', variant: 'destructive' });
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <Card className="overflow-hidden border-[#dce8df]">
        <CardHeader className="bg-gradient-to-br from-[#063d2e] to-[#0a654a] text-white">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><MonitorUp className="h-6 w-6" /></div>
          <CardTitle className="text-2xl">Totem de autoatendimento</CardTitle>
          <CardDescription className="max-w-xl text-white/70">Use este link uma vez no equipamento. A loja ficará vinculada e o PWA poderá ser instalado em tela cheia.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          <div className="rounded-2xl border border-[#dfe7e1] bg-[#f7faf7] p-4">
            <div className="text-xs font-black uppercase tracking-wider text-[#789087]">Link exclusivo desta loja</div>
            <div className="mt-2 break-all text-sm font-bold text-[#164b39]">{totemUrl || 'Carregando vínculo da loja...'}</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button type="button" variant="outline" className="h-12 rounded-xl font-bold" onClick={copyLink} disabled={!totemUrl}>
              <Copy className="mr-2 h-4 w-4" />{copied ? 'Copiado' : 'Copiar link'}
            </Button>
            <Button type="button" className="h-12 rounded-xl bg-[#ef6c20] font-black text-white hover:bg-[#da5e17]" onClick={() => window.open(totemUrl, '_blank', 'noopener,noreferrer')} disabled={!totemUrl}>
              <ExternalLink className="mr-2 h-4 w-4" />Abrir módulo
            </Button>
          </div>
          <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-boracume-orange text-white"><Megaphone className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="font-black text-stone-900">Propagandas da tela de espera</div>
                <p className="mt-1 text-sm font-semibold leading-6 text-stone-600">Os banners ativos da loja passam automaticamente em tela cheia enquanto o totem não está em uso.</p>
                <Button type="button" variant="link" className="mt-1 h-auto p-0 font-black text-boracume-orange" onClick={() => window.location.assign('/marketing?tab=banners')}>
                  Gerenciar artes e banners
                  <ExternalLink className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-2xl border border-[#dfe7e1] p-4"><Smartphone className="h-6 w-6 text-[#67a83f]" /><div><div className="font-black text-[#164b39]">Modo vertical</div><div className="text-xs font-semibold text-[#789087]">Layout touch para totens em pé</div></div></div>
            <div className="flex items-center gap-3 rounded-2xl border border-[#dfe7e1] p-4"><Monitor className="h-6 w-6 text-[#67a83f]" /><div><div className="font-black text-[#164b39]">Modo horizontal</div><div className="text-xs font-semibold text-[#789087]">Mais produtos por linha</div></div></div>
          </div>
          <div className="space-y-3">
            {[
              'Abra o link no Chrome ou Edge do equipamento.',
              'Confira o cardápio e toque em “Instalar este totem”.',
              'Autorize tela cheia e mantenha o equipamento conectado à internet.',
              'Faça um pedido completo de teste antes de liberar ao público.',
            ].map((step, index) => <div key={step} className="flex items-center gap-3 text-sm font-semibold text-[#36594d]"><span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#eaf5e4] text-xs font-black text-[#4f8e2e]">{index + 1}</span>{step}</div>)}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card className="border-[#dce8df]">
          <CardHeader><CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5 text-[#ef6c20]" />Abrir no equipamento</CardTitle><CardDescription>Escaneie com o celular apenas para testar. Para produção, abra no navegador do próprio totem.</CardDescription></CardHeader>
          <CardContent className="flex justify-center"><div className="rounded-2xl border bg-white p-4 shadow-sm">{totemUrl ? <QRCodeSVG value={totemUrl} size={210} /> : null}</div></CardContent>
        </Card>
        <Card className="border-[#dce8df] bg-[#f7faf7]">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2 font-black text-[#164b39]"><ShieldCheck className="h-5 w-5 text-[#67a83f]" />Proteções já incluídas</div>
            {['Carrinho separado por loja', 'Limpeza automática após inatividade', 'Dados financeiros fora do cache offline', 'Vínculo persistente do equipamento'].map(item => <div key={item} className="flex items-center gap-2 text-sm font-semibold text-[#567168]"><CheckCircle2 className="h-4 w-4 text-[#76b84b]" />{item}</div>)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
