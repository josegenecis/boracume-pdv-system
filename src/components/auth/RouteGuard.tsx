import { useEffect, useState, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface RouteGuardProps {
  children: React.ReactNode;
}

export const RouteGuard = ({ children }: RouteGuardProps) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    
    console.log('🛡️ [ROUTE GUARD] Estado atual:', {
      path: location.pathname,
      isLoading,
      hasUser: !!user,
      shouldRedirect
    });

    // Se não está carregando e não tem usuário, redirecionar
    if (!isLoading && !user) {
      console.log('🔄 [ROUTE GUARD] Redirecionando para login - sem usuário');
      setShouldRedirect(true);
      return;
    }

    // Se tem usuário, não redirecionar
    if (user) {
      console.log('✅ [ROUTE GUARD] Usuário autenticado - permitindo acesso');
      setShouldRedirect(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Se está carregando, aguardar com timeout de segurança
    if (isLoading) {
      console.log('⏳ [ROUTE GUARD] Aguardando autenticação...');
      
      // Timeout de segurança de 3 segundos (REDUZIDO)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && !user) {
          console.log('⏰ [ROUTE GUARD] Timeout (3s) - redirecionando para login');
          setShouldRedirect(true);
        }
      }, 3000);
    }

    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [user, isLoading, location.pathname]);

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Se deve redirecionar, fazer o redirect
  if (shouldRedirect) {
    console.log('🔄 [ROUTE GUARD] Executando redirecionamento para /login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Se está carregando, mostrar spinner
  if (isLoading) {
    console.log('⏳ [ROUTE GUARD] Exibindo spinner de carregamento');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto mb-4" />
          <p className="text-gray-600 text-sm">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // Se tem usuário, renderizar children
  if (user) {
    console.log('✅ [ROUTE GUARD] Renderizando conteúdo protegido');
    return <>{children}</>;
  }

  // Fallback - não deveria chegar aqui
  console.warn('⚠️ [ROUTE GUARD] Estado inesperado - redirecionando por segurança');
  return <Navigate to="/login" state={{ from: location }} replace />;
};