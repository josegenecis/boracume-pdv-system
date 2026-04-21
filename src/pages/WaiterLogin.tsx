import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { formatCpf, loadWaiterWebSession, loginWaiterWeb } from '@/services/waiterWebClient';
import { CreditCard, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';

const APP_ARTWORK = '/waiter/app-garcom.png';
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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
    } catch (error: any) {
      setError(error.message);
      toast({
        title: 'Erro no login',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#003223] p-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#FF6400]/20 border-t-[#FF6400]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#003223] px-4 py-6">
      <div className="mx-auto flex min-h-screen max-w-lg items-center">
        <div className="w-full space-y-6">
          <div className="relative overflow-hidden rounded-[36px] bg-[#003223] px-6 py-8 text-center text-white">
            <div className="absolute -right-4 top-0 h-44 w-44 rounded-full bg-[#8CC850]/15 blur-2xl" />
            <div className="absolute -left-6 bottom-2 h-28 w-28 rounded-full bg-[#FF6400]/15 blur-xl" />

            <div className="relative z-10 flex flex-col items-center gap-3">
              <img src={APP_ARTWORK} alt="App Garçom BoraCumê" className="h-40 w-40 rounded-[36px] object-contain shadow-2xl" />
              <img src={BRAND_WORDMARK} alt="BoraCumê" className="h-20 w-auto object-contain" />
              <div className="rounded-full border border-white/15 bg-white/10 px-4 py-1 text-xs font-extrabold uppercase tracking-[0.28em] text-white/90">
                App Garçom Web
              </div>
              <h1 className="text-xl font-black text-white">Operações de mesas e comandas</h1>
              <p className="max-w-sm text-sm leading-6 text-white/80">
                Entre com o CPF e a senha liberados em Configurações &gt; Equipe para operar o salão no navegador.
              </p>
            </div>
          </div>

          <Card className="w-full rounded-[32px] border border-white/15 bg-white/95 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.45)] backdrop-blur">
            <CardHeader className="space-y-2 px-7 pt-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF1E8]">
                <CreditCard className="h-6 w-6 text-[#FF6400]" />
              </div>
              <div>
                <CardTitle className="text-3xl font-black text-[#003223]">Acesso do Garçom</CardTitle>
                <CardDescription className="mt-2 text-base text-slate-500">
                  O mesmo fluxo do app Android, agora também no navegador.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="px-7 pb-8">
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="cpf" className="text-sm font-semibold text-slate-700">CPF</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="cpf"
                      inputMode="numeric"
                      autoFocus
                      value={cpf}
                      onChange={(e) => setCpf(formatCpf(e.target.value))}
                      className="h-12 rounded-2xl border-slate-200 bg-slate-50 pl-11 text-base"
                      placeholder="000.000.000-00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold text-slate-700">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 rounded-2xl border-slate-200 bg-white pl-11 pr-11 text-base"
                      placeholder="Digite sua senha"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 h-10 w-10 -translate-y-1/2 rounded-xl"
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

                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  O cadastro do CPF e da senha é feito na gestão de equipe do restaurante.
                </div>

                <Button
                  type="submit"
                  className="h-12 w-full rounded-full bg-[#FF6400] text-base font-bold hover:bg-[#e55a00]"
                  disabled={loading || cpf.replace(/\D/g, '').length !== 11 || !password}
                >
                  {loading ? 'Entrando...' : (
                    <>
                      Entrar no App Garçom
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WaiterLogin;
