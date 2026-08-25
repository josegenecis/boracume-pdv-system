import { useEffect, useState, useRef } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AuthForm from '@/components/auth/AuthForm';
import Logo from '@/components/Logo';
import { debugLogger } from '@/utils/debugLogger';
import { getLocalOperatorSession, getOperatorPathForRequestedPath } from '@/services/operatorAuth';
import { BadgeCheck, BarChart3, CheckCircle2, Sparkles } from 'lucide-react';

const creativeAsset = (fileName: string) =>
  `${import.meta.env.BASE_URL}CRIATIVOS/${encodeURIComponent(fileName)}`;

const loginVisuals = {
  mascot: creativeAsset('WhatsApp Image 2026-07-15 at 14.01.04.jpeg'),
  notebook: creativeAsset('mockup notebook.png'),
  totem: creativeAsset('TOTEM.png'),
};

const Login = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const authTab = new URLSearchParams(location.search).get('tab') === 'register' ? 'register' : 'login';
  const [activeAuthTab, setActiveAuthTab] = useState<'login' | 'register'>(authTab);
  const [redirecting, setRedirecting] = useState(false);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    setActiveAuthTab(authTab);
  }, [authTab]);

  useEffect(() => {
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

  const isRegistering = activeAuthTab === 'register';

  // Renderizar formulário de login
  console.log('📝 [LOGIN] Renderizando formulário de login');
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F2F5EF] px-3 py-3 font-sora sm:px-5 sm:py-5 lg:px-8 lg:py-6">
      <div className="pointer-events-none absolute -left-28 top-1/4 h-80 w-80 rounded-full bg-[#9BD14B]/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-[#FF6400]/10 blur-3xl" />

      <div className="relative mx-auto grid min-h-[calc(100vh-1.5rem)] w-full max-w-[1380px] overflow-hidden rounded-[30px] border border-white/80 bg-white shadow-[0_32px_100px_-50px_rgba(0,50,35,0.48)] sm:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[1.04fr_0.96fr] lg:rounded-[36px]">
        <section className="relative isolate flex min-h-[360px] flex-col overflow-hidden bg-[#063D2E] px-6 py-7 text-white sm:min-h-[420px] sm:px-9 sm:py-9 lg:min-h-[720px] lg:px-12 lg:py-11 xl:px-14">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_18%,rgba(164,214,94,0.24),transparent_29%),radial-gradient(circle_at_5%_86%,rgba(255,100,0,0.24),transparent_32%),linear-gradient(145deg,#063D2E_0%,#07543D_54%,#032A20_100%)]" />
          <div className="pointer-events-none absolute -right-20 top-20 -z-10 h-64 w-64 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-4 top-36 -z-10 h-40 w-40 rounded-full border border-white/10" />

          <div className="flex items-center justify-between gap-4">
            <Logo size="md" className="brightness-0 invert" theme="dark" />
            <div className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white/85 backdrop-blur sm:flex">
              <BadgeCheck className="h-4 w-4 text-[#A4D65E]" />
              Gestão completa em um só lugar
            </div>
          </div>

          <div className="mt-8 max-w-xl sm:mt-10 lg:mt-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#A4D65E]/30 bg-[#A4D65E]/10 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#C8F28B]">
              <Sparkles className="h-4 w-4" />
              Do pedido ao lucro
            </div>
            <h1 className="mt-5 max-w-lg text-3xl font-bold leading-[1.08] tracking-[-0.035em] sm:text-4xl lg:text-[44px]">
              Seu restaurante conectado, organizado e pronto para crescer.
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-white/72 sm:text-base sm:leading-7">
              PDV, delivery, financeiro e atendimento trabalhando juntos para você ganhar tempo e tomar decisões melhores.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-white/78 sm:text-sm lg:mt-7">
            <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#A4D65E]" /> Fácil de usar</span>
            <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#A4D65E]" /> Feito para restaurantes</span>
            <span className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-[#FF8A3D]" /> Gestão em tempo real</span>
          </div>

          <div className="relative mt-8 h-[205px] sm:h-[245px] lg:mt-auto lg:h-[270px] xl:h-[290px]" aria-hidden="true">
            <div className="absolute bottom-[-20%] left-[6%] w-[78%] overflow-hidden rounded-[24px] border border-white/20 bg-white shadow-[0_30px_70px_-28px_rgba(0,0,0,0.72)] sm:left-[8%] sm:w-[74%] lg:bottom-[-17%] lg:left-[5%] lg:w-[78%]">
              <img
                src={loginVisuals.notebook}
                alt=""
                className="block h-auto w-full object-contain"
                decoding="async"
              />
            </div>
            <div className="absolute -bottom-16 -right-5 hidden w-[25%] rotate-[4deg] overflow-hidden rounded-[24px] border border-white/25 bg-white shadow-[0_28px_60px_-24px_rgba(0,0,0,0.8)] sm:block lg:-right-4 lg:w-[26%]">
              <img
                src={loginVisuals.totem}
                alt=""
                className="block h-auto w-full object-contain"
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className="absolute -bottom-7 -left-2 h-28 w-24 overflow-hidden rounded-[26px] border-4 border-[#A4D65E] bg-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7)] sm:h-36 sm:w-28 lg:-left-4 lg:h-40 lg:w-32">
              <img
                src={loginVisuals.mascot}
                alt=""
                className="h-full w-full object-cover object-top"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </section>

        <section className="flex min-w-0 items-center bg-white px-5 py-9 sm:px-10 sm:py-12 lg:px-12 xl:px-16">
          <div className="mx-auto w-full max-w-[510px]">
            <div className="mb-7">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#EF6C20]">
                {isRegistering ? 'Comece agora' : 'Acesso administrativo'}
              </div>
              <h2 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-[#082F23] sm:text-[38px]">
                {isRegistering ? 'Crie sua conta' : 'Bem-vindo de volta'}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">
                {isRegistering
                  ? 'Cadastre seu restaurante e dê o primeiro passo para uma operação mais simples.'
                  : 'Entre com os dados da conta responsável pelo restaurante.'}
              </p>
            </div>

            <AuthForm
              key={authTab}
              defaultTab={authTab}
              embedded
              onTabChange={setActiveAuthTab}
            />

            <div className="mt-7 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-xs text-slate-400">
              <BadgeCheck className="h-4 w-4 text-[#6CA936]" />
              Seus dados são protegidos com acesso seguro.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Login;
