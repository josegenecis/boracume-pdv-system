import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';
import { canAccessOperatorArea, getDefaultOperatorPath, getLocalOperatorSession, OperatorArea } from '@/services/operatorAuth';

type OperatorRouteProps = {
  area: OperatorArea;
  children: React.ReactNode;
};

export const OperatorRoute: React.FC<OperatorRouteProps> = ({ area, children }) => {
  const location = useLocation();
  const session = getLocalOperatorSession();

  if (!canAccessOperatorArea(session, area)) {
    const fallbackPath = getDefaultOperatorPath(session);
    if (fallbackPath !== '/operator-login' && fallbackPath !== location.pathname) {
      return <Navigate to={fallbackPath} replace />;
    }

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-amber-950">Acesso bloqueado</h2>
          <p className="mt-2 text-sm text-amber-900">
            Este operador não tem permissão para acessar esta área. O administrador precisa liberar essa tela em Usuários e Equipe.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
