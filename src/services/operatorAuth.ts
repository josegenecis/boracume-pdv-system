export type OperatorSession = {
  id: string
  name: string
  role?: 'admin' | 'cashier' | string
  permissions?: Record<string, any>
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

export const isAdminOperator = (session: OperatorSession | null): boolean => {
  if (!session) return false
  if (session.role === 'admin') return true
  if (session.permissions?.admin === true) return true
  return false
}

export const canCancelOrder = (session: OperatorSession | null): boolean => {
  if (!session) return false
  if (isAdminOperator(session)) return true
  return session.permissions?.can_cancel_order === true
}

export const isCashOperator = (session: OperatorSession | null): boolean => {
  if (!session) return false
  if (isAdminOperator(session)) return true
  return session.permissions?.can_open_cash === true || session.permissions?.can_close_cash === true
}
