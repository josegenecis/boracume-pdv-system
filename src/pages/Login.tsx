import { useEffect, useState, useRef } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AuthForm from '@/components/auth/AuthForm';
import { debugLogger } from '@/utils/debugLogger';
import { getLocalOperatorSession, getOperatorPathForRequestedPath } from '@/services/operatorAuth';

const Login = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const authTab = new URLSearchParams(location.search).get('tab') === 'register' ? 'register' : 'login';
  const [redirecting, setRedirecting] = useState(false);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    try {
      const search = new URLSearchParams(location.search || '');
      const code = search.get('code') || '';
      const typeFromQuery = search.get('type') || '';
      const hash = window.location.hash || '';
      const isRecovery =
        typeFromQuery.toLowerCase() === 'recovery' ||
        /type=recovery/i.test(hash) ||
        /recovery/i.test(hash) ||
        (code && /recovery/i.test(location.search || ''));
      if (isRecovery) {
        navigate(`/reset-password${location.search || ''}${hash || ''}`, { replace: true });
      }
    } catch {}
  }, [location.search, navigate]);

  // Obter destino do redirecionamento
  const requestedPathname = location.state?.from?.pathname || '/dashboard';
  const requestedSearch = location.state?.from?.search || '';
  const requestedFrom = `${requestedPathname}${requestedSearch}`;
  // Convites de loja precisam terminar o aceite antes da identificação do
  // operador. Passar essa rota pelo resolvedor de operador descartava o token.
  const from = requestedPathname === '/lojas/convite'
    ? requestedFrom
    : getOperatorPathForRequestedPath(getLocalOperatorSession(), requestedFrom);

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

  // A verificação inicial da sessão nunca deve esconder o formulário. Em
  // navegadores com várias abas, o lock do Auth pode levar alguns segundos.
  if (redirecting) {
    console.log('⏳ [LOGIN] Exibindo spinner:', { isLoading, redirecting });
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <span className="mx-auto mb-4 block h-2.5 w-2.5 animate-pulse rounded-full bg-[#25d366]" />
          <p className="text-gray-600 text-sm">
            Abrindo seu painel…
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
    <div className="min-h-screen flex items-center justify-center bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {authTab === 'register' ? 'Crie sua conta' : 'Entre na sua conta'}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {authTab === 'register'
              ? 'Comece agora com o cadastro oficial do PopSystem'
              : 'Acesse o painel do seu restaurante'}
          </p>
        </div>
        <AuthForm key={authTab} defaultTab={authTab} />
      </div>
    </div>
  );
};

export default Login;
