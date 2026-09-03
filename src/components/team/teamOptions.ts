import type { EmployeeApp, EmployeeRole } from '@/lib/team/types';

export const ROLE_OPTIONS: Array<{ value: EmployeeRole; label: string }> = [
  { value: 'administrator', label: 'Administrador' }, { value: 'manager', label: 'Gerente' },
  { value: 'cashier', label: 'Caixa' }, { value: 'waiter', label: 'Garçom' },
  { value: 'kitchen', label: 'Cozinha' }, { value: 'driver', label: 'Motoboy' },
  { value: 'stockkeeper', label: 'Estoquista' }, { value: 'finance', label: 'Financeiro' },
  { value: 'hr', label: 'RH' }, { value: 'custom', label: 'Personalizado' },
];

export const APP_OPTIONS: Array<{ value: EmployeeApp; label: string; description: string }> = [
  { value: 'popsystem', label: 'Acesso ao PopSystem', description: 'Painel e módulos permitidos' },
  { value: 'pdv', label: 'Acesso ao PDV', description: 'Vendas e caixa' },
  { value: 'waiter', label: 'App Garçom', description: 'Mesas e pedidos' },
  { value: 'driver', label: 'App Motoboy', description: 'Entregas e rotas' },
  { value: 'time_clock', label: 'App Ponto', description: 'Registro de jornada' },
  { value: 'kds', label: 'KDS', description: 'Produção e cozinha' },
  { value: 'finance', label: 'Financeiro', description: 'Caixa e relatórios autorizados' },
  { value: 'stock', label: 'Estoque', description: 'Itens e movimentações' },
  { value: 'administration', label: 'Administração', description: 'Configurações administrativas' },
];

export const PERMISSION_GROUPS = [
  { label: 'Equipe e dados sensíveis', items: [
    ['users_manage', 'Cadastrar e editar colaboradores'], ['compensation_view', 'Ver salários e dados bancários'],
    ['compensation_manage', 'Alterar salários e remuneração'], ['payroll_view', 'Ver fechamento mensal'],
    ['payroll_manage', 'Calcular e ajustar fechamento'], ['payroll_approve', 'Aprovar fechamento'],
    ['payroll_reopen', 'Reabrir fechamento'], ['commission_manage', 'Gerenciar comissões'], ['advance_manage', 'Registrar adiantamentos'],
  ] },
  { label: 'Ponto e jornada', items: [
    ['timeclock_manage', 'Administrar controle de ponto'], ['timeclock_correct', 'Corrigir ponto com auditoria'],
    ['schedule_manage', 'Gerenciar escalas e folgas'], ['clock_in', 'Registrar entrada'], ['break_start', 'Iniciar intervalo'],
    ['break_end', 'Finalizar intervalo'], ['clock_out', 'Registrar saída'],
  ] },
  { label: 'Garçom e PDV', items: [
    ['tables_access', 'Abrir mesa'], ['waiter_order_create', 'Lançar pedido'], ['table_transfer', 'Transferir mesa'],
    ['pos_discount', 'Aplicar desconto'], ['pos_cancel_item', 'Cancelar item'], ['table_close', 'Fechar conta'],
    ['payment_receive', 'Receber pagamento'], ['pos_access', 'Acessar PDV'], ['pos_open_close', 'Abrir e fechar caixa'],
  ] },
  { label: 'Motoboy', items: [
    ['driver_view_assignments', 'Ver entregas atribuídas'], ['driver_accept_delivery', 'Aceitar entrega'],
    ['driver_start_route', 'Iniciar rota'], ['driver_finish_delivery', 'Finalizar entrega'], ['driver_receive_payment', 'Receber pagamento'],
  ] },
  { label: 'Operação geral', items: [
    ['orders_manage', 'Gerenciar pedidos'], ['kds_access', 'Acessar KDS'], ['stock_manage', 'Gerenciar estoque'],
    ['financial_view', 'Ver financeiro'], ['expenses_manage', 'Gerenciar contas a pagar'], ['reports_view', 'Ver relatórios'],
    ['delivery_areas_manage', 'Áreas de entrega'], ['delivery_drivers_manage', 'Gerenciar motoboys'], ['settings_manage', 'Configurações'],
  ] },
] as const;

export const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo', leave: 'Afastado', vacation: 'Férias', terminated: 'Desligado',
  calculating: 'Em apuração', review: 'Revisão', approved: 'Aprovado',
  generated_financial: 'Gerado no financeiro', paid: 'Pago', cancelled: 'Cancelado',
};

export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
