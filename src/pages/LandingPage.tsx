import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChefHat,
  Clock,
  DollarSign,
  Megaphone,
  Monitor,
  Package,
  Phone,
  Send,
  Smartphone,
  Sparkles,
  Store,
  TabletSmartphone,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import LandingLayout from '@/components/landing/LandingLayout';
import { ScrollToTop } from '@/components/landing/ScrollToTop';

const WHATSAPP_URL = 'https://wa.me/5585999999999?text=Ol%C3%A1%2C%20quero%20conhecer%20o%20PopSystem';

const platformCards = [
  { icon: Monitor, title: 'PDV Inteligente', description: 'Venda no balcão, mesa, delivery e retirada com controle completo.' },
  { icon: TabletSmartphone, title: 'Cardápio Online', description: 'Receba pedidos online com produtos, opções, adicionais, imagens e promoções.' },
  { icon: Store, title: 'Totem de Autoatendimento', description: 'Reduza filas, agilize pedidos e ofereça uma experiência moderna ao cliente.' },
  { icon: Bot, title: 'WhatsApp com IA', description: 'Atendimento inteligente para responder clientes, sugerir produtos e ajudar nas vendas.' },
  { icon: Megaphone, title: 'Anúncios Automáticos', description: 'Crie propagandas, textos e anúncios para vender mais com apoio da inteligência artificial.' },
  { icon: Users, title: 'Controle de Funcionários', description: 'Ponto, escalas, horários, produtividade e gestão da equipe em um só lugar.' },
  { icon: DollarSign, title: 'Financeiro e Caixa', description: 'Controle vendas, formas de pagamento, fechamento de caixa e relatórios gerenciais.' },
  { icon: Package, title: 'Estoque e Produção', description: 'Acompanhe ingredientes, baixa automática e previsão de reposição.' },
];

const differentials = [
  'Gestão multiempresa',
  'Pedidos em tempo real',
  'PIX automático',
  'Totem integrado',
  'Controle de ponto facial',
  'Propaganda integrada',
  'Atendimento via WhatsApp com IA',
  'Cardápio digital moderno',
  'Relatórios inteligentes',
  'App do garçom',
  'Divisão de conta por comanda',
  'SmartMenu Engine para importação de cardápios',
];

const aiInsights = [
  'Seu estoque de cheddar pode acabar amanhã.',
  'O combo mais vendido hoje foi o X-Burger.',
  'Clientes inativos há 20 dias podem receber uma campanha automática.',
  'Hoje é um bom dia para impulsionar uma promoção no WhatsApp.',
  'Seu horário de maior venda foi entre 19h e 21h.',
];

const audiences = [
  'Restaurantes',
  'Hamburguerias',
  'Pizzarias',
  'Açaíterias',
  'Lanchonetes',
  'Sorveterias',
  'Cafeterias',
  'Food trucks',
  'Franquias',
  'Deliverys',
];

const benefits = [
  'Menos retrabalho',
  'Mais controle',
  'Atendimento mais rápido',
  'Pedidos mais organizados',
  'Mais vendas no delivery',
  'Menos erros operacionais',
  'Mais clareza financeira',
  'Equipe mais produtiva',
  'Clientes mais satisfeitos',
];

const ecosystem = ['Cliente', 'Pedido', 'Pagamento', 'Cozinha', 'Entrega', 'Financeiro', 'Relatório', 'Marketing', 'Fidelização'];

const plans = [
  {
    name: 'Pro',
    description: 'Para restaurantes que querem operar uma loja completa, com PDV, delivery, mesas, estoque, financeiro e fiscal.',
    items: ['PDV e pedidos', 'Cardápio digital', 'Mesas e app garçom', 'Estoque, financeiro e fiscal'],
    featured: true,
  },
  {
    name: 'Multi',
    description: 'Para redes e donos com mais de uma loja. O valor base inclui 1 loja e cada loja adicional soma R$149/mês.',
    items: ['Tudo do Pro', 'Multilojas', 'Painel consolidado', 'Financeiro por unidade'],
  },
];

const FeatureMockup = () => (
  <div className="relative mx-auto w-full max-w-2xl">
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/12">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <span className="h-3 w-3 rounded-full bg-red-400" />
        <span className="h-3 w-3 rounded-full bg-yellow-400" />
        <span className="h-3 w-3 rounded-full bg-green-400" />
        <span className="ml-3 text-xs font-semibold text-slate-400">popsystem.com.br/dashboard</span>
      </div>
      <div className="grid gap-3 p-3 md:grid-cols-[160px,1fr]">
        <div className="hidden rounded-lg bg-[#063D2E] p-3 text-white md:block">
          <img src="/LOGOMARCA/logo-pop.webp" alt="PopSystem" className="mb-5 h-8 w-auto" />
          {['Pedidos', 'PDV', 'Mesas', 'Marketing', 'Financeiro'].map((item, index) => (
            <div key={item} className={`mb-2 rounded-md px-3 py-2 text-xs ${index === 0 ? 'bg-white text-[#063D2E]' : 'text-white/70'}`}>
              {item}
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Pedidos hoje', '42'],
              ['Ticket médio', 'R$ 48'],
              ['Tempo médio', '18 min'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="text-[11px] text-slate-500">{label}</div>
                <div className="mt-1 text-lg font-black text-[#063D2E]">{value}</div>
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr,180px]">
            <div className="rounded-lg border border-slate-100 bg-white p-3">
              <div className="mb-3 flex items-center justify-between">
                <strong className="text-sm text-[#063D2E]">Painel de pedidos</strong>
                <span className="rounded-full bg-green-50 px-2 py-1 text-[10px] font-bold text-green-700">tempo real</span>
              </div>
              {['Mesa 04 - X-Burger', 'Delivery - Açaí 500ml', 'Retirada - Pizza média'].map((item, index) => (
                <div key={item} className="mb-2 flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-xs">
                  <span>{item}</span>
                  <span className={index === 0 ? 'text-orange-600' : 'text-[#063D2E]'}>{index === 0 ? 'Cozinha' : 'Recebido'}</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-[#EF6C20] p-3 text-white">
              <Sparkles className="mb-3 h-5 w-5" />
              <div className="text-xs font-semibold uppercase opacity-80">Anúncios Automáticos</div>
              <div className="mt-2 text-lg font-black leading-tight">Campanha pronta para revisão</div>
              <div className="mt-3 rounded-md bg-white/15 p-2 text-[11px]">Açaí 1000ml em oferta</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div className="absolute -bottom-8 -left-4 hidden w-36 rounded-[28px] border-4 border-slate-900 bg-white p-2 shadow-xl md:block">
      <div className="rounded-[20px] bg-slate-50 p-3">
        <div className="mb-3 flex items-center gap-2">
          <Phone className="h-4 w-4 text-[#063D2E]" />
          <span className="text-[10px] font-bold">WhatsApp AI</span>
        </div>
        <div className="mb-2 rounded-md bg-white p-2 text-[10px] shadow-sm">Olá! Posso ajudar com seu pedido?</div>
        <div className="ml-auto rounded-md bg-green-100 p-2 text-[10px]">Quero repetir o último.</div>
      </div>
    </div>

    <div className="absolute -bottom-10 -right-2 hidden w-40 rounded-lg border border-slate-200 bg-white p-3 shadow-xl lg:block">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold text-[#063D2E]">
        <Clock className="h-4 w-4 text-[#EF6C20]" />
        Ponto facial
      </div>
      <div className="rounded-md bg-slate-50 p-2 text-[11px] text-slate-600">Entrada registrada às 08:02</div>
    </div>
  </div>
);

const SectionHeader = ({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) => (
  <div className="mx-auto mb-10 max-w-3xl text-center">
    {eyebrow && <div className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-[#EF6C20]">{eyebrow}</div>}
    <h2 className="text-3xl font-black leading-tight text-[#063D2E] md:text-4xl">{title}</h2>
    {description && <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg">{description}</p>}
  </div>
);

const LandingPage = () => {
  return (
    <>
      <Helmet>
        <title>PopSystem - Sistema Operacional do Restaurante Moderno</title>
        <meta
          name="description"
          content="PopSystem é um sistema de gestão para restaurante com PDV, cardápio digital, delivery, controle de pedidos, totem de autoatendimento, WhatsApp para restaurante, financeiro, estoque, funcionários e marketing para restaurante."
        />
        <meta
          name="keywords"
          content="sistema para restaurante, sistema para delivery, PDV para restaurante, cardápio digital, sistema de gestão para restaurante, controle de pedidos, totem de autoatendimento, WhatsApp para restaurante, marketing para restaurante"
        />
        <meta property="og:title" content="PopSystem - O Sistema Operacional do Restaurante Moderno" />
        <meta property="og:description" content="Tudo que seu restaurante precisa em uma única plataforma: PDV, delivery, cardápio digital, WhatsApp AI, marketing, financeiro, estoque e equipe." />
      </Helmet>

      <LandingLayout>
        <section className="relative overflow-hidden bg-[#F8FAF7]">
          <div className="container grid min-h-[calc(100vh-5rem)] items-center gap-12 py-14 md:grid-cols-[1fr,0.92fr] md:py-20">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#85C441]/35 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#063D2E]">
                <ChefHat className="h-4 w-4 text-[#EF6C20]" />
                Sistema para restaurante completo
              </div>
              <h1 className="max-w-4xl text-4xl font-black leading-[1.04] text-[#063D2E] md:text-6xl">
                O Sistema Operacional do Restaurante Moderno
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-650 md:text-xl">
                Gerencie pedidos, delivery, PDV, mesas, totem, WhatsApp, marketing, financeiro, estoque,
                funcionários e inteligência artificial em uma única plataforma.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/signup">
                  <Button className="h-14 w-full rounded-lg bg-[#EF6C20] px-7 text-base font-bold text-white hover:bg-[#d95f1c] sm:w-auto">
                    Ver demonstração
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="h-14 w-full rounded-lg border-[#063D2E]/20 px-7 text-base font-bold text-[#063D2E] hover:bg-[#063D2E] hover:text-white sm:w-auto">
                    Falar com especialista
                  </Button>
                </a>
              </div>
              <div className="mt-8 grid max-w-xl grid-cols-3 gap-3 text-sm text-slate-600">
                {['PDV para restaurante', 'Sistema para delivery', 'Controle de pedidos'].map((item) => (
                  <div key={item} className="rounded-lg border border-slate-200 bg-white p-3 font-semibold">{item}</div>
                ))}
              </div>
            </div>
            <FeatureMockup />
          </div>
        </section>

        <section id="funcionalidades" className="bg-white py-20">
          <div className="container">
            <SectionHeader
              eyebrow="O que o PopSystem faz"
              title="Uma plataforma completa para toda a operação"
              description="Do primeiro pedido ao relatório gerencial, o PopSystem organiza a rotina do restaurante em uma base única."
            />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {platformCards.map(({ icon: Icon, title, description }) => (
                <div key={title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[#F7EEDF] text-[#EF6C20]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-black text-[#063D2E]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="diferenciais" className="bg-[#F8FAF7] py-20">
          <div className="container grid gap-10 lg:grid-cols-[0.85fr,1.15fr] lg:items-center">
            <div>
              <div className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-[#EF6C20]">Diferenciais</div>
              <h2 className="text-3xl font-black leading-tight text-[#063D2E] md:text-4xl">
                Tudo conectado. Simples de usar. Pronto para crescer.
              </h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                Uma plataforma com visão nacional para restaurantes que precisam de operação organizada, canais integrados e dados confiáveis para decidir.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {differentials.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold text-[#063D2E]">
                  <CheckCircle2 className="h-5 w-5 flex-none text-[#85C441]" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="ia" className="bg-[#063D2E] py-20 text-white">
          <div className="container">
            <SectionHeader
              eyebrow="Inteligência Artificial"
              title="Uma IA trabalhando pelo seu restaurante"
              description="O PopSystem utiliza inteligência artificial para simplificar tarefas, melhorar decisões e ajudar seu restaurante a vender mais."
            />
            <div className="grid gap-4 md:grid-cols-5">
              {aiInsights.map((item, index) => (
                <div key={item} className="rounded-lg border border-white/12 bg-white/8 p-5">
                  <Sparkles className="mb-4 h-5 w-5 text-[#EF6C20]" />
                  <p className="text-sm font-semibold leading-6 text-white/90">{item}</p>
                  <div className="mt-5 text-xs font-black text-white/35">AI {String(index + 1).padStart(2, '0')}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-20">
          <div className="container">
            <SectionHeader title="Feito para operações de todos os tamanhos" />
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
              {audiences.map((item) => (
                <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center font-bold text-[#063D2E]">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="beneficios" className="bg-[#F8FAF7] py-20">
          <div className="container">
            <SectionHeader title="O impacto na rotina do restaurante" />
            <div className="grid gap-3 md:grid-cols-3">
              {benefits.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-lg bg-white p-4 font-semibold text-slate-700 shadow-sm">
                  <CheckCircle2 className="h-5 w-5 text-[#85C441]" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-20">
          <div className="container">
            <SectionHeader
              eyebrow="Ecossistema"
              title="Da venda ao relatório, tudo no mesmo lugar"
              description="O fluxo operacional fica conectado para reduzir retrabalho e dar mais clareza para cada etapa do restaurante."
            />
            <div className="flex flex-wrap items-center justify-center gap-3">
              {ecosystem.map((item, index) => (
                <React.Fragment key={item}>
                  <div className="rounded-lg border border-slate-200 bg-[#F8FAF7] px-4 py-3 text-sm font-black text-[#063D2E]">{item}</div>
                  {index < ecosystem.length - 1 && <ArrowRight className="h-4 w-4 text-[#EF6C20]" />}
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        <section id="marketing" className="bg-[#F8FAF7] py-20">
          <div className="container grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-[#EF6C20]">Propaganda para restaurante</div>
              <h2 className="text-3xl font-black text-[#063D2E] md:text-4xl">Propaganda integrada ao sistema</h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                Com os Anúncios Automáticos, o restaurante pode criar campanhas com mais facilidade, usando fotos reais dos produtos,
                textos gerados por IA e integração com redes sociais.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {['Textos automáticos', 'Artes com modelos profissionais', 'Campanhas para WhatsApp', 'Campanhas para cardápio online', 'Pessoas próximas ao restaurante', 'Resultados'].map((item) => (
                  <div key={item} className="rounded-lg bg-white p-4 text-sm font-bold text-[#063D2E] shadow-sm">{item}</div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <strong className="text-[#063D2E]">Anúncios Automáticos</strong>
                <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-[#EF6C20]">Revisão</span>
              </div>
              <div className="aspect-square rounded-lg bg-[#063D2E] p-6 text-white">
                <div className="text-4xl font-black leading-tight">AÇAÍ 1000ML EM OFERTA</div>
                <div className="mt-6 rounded-lg bg-white p-4 text-[#063D2E]">
                  <div className="text-sm font-bold">Foto real preservada</div>
                  <div className="mt-2 h-28 rounded-lg bg-[#F7EEDF]" />
                </div>
                <div className="mt-5 inline-flex rounded-lg bg-[#EF6C20] px-5 py-3 font-black">CHAME NO WHATSAPP</div>
              </div>
            </div>
          </div>
        </section>

        <section id="whatsapp" className="bg-white py-20">
          <div className="container grid gap-8 lg:grid-cols-[0.8fr,1.2fr] lg:items-center">
            <div className="rounded-lg border border-slate-200 bg-[#F8FAF7] p-5">
              <div className="mb-4 flex items-center gap-2 font-black text-[#063D2E]">
                <Bot className="h-5 w-5 text-[#85C441]" />
                WhatsApp AI
              </div>
              {[
                ['Cliente', 'Qual o combo mais pedido hoje?'],
                ['PopSystem', 'O combo X-Burger com batata é uma ótima opção. Posso montar seu pedido?'],
                ['Cliente', 'Pode sim, manda o PIX.'],
              ].map(([who, text]) => (
                <div key={text} className={`mb-3 rounded-lg p-3 text-sm ${who === 'Cliente' ? 'ml-8 bg-white' : 'mr-8 bg-green-100'}`}>
                  <strong className="text-xs text-[#063D2E]">{who}</strong>
                  <p className="mt-1 text-slate-700">{text}</p>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-[#EF6C20]">WhatsApp para restaurante</div>
              <h2 className="text-3xl font-black text-[#063D2E] md:text-4xl">Atendimento que entende o cliente</h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                O WhatsApp com IA ajuda o restaurante a responder dúvidas, consultar cardápio, sugerir produtos,
                repetir pedidos e encaminhar atendimentos humanos quando necessário.
              </p>
            </div>
          </div>
        </section>

        <section id="precos" className="bg-[#F8FAF7] py-20">
          <div className="container">
            <SectionHeader title="Planos claros para cada momento do restaurante" />
            <div className="grid gap-4 md:grid-cols-3">
              {plans.map((plan) => (
                <div key={plan.name} className={`rounded-lg border bg-white p-6 shadow-sm ${plan.featured ? 'border-[#EF6C20] shadow-orange-100' : 'border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-black text-[#063D2E]">{plan.name}</h3>
                    {plan.featured && <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-[#EF6C20]">Popular</span>}
                  </div>
                  <p className="mt-3 min-h-[72px] text-sm leading-6 text-slate-600">{plan.description}</p>
                  <div className="mt-6 space-y-3">
                    {plan.items.map((item) => (
                      <div key={item} className="flex items-center gap-2 text-sm font-semibold text-[#063D2E]">
                        <CheckCircle2 className="h-4 w-4 text-[#85C441]" />
                        {item}
                      </div>
                    ))}
                  </div>
                  <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
                    <Button className={`mt-7 w-full rounded-lg ${plan.featured ? 'bg-[#EF6C20] text-white hover:bg-[#d95f1c]' : 'bg-[#063D2E] text-white hover:bg-[#083326]'}`}>
                      Consultar plano ideal
                    </Button>
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#063D2E] py-20 text-white">
          <div className="container text-center">
            <h2 className="mx-auto max-w-3xl text-3xl font-black leading-tight md:text-5xl">Pronto para modernizar seu restaurante?</h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/75">
              Conheça o PopSystem e veja como uma plataforma completa pode simplificar sua operação e ajudar seu negócio a crescer.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/signup">
                <Button className="h-14 w-full rounded-lg bg-[#EF6C20] px-7 text-base font-bold text-white hover:bg-[#d95f1c] sm:w-auto">
                  Agendar demonstração
                  <Send className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
                <Button variant="outline" className="h-14 w-full rounded-lg border-white/30 bg-white text-[#063D2E] px-7 text-base font-bold hover:bg-white/90 sm:w-auto">
                  Falar no WhatsApp
                </Button>
              </a>
            </div>
          </div>
        </section>

        <ScrollToTop />
      </LandingLayout>
    </>
  );
};

export default LandingPage;
