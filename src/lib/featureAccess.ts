import { PLAN_CATALOG, getPlanCatalogItem } from '@/data/planCatalog';

export type FeatureKey =
  | 'dashboard'
  | 'products'
  | 'orders'
  | 'pdv'
  | 'tables'
  | 'reports'
  | 'menu'
  | 'delivery'
  | 'pix'
  | 'settings'
  | 'kds'
  | 'stock'
  | 'finance'
  | 'cmv'
  | 'deliveryTeam'
  | 'team'
  | 'marketing'
  | 'whatsapp'
  | 'ifood'
  | 'agent'
  | 'desktop'
  | 'hardware'
  | 'security'
  | 'fiscal'
  | 'nfce'
  | 'fiscalCoupons';

export type FeatureDefinition = {
  key: FeatureKey;
  name: string;
  description: string;
  requiredPlanId: number;
  comingSoon?: boolean;
};

export const FEATURE_DEFINITIONS: Record<FeatureKey, FeatureDefinition> = {
  dashboard: {
    key: 'dashboard',
    name: 'Painel inicial',
    description: 'Resumo operacional do restaurante.',
    requiredPlanId: 1,
  },
  products: {
    key: 'products',
    name: 'Produtos e cardápio',
    description: 'Cadastro de produtos, categorias, complementos e variações.',
    requiredPlanId: 1,
  },
  orders: {
    key: 'orders',
    name: 'Pedidos',
    description: 'Gestão dos pedidos recebidos pelo cardápio digital e balcão.',
    requiredPlanId: 1,
  },
  pdv: {
    key: 'pdv',
    name: 'PDV / Frente de Caixa',
    description: 'Venda no balcão, mesas e pagamentos no caixa.',
    requiredPlanId: 1,
  },
  tables: {
    key: 'tables',
    name: 'Gestão de mesas',
    description: 'Controle de mesas e contas abertas.',
    requiredPlanId: 1,
  },
  reports: {
    key: 'reports',
    name: 'Relatórios essenciais',
    description: 'Relatórios básicos de vendas e operação.',
    requiredPlanId: 1,
  },
  menu: {
    key: 'menu',
    name: 'Cardápio digital',
    description: 'Link, QR Code e visualização do cardápio.',
    requiredPlanId: 1,
  },
  delivery: {
    key: 'delivery',
    name: 'Delivery',
    description: 'Áreas de entrega, taxas e configurações de entrega.',
    requiredPlanId: 1,
  },
  pix: {
    key: 'pix',
    name: 'PIX e pagamentos',
    description: 'Configuração de PIX e formas de pagamento.',
    requiredPlanId: 1,
  },
  settings: {
    key: 'settings',
    name: 'Configurações gerais',
    description: 'Preferências básicas do restaurante.',
    requiredPlanId: 1,
  },
  kds: {
    key: 'kds',
    name: 'KDS / Cozinha',
    description: 'Tela de cozinha e organização da produção.',
    requiredPlanId: 2,
  },
  stock: {
    key: 'stock',
    name: 'Estoque e insumos',
    description: 'Controle de ingredientes, estoque e ficha técnica.',
    requiredPlanId: 2,
  },
  finance: {
    key: 'finance',
    name: 'Financeiro',
    description: 'Caixa, despesas e visão financeira.',
    requiredPlanId: 2,
  },
  cmv: {
    key: 'cmv',
    name: 'Inteligência de CMV',
    description: 'Análises de custo, CMV e curva ABC.',
    requiredPlanId: 2,
  },
  deliveryTeam: {
    key: 'deliveryTeam',
    name: 'Motoboys e entregas',
    description: 'Gestão de entregadores e rotas operacionais.',
    requiredPlanId: 2,
  },
  team: {
    key: 'team',
    name: 'Garçons e equipe',
    description: 'Controle de usuários, garçons e permissões de equipe.',
    requiredPlanId: 2,
  },
  marketing: {
    key: 'marketing',
    name: 'Marketing',
    description: 'Banners, destaques, upsell, fidelidade, pixels e cupons promocionais.',
    requiredPlanId: 2,
  },
  whatsapp: {
    key: 'whatsapp',
    name: 'WhatsApp com automações',
    description: 'Integrações e mensagens automáticas por WhatsApp.',
    requiredPlanId: 2,
  },
  ifood: {
    key: 'ifood',
    name: 'Integração iFood',
    description: 'Integração com iFood para recebimento e operação de pedidos.',
    requiredPlanId: 2,
    comingSoon: true,
  },
  agent: {
    key: 'agent',
    name: 'Assistente inteligente',
    description: 'Agente e recursos de inteligência artificial.',
    requiredPlanId: 3,
  },
  desktop: {
    key: 'desktop',
    name: 'App desktop',
    description: 'Aplicativo desktop com suporte a impressão e hardware.',
    requiredPlanId: 3,
  },
  hardware: {
    key: 'hardware',
    name: 'Hardware avançado',
    description: 'Impressoras, balanças e integrações de dispositivos.',
    requiredPlanId: 3,
  },
  security: {
    key: 'security',
    name: 'Segurança e performance',
    description: 'Painel de auditoria, segurança e monitoramento.',
    requiredPlanId: 3,
  },
  fiscal: {
    key: 'fiscal',
    name: 'Notas fiscais',
    description: 'Configurações fiscais e emissão de documentos fiscais.',
    requiredPlanId: 3,
  },
  nfce: {
    key: 'nfce',
    name: 'NFC-e',
    description: 'Emissão de Nota Fiscal de Consumidor Eletrônica.',
    requiredPlanId: 3,
  },
  fiscalCoupons: {
    key: 'fiscalCoupons',
    name: 'Cupons fiscais',
    description: 'Gerenciamento e emissão de cupons fiscais eletrônicos.',
    requiredPlanId: 3,
  },
};

export const getFeatureDefinition = (feature: FeatureKey) => FEATURE_DEFINITIONS[feature];

// Temporarily keep paid plan enforcement disabled so restaurants can access the system
// while billing is being stabilized. Coming-soon modules remain blocked.
export const BILLING_ENFORCEMENT_ENABLED = false;

export const getRequiredPlan = (feature: FeatureKey) => {
  const definition = getFeatureDefinition(feature);
  return getPlanCatalogItem(definition.requiredPlanId) || PLAN_CATALOG[0];
};

export const hasFeatureAccess = (
  feature: FeatureKey,
  subscription?: { status?: string | null; plan_id?: number | null; trial_end?: string | null } | null
) => {
  const definition = getFeatureDefinition(feature);
  if (definition.comingSoon) return false;
  if (!BILLING_ENFORCEMENT_ENABLED) return true;

  const status = String(subscription?.status || '').toLowerCase();
  if (status.includes('trial')) {
    if (!subscription?.trial_end) return true;
    return new Date(subscription.trial_end).getTime() >= Date.now();
  }

  if (status !== 'active') return false;
  return Number(subscription?.plan_id || 0) >= definition.requiredPlanId;
};

export const getRouteFeature = (pathname: string): FeatureKey | null => {
  const routes: Array<[string, FeatureKey]> = [
    ['/dashboard', 'dashboard'],
    ['/produtos', 'products'],
    ['/pedidos', 'orders'],
    ['/orders', 'orders'],
    ['/cozinha', 'kds'],
    ['/kds-view', 'kds'],
    ['/tv-view', 'kds'],
    ['/pdv', 'pdv'],
    ['/mesas', 'tables'],
    ['/relatorios', 'reports'],
    ['/cardapio', 'menu'],
    ['/bairros-entrega', 'delivery'],
    ['/pix', 'pix'],
    ['/caixa', 'finance'],
    ['/financeiro', 'finance'],
    ['/despesas', 'finance'],
    ['/estoque', 'stock'],
    ['/inteligencia/cmv', 'cmv'],
    ['/inteligencia/curva-abc', 'cmv'],
    ['/entregadores', 'deliveryTeam'],
    ['/motoboys', 'deliveryTeam'],
    ['/garcons', 'team'],
    ['/marketing', 'marketing'],
    ['/loyalty', 'marketing'],
    ['/whatsapp-bot', 'whatsapp'],
    ['/configuracoes', 'settings'],
    ['/downloads', 'desktop'],
    ['/desktop', 'desktop'],
    ['/agente', 'agent'],
    ['/security', 'security'],
    ['/nfce', 'nfce'],
  ];

  return routes.find(([route]) => pathname === route)?.[1] || null;
};
