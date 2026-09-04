import type { EmployeeApp, EmployeeRole } from '@/lib/team/types';

export const ROLE_OPTIONS: Array<{ value: EmployeeRole; label: string }> = [
  { value: 'administrator', label: 'Administrador' },
  { value: 'manager', label: 'Gerente' },
  { value: 'cashier', label: 'Caixa' },
  { value: 'waiter', label: 'Garçom' },
  { value: 'kitchen', label: 'Cozinha' },
  { value: 'driver', label: 'Motoboy' },
  { value: 'stockkeeper', label: 'Estoquista' },
  { value: 'finance', label: 'Financeiro' },
  { value: 'hr', label: 'RH' },
  { value: 'custom', label: 'Personalizado' },
];

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  monthly: 'Mensalista',
  hourly: 'Horista',
  daily: 'Diarista',
  weekly: 'Semanal',
  clt: 'CLT',
  freelance: 'Freelancer',
  partner: 'Sócio(a)',
  intern: 'Estagiário(a)',
  other: 'Outro',
};

export const REMUNERATION_TYPE_LABELS: Record<string, string> = {
  fixed: 'Fixa',
  hourly: 'Por hora',
  daily: 'Por diária',
  weekly: 'Semanal',
  commission: 'Comissão',
  mixed: 'Fixa + comissão',
  other: 'Outra',
};

export const APP_OPTIONS: Array<{
  value: EmployeeApp;
  label: string;
  description: string;
}> = [
  {
    value: 'popsystem',
    label: 'Acesso ao PopSystem',
    description: 'Painel e módulos permitidos',
  },
  { value: 'pdv', label: 'Acesso ao PDV', description: 'Vendas e caixa' },
  { value: 'waiter', label: 'App Garçom', description: 'Mesas e pedidos' },
  { value: 'driver', label: 'App Motoboy', description: 'Entregas e rotas' },
  {
    value: 'time_clock',
    label: 'App Ponto',
    description: 'Registro de jornada',
  },
  { value: 'kds', label: 'KDS', description: 'Produção e cozinha' },
  {
    value: 'finance',
    label: 'Financeiro',
    description: 'Caixa e relatórios autorizados',
  },
  { value: 'stock', label: 'Estoque', description: 'Itens e movimentações' },
  {
    value: 'administration',
    label: 'Administração',
    description: 'Configurações administrativas',
  },
];

export const PERMISSION_GROUPS = [
  {
    id: 'team',
    label: 'Equipe e RH',
    description: 'Cadastros, salários, fechamento e rotinas da equipe.',
    apps: ['popsystem', 'administration', 'finance'],
    items: [
      ['users_manage', 'Cadastrar e editar colaboradores'],
      ['compensation_view', 'Ver salários e dados bancários'],
      ['compensation_manage', 'Alterar salários e remuneração'],
      ['payroll_view', 'Ver fechamento mensal'],
      ['payroll_manage', 'Calcular e ajustar fechamento'],
      ['payroll_approve', 'Aprovar fechamento'],
      ['payroll_reopen', 'Reabrir fechamento'],
      ['commission_manage', 'Gerenciar comissões'],
      ['advance_manage', 'Registrar adiantamentos'],
    ],
  },
  {
    id: 'timeclock',
    label: 'Controle de ponto',
    description: 'Administração da jornada, escalas e correções auditadas.',
    apps: ['time_clock', 'popsystem', 'administration'],
    items: [
      ['timeclock_manage', 'Administrar controle de ponto'],
      ['timeclock_correct', 'Corrigir ponto com auditoria'],
      ['schedule_manage', 'Gerenciar escalas e folgas'],
    ],
  },
  {
    id: 'pos',
    label: 'PDV e mesas',
    description: 'Venda, caixa, descontos, cancelamentos e atendimento de mesas.',
    apps: ['pdv', 'waiter', 'popsystem'],
    items: [
      ['tables_access', 'Abrir mesa'],
      ['waiter_order_create', 'Lançar pedido'],
      ['table_transfer', 'Transferir mesa'],
      ['pos_discount', 'Aplicar desconto'],
      ['pos_cancel_item', 'Cancelar item'],
      ['table_close', 'Fechar conta'],
      ['payment_receive', 'Receber pagamento'],
      ['pos_access', 'Acessar PDV'],
      ['pos_open_close', 'Abrir e fechar caixa'],
    ],
  },
  {
    id: 'delivery',
    label: 'Motoboys e delivery',
    description: 'Entregas, rotas, áreas e cadastro de entregadores.',
    apps: ['driver', 'popsystem', 'administration'],
    items: [
      ['driver_view_assignments', 'Ver entregas atribuídas'],
      ['driver_accept_delivery', 'Aceitar entrega'],
      ['driver_start_route', 'Iniciar rota'],
      ['driver_finish_delivery', 'Finalizar entrega'],
      ['driver_receive_payment', 'Receber pagamento'],
      ['delivery_areas_manage', 'Gerenciar áreas de entrega'],
      ['delivery_drivers_manage', 'Gerenciar motoboys'],
    ],
  },
  {
    id: 'orders',
    label: 'Pedidos e produção',
    description: 'Pedidos recebidos e acompanhamento da cozinha.',
    apps: ['popsystem', 'kds'],
    items: [
      ['orders_manage', 'Gerenciar pedidos'],
      ['kds_access', 'Acessar KDS'],
    ],
  },
  {
    id: 'finance',
    label: 'Financeiro',
    description: 'Visão financeira, despesas, caixa e relatórios.',
    apps: ['finance', 'popsystem', 'administration'],
    items: [
      ['financial_view', 'Ver financeiro'],
      ['expenses_manage', 'Gerenciar contas a pagar'],
      ['reports_view', 'Ver relatórios'],
    ],
  },
  {
    id: 'stock',
    label: 'Estoque',
    description: 'Produtos e movimentações de estoque.',
    apps: ['stock', 'popsystem', 'administration'],
    items: [['stock_manage', 'Gerenciar estoque']],
  },
  {
    id: 'settings',
    label: 'Configurações',
    description: 'Configurações gerais e administrativas da loja.',
    apps: ['administration', 'popsystem'],
    items: [['settings_manage', 'Gerenciar configurações']],
  },
] as const;

export const TIME_CLOCK_PUNCH_PERMISSIONS = ['clock_in', 'break_start', 'break_end', 'clock_out'] as const;

export const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  leave: 'Afastado',
  vacation: 'Férias',
  terminated: 'Desligado',
  calculating: 'Em apuração',
  review: 'Revisão',
  approved: 'Aprovado',
  generated_financial: 'Gerado no financeiro',
  paid: 'Pago',
  cancelled: 'Cancelado',
};

export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
