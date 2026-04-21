import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { formatCpf, loadWaiterWebSession, loginWaiterWeb } from '@/services/waiterWebClient';
import { ArrowRight, Eye, EyeOff, Lock, ScanLine, UserRound, UtensilsCrossed } from 'lucide-react';

const WaiterLogin = () => {
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    loadWaiterWebSession()
      .then((session) => {
        if (mounted && session) {
          navigate('/waiter-dashboard', { replace: true });
        }
      })
      .finally(() => {
        if (mounted) setCheckingSession(false);
      });

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cpf || !password) return;

    setLoading(true);
    setError('');

    try {
      const session = await loginWaiterWeb(cpf, password);
      toast({
        title: `Bem-vindo, ${session.profile.name}!`,
        description: 'Seu acesso ao salao foi liberado.',
      });
      navigate('/waiter-dashboard', { replace: true });
    } catch (loginError: any) {
      const message = String(loginError?.message || 'Nao foi possivel concluir o login.');
      setError(message);
      toast({
        title: 'Erro no login',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#08281f] p-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#A4D65E]/15 border-t-[#FF6400]" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,#0D4A36_0%,#082F23_45%,#071F18_100%)] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-6xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="hidden rounded-[36px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_35px_90px_-50px_rgba(0,0,0,0.7)] backdrop-blur-sm lg:block">
            <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.26em] text-white/70">
              BoraCume Pro Salao
            </div>

            <div className="mt-8 max-w-xl space-y-4">
              <div className="text-sm font-medium uppercase tracking-[0.2em] text-[#A4D65E]">App do Garcom Web</div>
              <h1 className="text-3xl font-semibold leading-tight text-white sm:text-5xl">
                Atendimento agil, comandas multiplas e cozinha conectada.
              </h1>
              <p className="text-sm leading-7 text-white/70 sm:text-base">
                Entre com o login do garcom para operar mesas, dividir contas, lancar pedidos com variacoes e acompanhar o
                salao em tempo real.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[28px] border border-white/10 bg-white/10 p-4">
                <UtensilsCrossed className="h-5 w-5 text-[#A4D65E]" />
                <div className="mt-4 text-lg font-semibold">Mesas vivas</div>
                <p className="mt-2 text-sm leading-6 text-white/70">Grid rapido com status de salao, comandas e totais.</p>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-white/10 p-4">
                <ScanLine className="h-5 w-5 text-[#A4D65E]" />
                <div className="mt-4 text-lg font-semibold">Poucos cliques</div>
                <p className="mt-2 text-sm leading-6 text-white/70">Fluxo pensado para celular e operacao de alto giro.</p>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-white/10 p-4">
                <ArrowRight className="h-5 w-5 text-[#A4D65E]" />
                <div className="mt-4 text-lg font-semibold">Cozinha alinhada</div>
                <p className="mt-2 text-sm leading-6 text-white/70">Pedido enviado com mesa, comanda, adicionais e observacoes.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[36px] border border-[#D7E2D3] bg-[#F4F7F2] p-6 shadow-[0_35px_90px_-50px_rgba(0,0,0,0.35)]">
            <div className="mb-6 rounded-[28px] bg-[#0B3C2D] px-5 py-5 text-white lg:hidden">
              <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/75">
                App do Garcom Web
              </div>
              <h1 className="mt-4 text-2xl font-semibold leading-tight">Mesas, comandas e cozinha no ritmo do salao.</h1>
              <p className="mt-3 text-sm leading-6 text-white/75">
                Login rapido para operar no celular, tablet ou computador, com a mesma base do restaurante.
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium uppercase tracking-[0.18em] text-[#0B4A36]">Acesso do garcom</div>
              <h2 className="text-2xl font-semibold text-[#082F23] sm:text-3xl">Entrar no salao</h2>
              <p className="text-sm leading-6 text-slate-500">
                Use o CPF e a senha liberados na equipe do restaurante para acessar o app do garcom web.
              </p>
            </div>

            <form onSubmit={handleLogin} className="mt-8 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cpf" className="text-sm font-semibold text-[#082F23]">
                  CPF
                </Label>
                <div className="relative">
                  <UserRound className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="cpf"
                    inputMode="numeric"
                    autoFocus
                    value={cpf}
                    onChange={(event) => setCpf(formatCpf(event.target.value))}
                    className="h-14 rounded-2xl border-[#D7E2D3] bg-white pl-12 text-base shadow-none focus-visible:ring-[#A4D65E]"
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold text-[#082F23]">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-14 rounded-2xl border-[#D7E2D3] bg-white pl-12 pr-12 text-base shadow-none focus-visible:ring-[#A4D65E]"
                    placeholder="Digite sua senha"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full text-[#0B4A36] hover:bg-transparent hover:text-[#0B4A36]"
                    onClick={() => setShowPassword((current) => !current)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </Button>
                </div>
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                  {error}
                </div>
              ) : null}

              <div className="rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-slate-500">
                O acesso do garcom e controlado pela equipe do restaurante. Se o login nao entrar, revise permissao e senha
                do usuario no painel principal.
              </div>

              <Button
                type="submit"
                className="h-14 w-full rounded-2xl bg-[#FF6400] text-base font-semibold text-white hover:bg-[#E25A00]"
                disabled={loading || cpf.replace(/\D/g, '').length !== 11 || !password}
              >
                {loading ? (
                  'Entrando...'
                ) : (
                  <>
                    Entrar no App do Garcom
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaiterLogin;
