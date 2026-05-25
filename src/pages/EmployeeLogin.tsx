import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, ShieldCheck, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Logo from '@/components/Logo';
import { useToast } from '@/hooks/use-toast';
import { formatCpf, loadWaiterWebSession, loginWaiterWeb } from '@/services/waiterWebClient';

export default function EmployeeLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    loadWaiterWebSession()
      .then((session) => {
        if (mounted && session) navigate('/funcionario-ponto', { replace: true });
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
        title: `Olá, ${session.profile.name}`,
        description: 'Acesso ao ponto liberado.',
      });
      navigate('/funcionario-ponto', { replace: true });
    } catch (loginError: any) {
      const message = String(loginError?.message || 'Nao foi possivel concluir o login.');
      setError(message);
      toast({ title: 'Erro no login', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#06271D] p-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#A4D65E]/15 border-t-[#FF6400]" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,#0D5A3E_0%,#083927_42%,#061F18_100%)] px-4 py-6 text-white">
      <div className="mx-auto flex min-h-[calc(100dvh-48px)] max-w-[430px] flex-col justify-center">
        <div className="text-center">
          <Logo size="md" theme="dark" className="mx-auto justify-center" />
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D9FF9B]">
            <ShieldCheck className="h-3.5 w-3.5" />
            App do funcionário
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">Controle de ponto</h1>
          <p className="mt-2 text-sm leading-6 text-white/70">
            Entre com CPF e senha para registrar entrada, intervalo, retorno e saída com validação de localização.
          </p>
        </div>

        <div className="mt-6 rounded-[30px] border border-white/12 bg-white p-4 text-slate-900 shadow-[0_30px_90px_-45px_rgba(0,0,0,0.8)]">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="employeeCpf" className="font-semibold text-[#063B2A]">CPF</Label>
              <div className="relative">
                <UserRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="employeeCpf"
                  inputMode="numeric"
                  autoFocus
                  value={cpf}
                  onChange={(event) => setCpf(formatCpf(event.target.value))}
                  className="h-12 rounded-2xl border-[#DCE6DF] bg-[#F8FAF7] pl-11 text-base"
                  placeholder="000.000.000-00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employeePassword" className="font-semibold text-[#063B2A]">Senha ou PIN</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="employeePassword"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 rounded-2xl border-[#DCE6DF] bg-[#F8FAF7] pl-11 pr-11 text-base"
                  placeholder="Digite sua senha"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1.5 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full text-[#063B2A] hover:bg-transparent"
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
              className="h-12 w-full rounded-2xl bg-[#FF6400] text-base font-semibold text-white hover:bg-[#E25A00]"
              disabled={loading || cpf.replace(/\D/g, '').length !== 11 || !password}
            >
              {loading ? 'Entrando...' : 'Entrar para bater ponto'}
              {!loading && <ArrowRight className="ml-2 h-5 w-5" />}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-white/45">PopSystem Ponto</p>
      </div>
    </div>
  );
}
