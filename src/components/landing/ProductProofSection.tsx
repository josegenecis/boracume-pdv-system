import { useState } from 'react';
import {
  ArrowDown,
  BarChart3,
  CheckCircle2,
  ChefHat,
  Clock3,
  PackageCheck,
  ReceiptText,
  ShoppingBag,
  TrendingUp,
  WalletCards,
} from 'lucide-react';

type TourKey = 'operation' | 'cmv' | 'management';

const tabs: Array<{ key: TourKey; label: string; description: string }> = [
  { key: 'operation', label: 'Pedido e cozinha', description: 'O pedido percorre toda a operação sem redigitação.' },
  { key: 'cmv', label: 'Estoque e CMV', description: 'Ficha técnica, custo e margem falando a mesma língua.' },
  { key: 'management', label: 'Venda e gestão', description: 'O dono acompanha o resultado sem depender de planilhas.' },
];

const OperationPreview = () => (
  <div className="grid gap-3 lg:grid-cols-[.8fr_auto_1.15fr] lg:items-center">
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-black text-[#073e2e]"><ShoppingBag className="h-4 w-4 text-[#ef6c20]" />Novo pedido</div>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">PAGO</span>
      </div>
      <div className="mt-5 rounded-xl bg-[#f5f7f4] p-3">
        <div className="flex justify-between text-xs font-bold text-slate-700"><span>#1284 · Mesa 07</span><span>19:42</span></div>
        <p className="mt-2 text-xs text-slate-500">2 × X-Burger · 1 × Batata</p>
        <p className="mt-1 text-[10px] font-semibold text-[#ef6c20]">Sem cebola · molho à parte</p>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs"><span className="text-slate-500">Total</span><strong className="text-base text-[#073e2e]">R$ 67,90</strong></div>
    </div>
    <ArrowDown className="mx-auto h-5 w-5 text-[#83bd50] lg:-rotate-90" aria-hidden="true" />
    <div className="rounded-2xl bg-[#071f18] p-4 text-white shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-black"><ChefHat className="h-4 w-4 text-[#9bd85f]" />KDS · Cozinha</div>
        <span className="flex items-center gap-1 text-[10px] font-bold text-white/55"><Clock3 className="h-3 w-3" />Ao vivo</span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {[
          ['NOVO', '#1284', 'Mesa 07', '2 min', 'bg-blue-500'],
          ['PREPARANDO', '#1283', 'Delivery', '8 min', 'bg-orange-500'],
          ['PRONTO', '#1282', 'Retirada', '12 min', 'bg-[#83bd50]'],
        ].map(([status, number, origin, time, color]) => (
          <div key={number} className="rounded-xl border border-white/10 bg-white/[.06] p-3">
            <div className={`mb-3 h-1.5 rounded-full ${color}`} />
            <div className="text-[9px] font-black tracking-wider text-white/50">{status}</div>
            <div className="mt-1 text-sm font-black">{number}</div>
            <div className="mt-3 text-[10px] text-white/60">{origin}</div>
            <div className="mt-1 text-xs font-bold text-[#b9e98c]">{time}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const CmvPreview = () => (
  <div className="grid gap-3 lg:grid-cols-[.78fr_1.22fr]">
    <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-black text-[#073e2e]"><PackageCheck className="h-4 w-4 text-[#5d9b35]" />Ficha técnica</div>
      <h4 className="mt-5 text-lg font-black text-[#073e2e]">X-Burger Especial</h4>
      <div className="mt-4 space-y-2">
        {[
          ['Pão brioche', '1 un', 'R$ 1,15'],
          ['Hambúrguer', '160 g', 'R$ 4,80'],
          ['Queijo', '40 g', 'R$ 1,36'],
          ['Molho e embalagem', '1 un', 'R$ 0,89'],
        ].map(([item, quantity, cost]) => (
          <div key={item} className="grid grid-cols-[1fr_auto_auto] gap-3 rounded-lg bg-[#f6f8f5] px-3 py-2 text-[11px]">
            <span className="font-bold text-slate-700">{item}</span><span className="text-slate-500">{quantity}</span><strong className="text-[#315548]">{cost}</strong>
          </div>
        ))}
      </div>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-[#f7f9f6] p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div><div className="text-[10px] font-black uppercase tracking-widest text-[#7d8e87]">CMV e rentabilidade</div><div className="mt-1 text-lg font-black text-[#073e2e]">Margem protegida em tempo real</div></div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">CMV 28,4%</span>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          ['Venda', 'R$ 32,90'],
          ['Custo', 'R$ 9,20'],
          ['Margem', 'R$ 23,70'],
        ].map(([label, value]) => <div key={label} className="rounded-xl border bg-white p-3"><div className="text-[9px] font-bold uppercase text-slate-400">{label}</div><div className="mt-1 text-sm font-black text-[#073e2e]">{value}</div></div>)}
      </div>
      <div className="mt-4 flex h-20 items-end gap-2 rounded-xl bg-white p-3" aria-label="Demonstração de evolução da margem">
        {[38, 52, 47, 65, 58, 76, 88, 82, 96].map((height, index) => <span key={index} className="flex-1 rounded-t bg-gradient-to-t from-[#064733] to-[#9bd85f]" style={{ height: `${height}%` }} />)}
      </div>
    </div>
  </div>
);

const ManagementPreview = () => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div><div className="text-[10px] font-black uppercase tracking-widest text-[#7d8e87]">Hoje no restaurante</div><div className="mt-1 text-xl font-black text-[#073e2e]">Tudo sob controle.</div></div>
      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[#eaf7df] px-3 py-1 text-[10px] font-black text-[#39751d]"><CheckCircle2 className="h-3 w-3" />ATUALIZADO AGORA</span>
    </div>
    <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
      {[
        [WalletCards, 'Vendas', 'R$ 4.820', '+18%'],
        [ReceiptText, 'Pedidos', '127', '+12%'],
        [TrendingUp, 'Ticket médio', 'R$ 37,95', '+5%'],
        [BarChart3, 'Margem bruta', '71,6%', '+3,2%'],
      ].map(([Icon, label, value, trend]) => {
        const MetricIcon = Icon as typeof WalletCards;
        return <div key={String(label)} className="rounded-xl border border-slate-100 bg-[#f8faf7] p-3"><MetricIcon className="h-4 w-4 text-[#ef6c20]" /><div className="mt-3 text-[9px] font-bold uppercase text-slate-400">{String(label)}</div><div className="mt-1 text-base font-black text-[#073e2e]">{String(value)}</div><div className="mt-1 text-[10px] font-black text-[#65a33b]">{String(trend)}</div></div>;
      })}
    </div>
    <div className="mt-3 rounded-xl bg-[#071f18] p-4 text-white sm:flex sm:items-center sm:justify-between">
      <div><div className="text-[9px] font-black uppercase tracking-widest text-[#b9e98c]">Insight PopSystem</div><p className="mt-1 text-sm font-bold">Seu combo campeão vende mais entre 19h e 21h.</p></div>
      <span className="mt-3 inline-flex rounded-lg bg-[#ef6c20] px-3 py-2 text-[10px] font-black sm:mt-0">Criar campanha →</span>
    </div>
  </div>
);

export default function ProductProofSection() {
  const [active, setActive] = useState<TourKey>('operation');
  const current = tabs.find(tab => tab.key === active) ?? tabs[0];

  return (
    <section id="produto" className="overflow-hidden bg-white py-24">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 text-xs font-black uppercase tracking-[.22em] text-[#e95f12]">Veja o produto por dentro</div>
          <h2 className="text-4xl font-black leading-[1.05] tracking-[-.04em] text-[#073e2e] md:text-5xl">Não é promessa solta.<br />É uma operação conectada.</h2>
          <p className="mt-5 text-lg font-medium leading-8 text-[#63766e]">Explore como os módulos trabalham juntos. As telas abaixo demonstram fluxos que já existem no PopSystem.</p>
        </div>

        <div className="mx-auto mt-12 max-w-6xl rounded-[30px] border border-[#dfe8e1] bg-[#f4f7f3] p-3 shadow-[0_30px_90px_-45px_rgba(7,63,46,.35)] sm:p-5">
          <div className="grid gap-2 lg:grid-cols-3" role="tablist" aria-label="Demonstrações do PopSystem">
            {tabs.map(tab => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                id={`product-tab-${tab.key}`}
                aria-controls={`product-panel-${tab.key}`}
                aria-selected={active === tab.key}
                tabIndex={active === tab.key ? 0 : -1}
                onClick={() => setActive(tab.key)}
                className={`rounded-2xl px-4 py-3 text-left transition ${active === tab.key ? 'bg-[#064733] text-white shadow-lg' : 'bg-white text-[#315548] hover:bg-[#eaf3e7]'}`}
              >
                <span className="block text-sm font-black">{tab.label}</span>
                <span className={`mt-1 block text-[11px] font-medium ${active === tab.key ? 'text-white/65' : 'text-[#7b8c85]'}`}>{tab.description}</span>
              </button>
            ))}
          </div>
          <div id={`product-panel-${active}`} aria-labelledby={`product-tab-${active}`} className="mt-3 rounded-[24px] border border-white bg-white/70 p-3 sm:p-5" role="tabpanel" aria-label={current.label}>
            {active === 'operation' ? <OperationPreview /> : active === 'cmv' ? <CmvPreview /> : <ManagementPreview />}
          </div>
          <p className="mt-3 text-center text-[10px] font-semibold text-[#87958f]">Demonstração visual com dados ilustrativos. Nenhum resultado de cliente foi inventado.</p>
        </div>
      </div>
    </section>
  );
}
