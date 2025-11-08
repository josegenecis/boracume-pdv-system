import { useEffect, useState, useRef } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AuthForm from '@/components/auth/AuthForm';
import { Loader2 } from 'lucide-react';
import { debugLogger } from '@/utils/debugLogger';

const Login = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [redirecting, setRedirecting] = useState(false);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Obter destino do redirecionamento
  const from = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    isMountedRef.current = true;

    debugLogger.auth('login_page_state', {
      hasUser: !!user,
      isLoading,
      redirecting,
      from
    });

    // Se não está carregando e tem usuário, redirecionar
    if (!isLoading && user && !redirecting) {
      console.log('🔄 [LOGIN] Usuário logado - iniciando redirecionamento para:', from);
      setRedirecting(true);

      // Debounce no redirecionamento para evitar loops
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }

      redirectTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          console.log('✅ [LOGIN] Executando redirecionamento para:', from);
          navigate(from, { replace: true });
        }
      }, 50); // Delay REDUZIDO para 50ms para evitar race conditions
    }

    // Se não tem usuário e não está carregando, resetar estado de redirecionamento
    if (!isLoading && !user && redirecting) {
      console.log('🔄 [LOGIN] Resetando estado de redirecionamento');
      setRedirecting(false);
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    }

    return () => {
      isMountedRef.current = false;
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    };
  }, [user, isLoading, navigate, from, redirecting]);

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  // Se está carregando ou redirecionando, mostrar spinner
  if (isLoading || redirecting) {
    console.log('⏳ [LOGIN] Exibindo spinner:', { isLoading, redirecting });
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto mb-4" />
          <p className="text-gray-600 text-sm">
            {redirecting ? 'Redirecionando...' : 'Verificando autenticação...'}
          </p>
        </div>
      </div>
    );
  }

  // Se tem usuário mas não está redirecionando ainda, usar Navigate como fallback
  if (user && !redirecting) {
    console.log('🔄 [LOGIN] Fallback - redirecionamento direto para:', from);
    return <Navigate to={from} replace />;
  }

  // Renderizar formulário de login
  console.log('📝 [LOGIN] Renderizando formulário de login');
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Entre na sua conta
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Acesse o painel do seu restaurante
          </p>
        </div>
        <AuthForm />
      </div>
    </div>
  );
};

export default Login;