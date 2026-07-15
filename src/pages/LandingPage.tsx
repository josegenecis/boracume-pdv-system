import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bot,
  Check,
  CheckCircle2,
  ChefHat,
  Clock3,
  Headphones,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  MonitorSmartphone,
  PackageCheck,
  QrCode,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  TrendingUp,
  Users,
  UtensilsCrossed,
  WalletCards,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import LandingLayout from '@/components/landing/LandingLayout';
import { ScrollToTop } from '@/components/landing/ScrollToTop';

const SUPPORT_PHONE = '5585992918273';
const WHATSAPP_URL = `https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent('Olá! Quero conhecer o PopSystem e organizar meu restaurante.')}`;

const operations = [
  { icon: ShoppingBag, label: 'Pedidos', text: 'Balcão, mesa, retirada e delivery no mesmo fluxo.' },
  { icon: ChefHat, label: 'Cozinha', text: 'KDS em tempo real para produzir sem papel e sem confusão.' },
  { icon: PackageCheck, label: 'Estoque', text: 'Baixa de ingredientes, ficha técnica e alerta de reposição.' },
  { icon: WalletCards, label: 'Financeiro', text: 'Caixa, despesas, CMV e visão clara do que realmente sobra.' },
  { icon: Megaphone, label: 'Marketing', text: 'Campanhas, banners e ofertas criadas dentro do sistema.' },
  { icon: Users, label: 'Equipe', text: 'Garçons, entregadores, permissões e controle de ponto.' },
];

const channels = [
  { icon: MonitorSmartphone, title: 'PDV rápido', subtitle: 'Venda sem travar a fila' },
  { icon: QrCode, title: 'Cardápio digital', subtitle: 'Pedido direto do celular' },
  { icon: UtensilsCrossed, title: 'Mesas e comandas', subtitle: 'Conta organizada por cliente' },
  { icon: Store, title: 'Totem', subtitle: 'Autoatendimento integrado' },
  { icon: MessageCircle, title: 'WhatsApp', subtitle: 'Atendimento e automações' },
  { icon: ShoppingBag, title: 'iFood e delivery', subtitle: 'Pedidos centralizados' },
];

const plans = [
  {
    name: 'Essencial',
    price: '159',
    description: 'Para colocar a operação em ordem e começar a vender com controle.',
    items: ['PDV e fechamento de caixa', 'Cardápio digital e QR Code', 'Pedidos online e delivery', 'Mesas e comandas básicas', 'Relatórios essenciais'],
    tone: 'green',
  },
  {
    name: 'Pro',
    price: '229',
    description: 'Para quem quer gestão completa, produtividade e inteligência no dia a dia.',
    items: ['Tudo do Essencial', 'KDS e app do garçom', 'Estoque e ficha técnica', 'Financeiro, CMV e relatórios', 'Marketing, WhatsApp e IA'],
    tone: 'orange',
    featured: true,
  },
  {
    name: 'Multi',
    price: '269',
    description: 'Para redes que precisam controlar cada unidade sem perder a visão do grupo.',
    items: ['Tudo do Pro', 'Uma loja incluída', 'Painel consolidado e por unidade', 'Permissões por loja', 'R$ 149 por loja adicional'],
    tone: 'purple',
  },
];

const faqs = [
  ['Preciso instalar alguma coisa?', 'Não para começar. O PopSystem funciona pela internet em computador, tablet e celular. Quando a operação exige impressão e hardware, o app desktop complementa a experiência.'],
  ['Consigo trazer meu cardápio atual?', 'Sim. Você pode cadastrar produtos, categorias, complementos, imagens e preços, além de usar os recursos de importação assistida disponíveis no sistema.'],
  ['O PopSystem serve para delivery e salão?', 'Serve para os dois. O mesmo sistema organiza balcão, mesas, comandas, retirada, delivery próprio, cardápio digital e canais integrados.'],
  ['Posso mudar de plano depois?', 'Sim. O sistema permite evoluir de plano conforme a operação cresce, com cálculo proporcional no upgrade.'],
  ['Funciona para mais de uma loja?', 'Sim. O plano Multi oferece troca rápida entre unidades, permissões por loja e visão consolidada da rede.'],
  ['Como funciona o suporte?', 'Você fala com a equipe PopSystem pelo WhatsApp para implantação, configuração e dúvidas da operação.'],
];

const DashboardPreview = () => (
  <div className="relative mx-auto w-full max-w-[680px] lg:mr-0">
    <div className="absolute -inset-10 rounded-full bg-[#8BCB4A]/20 blur-3xl" />
    <div className="relative overflow-hidden rounded-[28px] border border-white/15 bg-[#082f25] p-2 shadow-[0_40px_100px_-35px_rgba(0,0,0,.75)]">
      <div className="overflow-hidden rounded-[22px] bg-[#f7f8f4]">
        <div className="flex h-11 items-center gap-2 border-b border-[#dde6df] bg-white px-4">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff7557]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd3e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#7ccf62]" />
          <span className="ml-3 rounded-full bg-[#f1f4f1] px-4 py-1 text-[9px] font-bold text-[#789087]">popsystem.com.br/dashboard</span>
        </div>
        <div className="grid min-h-[390px] grid-cols-[66px_1fr] md:grid-cols-[150px_1fr]">
          <aside className="bg-[#064733] p-3 text-white">
            <img src="/LOGOMARCA/logo-pop.webp" alt="" className="mb-6 hidden h-7 w-auto brightness-0 invert md:block" />
            <div className="mx-auto mb-6 flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 md:hidden"><LayoutDashboard className="h-4 w-4" /></div>
            {['Visão geral', 'Pedidos', 'PDV', 'Cozinha', 'Estoque', 'Financeiro'].map((item, index) => (
              <div key={item} className={`mb-1.5 flex items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] font-semibold ${index === 0 ? 'bg-white text-[#064733]' : 'text-white/65'}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                <span className="hidden md:inline">{item}</span>
              </div>
            ))}
          </aside>
          <div className="p-3 md:p-5">
            <div className="mb-4 flex items-end justify-between">
              <div><div className="text-[10px] font-bold uppercase tracking-[.15em] text-[#799087]">Hoje no seu restaurante</div><div className="mt-1 text-lg font-black text-[#083e2f]">Tudo sob controle.</div></div>
              <span className="rounded-full bg-[#eaf7df] px-2.5 py-1 text-[9px] font-extrabold text-[#39751d]">● AO VIVO</span>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {[
                ['Vendas', 'R$ 4.820', '+18%'], ['Pedidos', '127', '+12%'], ['Ticket médio', 'R$ 37,95', '+5%'], ['Tempo médio', '16 min', '-3 min'],
              ].map(([label, value, trend]) => (
                <div key={label} className="rounded-xl border border-[#e3e9e4] bg-white p-2.5 shadow-sm">
                  <div className="text-[8px] font-bold uppercase text-[#81938c]">{label}</div>
                  <div className="mt-1 text-sm font-black text-[#073e2e]">{value}</div>
                  <div className="mt-1 text-[8px] font-bold text-[#65a33b]">{trend}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[1.3fr_.7fr]">
              <div className="rounded-xl border border-[#e3e9e4] bg-white p-3 shadow-sm">
                <div className="mb-3 flex items-center justify-between"><strong className="text-[11px] text-[#073e2e]">Pedidos em andamento</strong><span className="text-[8px] font-bold text-[#ef6c20]">Ver todos</span></div>
                {[
                  ['#1284 · Mesa 07', 'Cozinha', '8 min'], ['#1283 · Delivery', 'Pronto', '14 min'], ['#1282 · Retirada', 'Recebido', '2 min'],
                ].map(([order, status, time], index) => (
                  <div key={order} className="mb-2 grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-lg bg-[#f6f8f5] px-2.5 py-2 text-[9px]">
                    <span className="font-bold text-[#294c40]">{order}</span><span className={`rounded-full px-2 py-1 font-bold ${index === 0 ? 'bg-orange-100 text-orange-700' : index === 1 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{status}</span><span className="text-[#8a9a94]">{time}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-gradient-to-br from-[#ef6c20] to-[#ff8b3d] p-3 text-white shadow-lg shadow-orange-200">
                <Sparkles className="h-4 w-4" />
                <div className="mt-4 text-[9px] font-bold uppercase tracking-[.12em] text-white/75">Insight PopSystem</div>
                <p className="mt-1 text-xs font-black leading-snug">Seu combo campeão vende 22% mais entre 19h e 21h.</p>
                <div className="mt-4 rounded-lg bg-white/15 p-2 text-[8px] font-bold">Criar campanha agora →</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div className="absolute -bottom-7 -left-3 hidden w-48 rounded-2xl border border-[#dce8df] bg-white p-3 shadow-2xl sm:block">
      <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#e8f8df]"><PackageCheck className="h-4 w-4 text-[#4a8d2a]" /></div><div><div className="text-[9px] font-bold text-[#789087]">ESTOQUE INTELIGENTE</div><div className="text-[11px] font-black text-[#073e2e]">Reposição prevista</div></div></div>
      <p className="mt-2 text-[9px] leading-relaxed text-[#60756d]">Cheddar pode acabar amanhã. Comprar 4 kg.</p>
    </div>
  </div>
);

const Eyebrow = ({ children, light = false }: { children: React.ReactNode; light?: boolean }) => (
  <div className={`mb-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.22em] ${light ? 'text-[#b9e98c]' : 'text-[#e95f12]'}`}><span className="h-2 w-2 rounded-full bg-current" />{children}</div>
);

const LandingPage = () => (
  <>
    <Helmet>
      <title>PopSystem | Controle seu restaurante do pedido ao lucro</title>
      <meta name="description" content="PDV, cardápio digital, delivery, mesas, cozinha, estoque, financeiro, WhatsApp e marketing em um único sistema para restaurantes." />
      <meta name="keywords" content="sistema para restaurante, PDV restaurante, cardápio digital, sistema delivery, controle de estoque restaurante, gestão para restaurante" />
      <meta property="og:title" content="PopSystem | Seu restaurante inteiro em uma única tela" />
      <meta property="og:description" content="Venda mais rápido, reduza erros e saiba exatamente o que acontece no seu restaurante." />
      <link rel="canonical" href="https://popsystem.com.br/" />
    </Helmet>

    <LandingLayout>
      <section className="relative overflow-hidden bg-[#064733] text-white">
        <div className="absolute inset-0 opacity-[.08]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '28px 28px' }} />
        <div className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#84c649]/25 blur-3xl" />
        <div className="container relative grid min-h-[760px] items-center gap-16 py-20 lg:grid-cols-[.88fr_1.12fr] lg:py-24">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs font-extrabold text-[#c9efaa] backdrop-blur">
              <Zap className="h-4 w-4 fill-current" />
              A operação inteira falando a mesma língua
            </div>
            <h1 className="text-[2.7rem] font-black leading-[.98] tracking-[-.055em] sm:text-6xl lg:text-[4.65rem]">
              Pare de apagar incêndios. <span className="text-[#9bd85f]">Comece a comandar.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg font-medium leading-8 text-white/75 md:text-xl">
              O PopSystem conecta vendas, salão, delivery, cozinha, estoque, financeiro e marketing para você ganhar velocidade, reduzir erros e enxergar o lucro de verdade.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link to="/login?tab=register"><Button className="h-14 w-full rounded-xl bg-[#ef6c20] px-7 text-base font-black text-white shadow-xl shadow-black/20 hover:bg-[#ff7b2d] sm:w-auto">Começar agora <ArrowRight className="ml-2 h-5 w-5" /></Button></Link>
              <a href={WHATSAPP_URL} target="_blank" rel="noreferrer"><Button variant="outline" className="h-14 w-full rounded-xl border-white/20 bg-white/10 px-7 text-base font-bold text-white backdrop-blur hover:bg-white hover:text-[#064733] sm:w-auto"><MessageCircle className="mr-2 h-5 w-5" />Falar com especialista</Button></a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-white/70">
              {['Sem taxa por pedido', 'Acesso pela internet', 'Implantação acompanhada'].map(item => <span key={item} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#9bd85f]" />{item}</span>)}
            </div>
          </div>
          <DashboardPreview />
        </div>
      </section>

      <section className="border-b border-[#e5ebe5] bg-white py-7">
        <div className="container">
          <p className="mb-5 text-center text-xs font-black uppercase tracking-[.18em] text-[#82928c]">Uma plataforma para toda forma de vender</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {channels.map(({ icon: Icon, title, subtitle }) => <div key={title} className="flex items-center gap-3 rounded-xl border border-[#e8ede8] bg-[#fafbf9] p-3"><Icon className="h-5 w-5 flex-none text-[#ef6c20]" /><div><div className="text-xs font-black text-[#073e2e]">{title}</div><div className="mt-0.5 text-[10px] font-medium text-[#7c8d86]">{subtitle}</div></div></div>)}
          </div>
        </div>
      </section>

      <section id="funcionalidades" className="bg-[#f6f8f4] py-24">
        <div className="container">
          <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
            <div><Eyebrow>Do pedido ao resultado</Eyebrow><h2 className="text-4xl font-black leading-[1.05] tracking-[-.04em] text-[#073e2e] md:text-5xl">Um sistema só.<br />Nenhuma ponta solta.</h2></div>
            <p className="max-w-2xl text-lg font-medium leading-8 text-[#5e7169]">Quando cada área usa uma ferramenta diferente, o dono vira o ponto de integração. O PopSystem coloca toda a operação em um único fluxo — e devolve seu tempo para decisões que fazem o negócio crescer.</p>
          </div>
          <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {operations.map(({ icon: Icon, label, text }, index) => <article key={label} className="group rounded-[22px] border border-[#e0e8e1] bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#91c966] hover:shadow-xl"><div className="flex items-start justify-between"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef7e8] text-[#4d8b2c] transition group-hover:bg-[#064733] group-hover:text-white"><Icon className="h-6 w-6" /></div><span className="text-xs font-black text-[#d5ddd7]">0{index + 1}</span></div><h3 className="mt-7 text-xl font-black text-[#073e2e]">{label}</h3><p className="mt-2 text-sm font-medium leading-6 text-[#6b7d75]">{text}</p></article>)}
          </div>
        </div>
      </section>

      <section className="overflow-hidden bg-white py-24">
        <div className="container grid gap-14 lg:grid-cols-2 lg:items-center">
          <div className="relative rounded-[30px] bg-[#fff3e9] p-6 md:p-10">
            <div className="absolute -left-10 -top-10 h-36 w-36 rounded-full border-[28px] border-[#ef6c20]/10" />
            <div className="relative mx-auto max-w-md rounded-[26px] bg-[#071f18] p-3 shadow-2xl">
              <div className="rounded-[20px] bg-white p-5">
                <div className="flex items-center justify-between"><div><div className="text-[10px] font-black uppercase tracking-widest text-[#8c9c96]">Fila da cozinha</div><div className="mt-1 text-lg font-black text-[#073e2e]">Produção em tempo real</div></div><Clock3 className="h-6 w-6 text-[#ef6c20]" /></div>
                {[
                  ['Mesa 12', '2 X-Burger · 1 Batata', '6 min', 'Preparando'], ['Delivery #438', '1 Pizza grande', '11 min', 'Quase pronto'], ['Balcão #172', '2 Açaís 500ml', '3 min', 'Novo'],
                ].map(([origin, item, time, status], index) => <div key={origin} className="mt-3 rounded-xl border border-[#e6ebe7] p-3"><div className="flex items-center justify-between"><strong className="text-xs text-[#073e2e]">{origin}</strong><span className="text-[10px] font-bold text-[#ef6c20]">{time}</span></div><p className="mt-1 text-[11px] text-[#71827b]">{item}</p><div className={`mt-2 inline-flex rounded-full px-2 py-1 text-[9px] font-black ${index === 2 ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>{status}</div></div>)}
              </div>
            </div>
          </div>
          <div><Eyebrow>Menos caos. Mais ritmo.</Eyebrow><h2 className="text-4xl font-black leading-[1.05] tracking-[-.04em] text-[#073e2e] md:text-5xl">O pedido entra certo.<br />A cozinha produz certo.<br />O caixa fecha certo.</h2><p className="mt-6 text-lg font-medium leading-8 text-[#63766e]">Do clique do cliente à tela da cozinha, cada informação segue o mesmo caminho. Sem redigitação, papel perdido ou pedido esquecido.</p><div className="mt-8 space-y-4">{['Atualização dos pedidos em tempo real', 'Complementos e observações chegam organizados', 'Status claro para salão, entrega e cliente', 'Histórico para entender gargalos e melhorar a operação'].map(item => <div key={item} className="flex items-center gap-3 font-bold text-[#244c3f]"><BadgeCheck className="h-5 w-5 flex-none text-[#79b848]" />{item}</div>)}</div></div>
        </div>
      </section>

      <section id="inteligencia" className="relative overflow-hidden bg-[#071f18] py-24 text-white">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(45deg, transparent 45%, #fff 45%, #fff 46%, transparent 46%)', backgroundSize: '32px 32px' }} />
        <div className="container relative grid gap-14 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
          <div><Eyebrow light>Inteligência que vira ação</Eyebrow><h2 className="text-4xl font-black leading-[1.03] tracking-[-.045em] md:text-5xl">O sistema não mostra só números. Ele ajuda você a decidir.</h2><p className="mt-6 text-lg font-medium leading-8 text-white/65">Descubra o que vende mais, onde sua margem escapa e qual ação pode melhorar o resultado — sem passar horas montando planilhas.</p><Link to="/login?tab=register" className="mt-8 inline-flex items-center gap-2 font-black text-[#a8df75] hover:text-white">Quero enxergar meu restaurante <ArrowRight className="h-5 w-5" /></Link></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              [TrendingUp, 'Venda melhor', 'Veja produtos campeões, horários fortes e ticket médio.'], [BarChart3, 'Proteja sua margem', 'Acompanhe CMV, despesas e desempenho da operação.'], [Bot, 'Ganhe produtividade', 'Use IA para conteúdo, atendimento e tarefas repetitivas.'], [Megaphone, 'Traga o cliente de volta', 'Crie ofertas, campanhas e ações de fidelização.'],
            ].map(([Icon, title, text]) => { const FeatureIcon = Icon as typeof TrendingUp; return <div key={String(title)} className="rounded-[22px] border border-white/10 bg-white/[.055] p-6 backdrop-blur"><FeatureIcon className="h-6 w-6 text-[#ef7b36]" /><h3 className="mt-8 text-lg font-black">{String(title)}</h3><p className="mt-2 text-sm font-medium leading-6 text-white/55">{String(text)}</p></div>; })}
          </div>
        </div>
      </section>

      <section className="bg-[#f6f8f4] py-24">
        <div className="container grid gap-14 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <div><Eyebrow>Feito para a vida real</Eyebrow><h2 className="text-4xl font-black leading-[1.05] tracking-[-.04em] text-[#073e2e] md:text-5xl">Funciona no balcão cheio, no salão corrido e no delivery bombando.</h2><p className="mt-6 max-w-xl text-lg font-medium leading-8 text-[#63766e]">Hamburgueria, pizzaria, açaí, restaurante, cafeteria ou rede: você configura a operação do seu jeito e cresce sem trocar de sistema.</p><div className="mt-8 flex flex-wrap gap-2">{['Restaurantes', 'Hamburguerias', 'Pizzarias', 'Açaíterias', 'Lanchonetes', 'Cafeterias', 'Food trucks', 'Franquias'].map(item => <span key={item} className="rounded-full border border-[#dfe7df] bg-white px-4 py-2 text-sm font-bold text-[#31574a]">{item}</span>)}</div></div>
          <div className="grid grid-cols-2 gap-4">
            {[
              [ReceiptText, 'Menos erros', 'Informação certa do pedido ao fechamento.'], [Zap, 'Mais agilidade', 'Atenda mais sem perder a qualidade.'], [ShieldCheck, 'Mais controle', 'Permissões, histórico e dados organizados.'], [TrendingUp, 'Mais resultado', 'Decida com base no que acontece de verdade.'],
            ].map(([Icon, title, text], index) => { const BenefitIcon = Icon as typeof ReceiptText; return <div key={String(title)} className={`rounded-[24px] p-6 ${index === 0 ? 'bg-[#ef6c20] text-white' : 'bg-white text-[#073e2e] shadow-sm'}`}><BenefitIcon className="h-6 w-6" /><div className="mt-10 text-xl font-black">{String(title)}</div><div className={`mt-2 text-sm font-medium leading-6 ${index === 0 ? 'text-white/75' : 'text-[#71827b]'}`}>{String(text)}</div></div>; })}
          </div>
        </div>
      </section>

      <section id="planos" className="bg-white py-24">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center"><Eyebrow>Planos para cada fase</Eyebrow><h2 className="text-4xl font-black tracking-[-.04em] text-[#073e2e] md:text-5xl">Comece com o que precisa.<br />Evolua sem recomeçar.</h2><p className="mt-5 text-lg font-medium text-[#687a73]">Sem taxa por pedido. Uma loja já está incluída em todos os planos.</p></div>
          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {plans.map(plan => <article key={plan.name} className={`relative flex flex-col rounded-[26px] border p-7 ${plan.featured ? 'border-[#ef6c20] bg-[#fffaf6] shadow-[0_24px_70px_-30px_rgba(239,108,32,.55)] lg:-translate-y-3' : 'border-[#dfe7e1] bg-white'}`}>
              {plan.featured && <span className="absolute -top-3 left-7 rounded-full bg-[#ef6c20] px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white">Mais escolhido</span>}
              <h3 className="text-2xl font-black text-[#073e2e]">{plan.name}</h3><p className="mt-2 min-h-[52px] text-sm font-medium leading-6 text-[#6d7e77]">{plan.description}</p>
              <div className="mt-7 flex items-end gap-1 text-[#073e2e]"><span className="mb-2 text-sm font-black">R$</span><strong className="text-5xl font-black tracking-[-.06em]">{plan.price}</strong><span className="mb-2 text-sm font-bold text-[#7d8d87]">/mês</span></div>
              <div className="my-7 h-px bg-[#e4eae5]" /><div className="flex-1 space-y-3">{plan.items.map(item => <div key={item} className="flex gap-3 text-sm font-bold text-[#315548]"><span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#eaf6e2]"><Check className="h-3 w-3 text-[#57932f]" /></span>{item}</div>)}</div>
              <Link to="/login?tab=register" className="mt-8"><Button className={`h-13 w-full rounded-xl text-sm font-black ${plan.featured ? 'bg-[#ef6c20] text-white hover:bg-[#db5d16]' : 'bg-[#064733] text-white hover:bg-[#08392b]'}`}>Escolher {plan.name}<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
            </article>)}
          </div>
          <p className="mt-6 text-center text-xs font-semibold text-[#84938d]">Fiscal/NFC-e disponível conforme configuração e homologação aplicável à operação.</p>
        </div>
      </section>

      <section id="duvidas" className="bg-[#f6f8f4] py-24">
        <div className="container grid gap-12 lg:grid-cols-[.65fr_1.35fr]">
          <div><Eyebrow>Sem complicação</Eyebrow><h2 className="text-4xl font-black tracking-[-.04em] text-[#073e2e]">Dúvidas de quem está pronto para mudar.</h2><p className="mt-5 text-base font-medium leading-7 text-[#6b7d75]">Ainda ficou alguma pergunta? Nossa equipe conhece a rotina de restaurante e ajuda você a escolher o melhor caminho.</p><a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="mt-7 inline-flex items-center gap-2 font-black text-[#e95f12]"><Headphones className="h-5 w-5" />Falar com a equipe</a></div>
          <div className="grid gap-3 sm:grid-cols-2">{faqs.map(([question, answer]) => <article key={question} className="rounded-[20px] border border-[#e0e7e1] bg-white p-5"><h3 className="text-base font-black text-[#073e2e]">{question}</h3><p className="mt-3 text-sm font-medium leading-6 text-[#6d7e77]">{answer}</p></article>)}</div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#ef6c20] py-20 text-white">
        <div className="absolute -right-20 -top-32 h-96 w-96 rounded-full border-[80px] border-white/10" />
        <div className="container relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
          <div className="max-w-3xl"><div className="text-xs font-black uppercase tracking-[.22em] text-white/70">Seu restaurante pode rodar melhor</div><h2 className="mt-4 text-4xl font-black leading-[1.03] tracking-[-.045em] md:text-5xl">Troque o improviso por uma operação que você consegue comandar.</h2></div>
          <div className="flex w-full flex-col gap-3 sm:w-auto"><Link to="/login?tab=register"><Button className="h-14 w-full rounded-xl bg-white px-7 text-base font-black text-[#d9560b] hover:bg-[#fff7ef]">Quero conhecer o PopSystem <ArrowRight className="ml-2 h-5 w-5" /></Button></Link><a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="text-center text-sm font-bold text-white/85 hover:text-white">Prefiro falar pelo WhatsApp</a></div>
        </div>
      </section>

      <ScrollToTop />
    </LandingLayout>
  </>
);

export default LandingPage;
