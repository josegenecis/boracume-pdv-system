import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface RouteGuardProps {
  requireAuth?: boolean;
}

const RouteGuard: React.FC<RouteGuardProps> = ({ requireAuth = true }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-boracume-orange" />
      </div>
    );
  }

  // If it requires auth and the user isn't logged in, redirect to login
  if (requireAuth && !user) {
    return <Navigate to="/login" replace />;
  }

  // If it doesn't require auth and the user is logged in, redirect to dashboard
  if (!requireAuth && user) {
    return <Navigate to="/dashboard" replace />;
  }

  // Otherwise, render the children
  return <Outlet />;
};

export default RouteGuard;
