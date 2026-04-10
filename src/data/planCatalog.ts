export type PlanCatalogItem = {
  id: number;
  name: string;
  shortName: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  featured?: boolean;
  badge?: string;
  accent: 'green' | 'orange' | 'purple';
  audience: string;
  features: string[];
  modules: string[];
};

export const PLAN_CATALOG: PlanCatalogItem[] = [
  {
    id: 1,
    name: 'Essencial',
    shortName: 'Essencial',
    description: 'Operação enxuta para delivery, balcão e cardápio digital.',
    monthlyPrice: 129,
    annualPrice: 1290,
    accent: 'green',
    audience: 'Ideal para operações que precisam vender bem e organizar o básico com agilidade.',
    features: [
      'Cardápio digital com link e QR Code',
      'Produtos, categorias e complementos',
      'Pedidos online com acompanhamento',
      'PDV frente de caixa',
      'Delivery com áreas e taxa',
      'PIX e formas de pagamento',
      'Relatórios essenciais de vendas',
      '1 usuário gestor'
    ],
    modules: [
      'Cardápio Digital',
      'Pedidos',
      'Produtos',
      'PDV',
      'Delivery',
      'QR Code e link'
    ]
  },
  {
    id: 2,
    name: 'Profissional',
    shortName: 'Profissional',
    description: 'Gestão completa com operação, marketing e automações.',
    monthlyPrice: 159,
    annualPrice: 1590,
    featured: true,
    badge: 'Mais escolhido',
    accent: 'orange',
    audience: 'Ideal para restaurantes que já operam volume e querem ganhar controle e conversão.',
    features: [
      'Tudo do Essencial',
      'Produtos ilimitados',
      'KDS e tela de cozinha',
      'Estoque, ingredientes e ficha técnica',
      'Financeiro e inteligência de CMV',
      'Entregadores e gestão de equipe',
      'WhatsApp com automações',
      'Marketing com banners, destaques e upsell',
      'Integração iFood e recursos de atendimento'
    ],
    modules: [
      'KDS / Cozinha',
      'Estoque',
      'Financeiro',
      'Entregadores',
      'Garçons e equipe',
      'Marketing',
      'WhatsApp',
      'iFood'
    ]
  },
  {
    id: 3,
    name: 'Elite',
    shortName: 'Elite',
    description: 'Plano premium com IA, fiscal e recursos avançados do ecossistema.',
    monthlyPrice: 189,
    annualPrice: 1890,
    accent: 'purple',
    audience: 'Ideal para quem quer usar todo o potencial do BoraCumê com automação e recursos avançados.',
    features: [
      'Tudo do Profissional',
      'Importação de cardápio com IA',
      'Agente e recursos inteligentes',
      'Fiscal e NFC-e',
      'App desktop',
      'Impressoras e hardware avançado',
      'Prioridade em novidades e suporte',
      'Recursos premium de expansão'
    ],
    modules: [
      'IA',
      'Fiscal / NFC-e',
      'Desktop',
      'Hardware',
      'Automação avançada'
    ]
  }
];

export const getPlanCatalogItem = (planId?: number | null, planName?: string | null) => {
  const normalizedName = String(planName || '').trim().toLowerCase();
  return PLAN_CATALOG.find((plan) => {
    if (planId && plan.id === planId) return true;
    return normalizedName ? plan.name.toLowerCase() === normalizedName : false;
  });
};
