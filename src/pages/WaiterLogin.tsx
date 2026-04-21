import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { formatCpf, loadWaiterWebSession, loginWaiterWeb } from '@/services/waiterWebClient';
import { ArrowRight, Eye, EyeOff, Lock, UserRound } from 'lucide-react';

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
        description: 'Acesso ao salao liberado.',
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
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#082f23] p-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#FF6400]/20 border-t-[#FF6400]" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,#0e4a36_0%,#082f23_42%,#06251b_100%)] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-[430px] items-center">
        <div className="w-full rounded-[36px] border border-white/10 bg-white/[0.05] p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.75)] backdrop-blur-sm">
          <div className="rounded-[30px] bg-[#082f23] px-6 pb-6 pt-8">
            <div className="mx-auto inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/75">
              BoraCumê Garçom Web
            </div>

            <div className="mt-6 space-y-3 text-left">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#8CC850]">Inicio de sessao</p>
              <h1 className="text-[2rem] font-semibold leading-tight text-white sm:text-[2.35rem]">
                Operacao de mesas e comandas
              </h1>
              <p className="max-w-sm text-sm leading-6 text-white/70">
                Entre com o CPF e a senha liberados para operar o salao do restaurante no navegador.
              </p>
            </div>

            <div className="mt-7 rounded-[30px] bg-[#F3F6F2] p-5 text-slate-900">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cpf" className="text-sm font-semibold text-[#0B4A36]">
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
                      className="h-14 rounded-2xl border-[#D8E3D7] bg-white pl-12 text-base shadow-none focus-visible:ring-[#8CC850]"
                      placeholder="000.000.000-00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold text-[#0B4A36]">
                    Senha
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-14 rounded-2xl border-[#D8E3D7] bg-white pl-12 pr-12 text-base shadow-none focus-visible:ring-[#8CC850]"
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

                <div className="rounded-2xl bg-[#E9EFE8] px-4 py-3 text-sm leading-6 text-slate-600">
                  O acesso e controlado pelo cadastro da equipe do restaurante.
                </div>

                <Button
                  type="submit"
                  className="h-14 w-full rounded-2xl bg-[#FF6400] text-base font-semibold text-white hover:bg-[#E75B00]"
                  disabled={loading || cpf.replace(/\D/g, '').length !== 11 || !password}
                >
                  {loading ? (
                    'Entrando...'
                  ) : (
                    <>
                      Entrar no salao
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaiterLogin;
