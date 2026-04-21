import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { formatCpf, loadWaiterWebSession, loginWaiterWeb } from '@/services/waiterWebClient';
import { ArrowRight, CreditCard, Eye, EyeOff, Lock } from 'lucide-react';

const BRAND_WORDMARK = '/waiter/logo-boracume.png';

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
        description: 'Login realizado com sucesso.',
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
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#003223] p-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#FF6400]/20 border-t-[#FF6400]" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#003223] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-[430px] flex-col justify-between">
        <div className="space-y-8">
          <div className="space-y-5 pt-3 text-center">
            <img src={BRAND_WORDMARK} alt="BoraCumê" className="mx-auto h-24 w-auto object-contain" />

            <div className="mx-auto inline-flex rounded-2xl bg-white/12 px-5 py-2 text-sm font-medium tracking-[0.18em] text-white/85">
              APP WEB GARÇOM
            </div>

            <div className="space-y-3">
              <p className="text-[1.65rem] font-light leading-tight text-white/90">Opere mesas e comandas</p>
              <h1 className="text-[2.25rem] font-semibold leading-tight text-white">Entre com CPF e senha</h1>
            </div>
          </div>

          <div className="rounded-[34px] border-2 border-[#FF6400] bg-[#EEF2EC] px-6 py-7 text-slate-900 shadow-[0_32px_90px_-60px_rgba(0,0,0,0.75)]">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="cpf" className="text-sm font-bold text-[#0B4A36]">
                  CPF
                </Label>
                <div className="relative">
                  <CreditCard className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="cpf"
                    inputMode="numeric"
                    autoFocus
                    value={cpf}
                    onChange={(event) => setCpf(formatCpf(event.target.value))}
                    className="h-14 rounded-full border-2 border-[#8CC850] bg-white pl-12 text-lg shadow-none"
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-bold text-[#0B4A36]">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-14 rounded-full border-2 border-[#8CC850] bg-white pl-12 pr-12 text-lg shadow-none"
                    placeholder="Digite sua senha"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full text-[#0B4A36] hover:bg-transparent hover:text-[#0B4A36]"
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

              <Button
                type="submit"
                className="h-14 w-full rounded-full bg-[#FF6400] text-lg font-semibold text-white hover:bg-[#e55a00]"
                disabled={loading || cpf.replace(/\D/g, '').length !== 11 || !password}
              >
                {loading ? (
                  'Entrando...'
                ) : (
                  <>
                    Entrar no App Garçom
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>

        <div className="pb-2 pt-8 text-center text-sm text-white/75">boracume.com</div>
      </div>
    </div>
  );
};

export default WaiterLogin;
