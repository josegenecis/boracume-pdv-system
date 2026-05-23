import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { clearLocalOperatorSession, getLocalOperatorSession } from '@/services/operatorAuth';

type OperatorGateProps = {
  children: React.ReactNode;
};

export const OperatorGate: React.FC<OperatorGateProps> = ({ children }) => {
  const location = useLocation();
  const { user } = useAuth();
  const session = getLocalOperatorSession();

  if (session?.user_id && user?.id && session.user_id !== user.id) {
    clearLocalOperatorSession();
    return <Navigate to="/operator-login" state={{ from: location }} replace />;
  }

  if (!session) {
    return <Navigate to="/operator-login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
