import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { formatCpf, loadWaiterWebSession, loginWaiterWeb } from '@/services/waiterWebClient';
import { CreditCard, Lock, ArrowRight, Eye, EyeOff, Sparkles, UtensilsCrossed, ShieldCheck } from 'lucide-react';

const WaiterLogin = () => {
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
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
    try {
      const session = await loginWaiterWeb(cpf, password);

      toast({
        title: `Bem-vindo, ${session.profile.name}!`,
        description: 'Login realizado com sucesso.',
      });

      navigate('/waiter-dashboard', { replace: true });
    } catch (error: any) {
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
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff4ea_0%,#fff_40%,#f8fafc_100%)] flex items-center justify-center p-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#FF6400]/20 border-t-[#FF6400]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff4ea_0%,#fff_40%,#f8fafc_100%)] p-4">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="hidden rounded-[32px] bg-[#003223] p-8 text-white shadow-[0_35px_80px_-45px_rgba(0,50,35,0.65)] lg:block">
            <div className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/90">
              BoraCumê Garçom Web
            </div>
            <h1 className="mt-6 text-5xl font-black leading-tight">
              Salão no navegador com cara de app de verdade.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/75">
              Login rápido por CPF e senha, mesa em tempo real, lançamento de itens, envio para produção e fechamento sem depender do Android.
            </p>
            <div className="mt-8 grid gap-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-3 text-lg font-semibold">
                  <UtensilsCrossed className="h-5 w-5 text-[#8CC850]" />
                  Fluxo focado no salão
                </div>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  Mesas, comandas, itens pendentes e pagamento organizados para poucos toques.
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-3 text-lg font-semibold">
                  <ShieldCheck className="h-5 w-5 text-[#FFB36E]" />
                  Acesso individual do garçom
                </div>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  Cada operador entra com CPF e senha, sem depender do login do dono do restaurante.
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-3 text-lg font-semibold">
                  <Sparkles className="h-5 w-5 text-[#D39BFF]" />
                  Experiência mais premium
                </div>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  Visual mais forte, leitura clara e operação preparada para tablet, notebook ou celular.
                </p>
              </div>
            </div>
          </div>

          <Card className="w-full rounded-[32px] border-0 bg-white/95 shadow-[0_35px_90px_-55px_rgba(15,23,42,0.45)] backdrop-blur">
            <CardHeader className="space-y-4 px-7 pt-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF1E8]">
                <CreditCard className="h-7 w-7 text-[#FF6400]" />
              </div>
              <div>
                <CardTitle className="text-3xl font-black text-[#003223]">Acesso do Garçom</CardTitle>
                <CardDescription className="mt-2 text-base text-slate-500">
                  Entre com seu CPF e senha para operar as mesas do restaurante.
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
                      className="h-12 rounded-2xl border-slate-200 pl-11 text-base"
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
                      className="h-12 rounded-2xl border-slate-200 pl-11 pr-11 text-base"
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

                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  O cadastro do CPF e da senha é feito na gestão de equipe do restaurante.
                </div>

                <Button
                  type="submit"
                  className="h-12 w-full rounded-2xl bg-[#FF6400] text-base font-bold hover:bg-[#e55a00]"
                  disabled={loading || cpf.replace(/\D/g, '').length !== 11 || !password}
                >
                  {loading ? 'Entrando...' : (
                    <>
                      Entrar no salão
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
