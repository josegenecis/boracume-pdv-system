
import React, { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RouteGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

const RouteGuard: React.FC<RouteGuardProps> = ({ children, requireAuth = true }) => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect authenticated users to dashboard after login
    if (!requireAuth && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, requireAuth, navigate]);

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-boracume-light">
        <Loader2 className="h-8 w-8 animate-spin text-boracume-orange mb-4" />
        <p className="text-sm text-gray-600">Carregando...</p>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          <AlertCircle className="h-4 w-4 mr-2" />
          Recarregar página
        </Button>
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
  return <>{children}</>;
};

export default RouteGuard;
