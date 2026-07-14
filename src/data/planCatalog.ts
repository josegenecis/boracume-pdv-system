export type PlanCatalogItem = {
  id: number;
  slug: 'essencial' | 'pro' | 'multi';
  name: string;
  shortName: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  includedStores: number;
  extraStorePrice?: number;
  storeLimit?: number | null;
  featured?: boolean;
  badge?: string;
  accent: 'green' | 'orange' | 'purple';
  audience: string;
  features: string[];
  modules: string[];
};

export type BillingPeriod = 'monthly' | 'quarterly' | 'semiannual' | 'yearly';

export type BillingPeriodConfig = {
  id: BillingPeriod;
  label: string;
  shortLabel: string;
  months: number;
  discountPercent: number;
  asaasCycle: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY';
};

export const BILLING_PERIODS: Record<BillingPeriod, BillingPeriodConfig> = {
  monthly: { id: 'monthly', label: 'Mensal', shortLabel: '1 mês', months: 1, discountPercent: 0, asaasCycle: 'MONTHLY' },
  quarterly: { id: 'quarterly', label: 'Trimestral', shortLabel: '3 meses', months: 3, discountPercent: 10, asaasCycle: 'QUARTERLY' },
  semiannual: { id: 'semiannual', label: 'Semestral', shortLabel: '6 meses', months: 6, discountPercent: 15, asaasCycle: 'SEMIANNUALLY' },
  yearly: { id: 'yearly', label: 'Anual', shortLabel: '12 meses', months: 12, discountPercent: 20, asaasCycle: 'YEARLY' },
};

export const getBillingPeriodConfig = (period: BillingPeriod) => BILLING_PERIODS[period] || BILLING_PERIODS.monthly;

export const calculatePeriodPrice = (monthlyValue: number, period: BillingPeriod) => {
  const config = getBillingPeriodConfig(period);
  const grossValue = Number(monthlyValue || 0) * config.months;
  const totalValue = grossValue * (1 - config.discountPercent / 100);
  return {
    ...config,
    grossValue: Number(grossValue.toFixed(2)),
    totalValue: Number(totalValue.toFixed(2)),
    monthlyEquivalent: Number((totalValue / config.months).toFixed(2)),
    savings: Number((grossValue - totalValue).toFixed(2)),
  };
};

export const PLAN_CATALOG: PlanCatalogItem[] = [
  {
    id: 1,
    slug: 'essencial',
    name: 'Essencial',
    shortName: 'Essencial',
    description: 'O básico profissional para vender no balcão, no delivery e organizar a operação do dia a dia.',
    monthlyPrice: 159,
    annualPrice: 1526.40,
    includedStores: 1,
    storeLimit: 1,
    badge: 'Comece organizado',
    accent: 'green',
    audience: 'Ideal para restaurantes pequenos, lanchonetes, cafeterias e operações que precisam sair do papel.',
    features: [
      'PDV completo e fechamento de caixa',
      'Cardápio digital com link e QR Code',
      'Pedidos online, balcão, retirada e delivery',
      'Mesas e comandas básicas',
      'Controle de estoque essencial',
      'Financeiro básico, caixa e despesas',
      'Relatórios principais da operação',
      'PIX e formas de pagamento',
      'Suporte PopSystem',
      'Uma loja incluída'
    ],
    modules: [
      'PDV',
      'Cardápio Digital',
      'Pedidos',
      'Mesas',
      'Estoque',
      'Financeiro',
      'Relatórios'
    ]
  },
  {
    id: 2,
    slug: 'pro',
    name: 'Pro',
    shortName: 'Pro',
    description: 'Sistema completo para uma loja com automações, WhatsApp, fiscal, cozinha e inteligência operacional.',
    monthlyPrice: 229,
    annualPrice: 2198.40,
    includedStores: 1,
    storeLimit: 1,
    featured: true,
    badge: 'Completo para uma loja',
    accent: 'orange',
    audience: 'Ideal para restaurantes, lanchonetes, açaís, pizzarias e mercados que operam uma unidade.',
    features: [
      'PDV completo e fechamento de caixa',
      'Cardápio digital com link e QR Code',
      'Pedidos online, balcão, retirada e delivery',
      'Mesas, comandas e app garçom',
      'KDS, tela de cozinha e impressão',
      'Estoque, ingredientes e ficha técnica',
      'Financeiro, caixa, despesas e relatórios',
      'WhatsApp, campanhas e envio em massa',
      'PIX, Mercado Pago e formas de pagamento',
      'Fiscal/NFC-e, app desktop e hardware',
      'IA para cardápio, marketing e produtividade',
      'Uma loja incluída'
    ],
    modules: [
      'PDV',
      'Mesas',
      'Cardápio Digital',
      'Pedidos',
      'KDS / Cozinha',
      'Estoque',
      'Financeiro',
      'Fiscal',
      'Marketing',
      'WhatsApp',
      'App Desktop'
    ]
  },
  {
    id: 3,
    slug: 'multi',
    name: 'Multi',
    shortName: 'Multi',
    description: 'Tudo do Pro com gestão multilojas, visão consolidada e cobrança por loja adicional.',
    monthlyPrice: 269,
    annualPrice: 2582.40,
    includedStores: 1,
    extraStorePrice: 149,
    storeLimit: null,
    badge: '+ R$149 por loja extra',
    accent: 'purple',
    audience: 'Ideal para redes, grupos, franquias e donos que querem enxergar todas as lojas juntas ou separadas.',
    features: [
      'Tudo do plano Pro',
      'Uma loja incluída no valor base',
      'R$149/mês por loja adicional',
      'Cadastro e operação de múltiplas lojas',
      'Painel inicial consolidado e por unidade',
      'Relatórios financeiros por loja ou rede',
      'Estoque, pedidos e operação separados por loja',
      'Usuários e permissões por unidade',
      'Troca rápida entre lojas',
      'Preparado para expansão de redes'
    ],
    modules: [
      'Multilojas',
      'Painel consolidado',
      'Financeiro por loja',
      'Relatórios da rede',
      'Permissões por unidade',
      'Expansão'
    ]
  }
];

export const getPlanCatalogItem = (planId?: number | null, planName?: string | null) => {
  const normalizedName = String(planName || '').trim().toLowerCase();
  const normalizedId = Number(planId || 0);

  return PLAN_CATALOG.find((plan) => {
    if (normalizedId && plan.id === normalizedId) return true;
    if (!normalizedName) return false;
    if (plan.name.toLowerCase() === normalizedName) return true;
    if (plan.slug === normalizedName) return true;
    if (['essencial', 'basic', 'basico', 'básico'].includes(normalizedName)) return plan.slug === 'essencial';
    if (['profissional', 'professional', 'pro'].includes(normalizedName)) return plan.slug === 'pro';
    if (['elite', 'premium', 'multi', 'multilojas'].includes(normalizedName)) return plan.slug === 'multi';
    return false;
  });
};
