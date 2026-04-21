import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
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
    <div className="h-[100svh] overflow-hidden bg-[radial-gradient(circle_at_top,#0B5138_0%,#083927_38%,#072D20_100%)] px-4 py-4 text-white">
      <div className="mx-auto flex h-full max-w-[390px] flex-col items-center justify-center gap-4">
        <div className="w-full text-center">
          <img
            src="/waiter/logo-boracume.png"
            alt="BoraCume"
            className="mx-auto h-20 w-auto object-contain drop-shadow-[0_14px_26px_rgba(0,0,0,0.34)]"
          />
          <div className="mt-3 inline-flex rounded-full bg-white/10 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-white/80">
            App web Garcom
          </div>
          <h1 className="mt-3 text-[1.65rem] font-semibold leading-tight text-white">Opere mesas e comandas</h1>
          <p className="mt-2 text-xs leading-5 text-white/75">
            Entre com CPF e senha para atender o salao do restaurante direto no celular.
          </p>
        </div>

        <div className="w-full rounded-[28px] border border-[#F17B26] bg-[#EEF3EE] p-4 shadow-[0_24px_60px_-35px_rgba(0,0,0,0.65)]">
          <form onSubmit={handleLogin} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cpf" className="text-sm font-semibold text-[#0B4A36]">
                CPF
              </Label>
              <div className="relative">
                <UserRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="cpf"
                  inputMode="numeric"
                  autoFocus
                  value={cpf}
                  onChange={(event) => setCpf(formatCpf(event.target.value))}
                  className="h-12 rounded-[20px] border-2 border-[#96CD4B] bg-white pl-11 text-base text-slate-900 shadow-none focus-visible:ring-0"
                  placeholder="000.000.000-00"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-semibold text-[#0B4A36]">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 rounded-[20px] border-2 border-[#96CD4B] bg-white pl-11 pr-11 text-base text-slate-900 shadow-none focus-visible:ring-0"
                  placeholder="Digite sua senha"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full text-[#0B4A36] hover:bg-transparent hover:text-[#0B4A36]"
                  onClick={() => setShowPassword((current) => !current)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </Button>
              </div>
            </div>

            {error ? (
              <div className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
                {error}
              </div>
            ) : null}

            <div className="rounded-[18px] bg-white px-4 py-3 text-xs leading-5 text-slate-500">
              O login do garcom e liberado pelo restaurante no cadastro da equipe.
            </div>

            <Button
              type="submit"
              className="h-12 w-full rounded-full bg-[#FF6400] text-base font-medium text-white hover:bg-[#E25A00]"
              disabled={loading || cpf.replace(/\D/g, '').length !== 11 || !password}
            >
              {loading ? (
                'Entrando...'
              ) : (
                <>
                  Entrar no App Garcom
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>
        </div>

        <div className="text-xs tracking-[0.04em] text-white/55">boracume.com</div>
      </div>
    </div>
  );
};

export default WaiterLogin;
