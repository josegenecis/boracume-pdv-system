export type OperatorSession = {
  id: string
  name: string
  role?: 'admin' | 'cashier' | string
  permissions?: Record<string, any>
  user_id?: string
}

export const getLocalOperatorSession = (): OperatorSession | null => {
  try {
    const waiter = localStorage.getItem('waiter_session')
    if (waiter) return JSON.parse(waiter)
    const op = localStorage.getItem('operator_session')
    if (op) return JSON.parse(op)
    return null
  } catch {
    return null
  }
}

export const clearLocalOperatorSession = () => {
  try {
    localStorage.removeItem('operator_session')
    localStorage.removeItem('waiter_session')
  } catch {}
}

export const isAdminOperator = (session: OperatorSession | null): boolean => {
  if (!session) return false
  if (session.role === 'admin') return true
  if (session.permissions?.admin === true) return true
  return false
}

export const canCancelOrder = (session: OperatorSession | null): boolean => {
  if (!session) return false
  if (isAdminOperator(session)) return true
  return session.permissions?.can_cancel_order === true || session.permissions?.orders_manage === true
}

export const isCashOperator = (session: OperatorSession | null): boolean => {
  if (!session) return false
  if (isAdminOperator(session)) return true
  return session.permissions?.can_open_cash === true || 
         session.permissions?.can_close_cash === true ||
         session.permissions?.pos_open_close === true
}

export const canGiveDiscount = (session: OperatorSession | null): boolean => {
  if (!session) return false
  if (isAdminOperator(session)) return true
  return session.permissions?.pos_discount === true
}

export const canManageMenu = (session: OperatorSession | null): boolean => {
  if (!session) return false
  if (isAdminOperator(session)) return true
  return session.permissions?.menu_manage === true
}

export const canViewFinancial = (session: OperatorSession | null): boolean => {
  if (!session) return false
  if (isAdminOperator(session)) return true
  return session.permissions?.financial_view === true
}

export const canManageSettings = (session: OperatorSession | null): boolean => {
  if (!session) return false
  if (isAdminOperator(session)) return true
  return session.permissions?.settings_manage === true
}

export const canManageUsers = (session: OperatorSession | null): boolean => {
  if (!session) return false
  if (isAdminOperator(session)) return true
  return session.permissions?.users_manage === true
}

export type OperatorArea =
  | 'dashboard'
  | 'pdv'
  | 'tables'
  | 'orders'
  | 'kds'
  | 'products'
  | 'stock'
  | 'finance'
  | 'reports'
  | 'marketing'
  | 'settings'
  | 'team'
  | 'delivery'
  | 'desktop'
  | 'agent'
  | 'security'
  | 'nfce'
  | 'pix'

export const canAccessOperatorArea = (session: OperatorSession | null, area?: OperatorArea): boolean => {
  if (!area) return true
  if (!session) return false
  if (isAdminOperator(session)) return true
  const permissions = session.permissions || {}

  const areaPermissions: Record<OperatorArea, string[]> = {
    dashboard: ['dashboard_view'],
    pdv: ['pos_access'],
    tables: ['tables_access', 'pos_access', 'waiter_app'],
    orders: ['orders_manage'],
    kds: ['kds_access', 'orders_manage'],
    products: ['menu_manage'],
    stock: ['stock_manage'],
    finance: ['financial_view'],
    reports: ['reports_view', 'financial_view'],
    marketing: ['marketing_manage'],
    settings: ['settings_manage'],
    team: ['users_manage'],
    delivery: ['delivery_manage', 'settings_manage'],
    desktop: ['settings_manage'],
    agent: ['settings_manage'],
    security: ['settings_manage'],
    nfce: ['fiscal_manage', 'settings_manage'],
    pix: ['financial_view', 'settings_manage'],
  }

  return (areaPermissions[area] || []).some((permission) => permissions[permission] === true)
}

const defaultOperatorRoutes: Array<{ area: OperatorArea; path: string }> = [
  { area: 'dashboard', path: '/dashboard' },
  { area: 'pdv', path: '/pdv' },
  { area: 'tables', path: '/mesas' },
  { area: 'orders', path: '/pedidos' },
  { area: 'kds', path: '/cozinha' },
  { area: 'products', path: '/produtos' },
  { area: 'stock', path: '/estoque' },
  { area: 'finance', path: '/financeiro' },
  { area: 'reports', path: '/relatorios' },
  { area: 'marketing', path: '/marketing' },
  { area: 'settings', path: '/configuracoes' },
  { area: 'team', path: '/garcons' },
]

const pathOperatorAreas: Array<{ area: OperatorArea; paths: string[] }> = [
  { area: 'dashboard', paths: ['/dashboard'] },
  { area: 'pdv', paths: ['/pdv'] },
  { area: 'tables', paths: ['/mesas'] },
  { area: 'orders', paths: ['/pedidos', '/orders'] },
  { area: 'kds', paths: ['/cozinha'] },
  { area: 'products', paths: ['/produtos', '/cardapio'] },
  { area: 'stock', paths: ['/estoque', '/inteligencia/cmv', '/inteligencia/curva-abc'] },
  { area: 'finance', paths: ['/financeiro', '/caixa', '/despesas'] },
  { area: 'reports', paths: ['/relatorios'] },
  { area: 'marketing', paths: ['/marketing', '/whatsapp-bot', '/loyalty'] },
  { area: 'settings', paths: ['/configuracoes'] },
  { area: 'team', paths: ['/garcons', '/ponto'] },
  { area: 'delivery', paths: ['/bairros-entrega', '/entregadores', '/motoboys'] },
  { area: 'desktop', paths: ['/desktop', '/downloads'] },
  { area: 'agent', paths: ['/agente'] },
  { area: 'security', paths: ['/security'] },
  { area: 'nfce', paths: ['/nfce'] },
  { area: 'pix', paths: ['/pix', '/pagamentos'] },
]

export const getOperatorAreaForPath = (pathname?: string): OperatorArea | null => {
  const path = String(pathname || '').split('?')[0]
  if (!path) return null
  return pathOperatorAreas.find((item) =>
    item.paths.some((candidate) => path === candidate || path.startsWith(`${candidate}/`))
  )?.area || null
}

export const getDefaultOperatorPath = (session: OperatorSession | null): string => {
  if (!session) return '/operator-login'
  if (isAdminOperator(session)) return '/dashboard'
  return defaultOperatorRoutes.find((route) => canAccessOperatorArea(session, route.area))?.path || '/operator-login'
}

export const getOperatorPathForRequestedPath = (session: OperatorSession | null, requestedPath?: string): string => {
  if (!session) return '/operator-login'
  const requested = String(requestedPath || '').trim()
  const requestedArea = getOperatorAreaForPath(requested)
  if (requested && requested !== '/operator-login' && (!requestedArea || canAccessOperatorArea(session, requestedArea))) {
    return requested
  }
  return getDefaultOperatorPath(session)
}
