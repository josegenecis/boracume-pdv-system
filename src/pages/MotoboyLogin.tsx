import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bike, Eye, EyeOff, Lock, LogIn, UserRound } from 'lucide-react';
import Logo from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  formatMotoboyCpf,
  isValidMotoboyCpf,
  loadMotoboySession,
  loginMotoboy,
} from '@/services/motoboyWebClient';
import { useMotoboyPwa } from '@/hooks/useMotoboyPwa';

const MotoboyLogin: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  useMotoboyPwa();
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    loadMotoboySession().then((session) => { if (session) navigate('/motoboy-app', { replace: true }); }).finally(() => setChecking(false));
  }, [navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const session = await loginMotoboy(cpf, password);
      toast({ title: `Olá, ${session.profile.name}!`, description: 'Seu app de entregas está pronto.' });
      navigate('/motoboy-app', { replace: true });
    } catch (error: unknown) {
      toast({ title: 'Não foi possível entrar', description: error instanceof Error ? error.message : 'Tente novamente.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  if (checking) return <div className="flex min-h-[100dvh] items-center justify-center bg-[#052f22]"><div className="h-12 w-12 animate-spin rounded-full border-4 border-white/15 border-t-[#ff6b18]" /></div>;

  return (
    <main className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,#08704d_0%,#064532_40%,#052f22_100%)] px-5 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-sm flex-col justify-center">
        <Logo size="md" theme="dark" className="justify-center" />
        <div className="mt-7 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[.18em]"><Bike size={16} /> App Motoboy</span>
          <h1 className="mt-5 text-3xl font-black tracking-tight">Suas entregas, na ordem certa.</h1>
          <p className="mt-2 text-sm leading-6 text-white/70">Entre com o acesso criado pelo restaurante.</p>
        </div>
        <form onSubmit={submit} className="mt-8 space-y-5 rounded-[28px] border border-white/15 bg-white p-6 text-[#073e2e] shadow-2xl">
          <div className="space-y-2"><Label htmlFor="driver-cpf">CPF</Label><div className="relative"><UserRound className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><Input id="driver-cpf" inputMode="numeric" autoComplete="username" maxLength={14} value={cpf} onChange={(e) => setCpf(formatMotoboyCpf(e.target.value))} className="h-12 rounded-2xl pl-12" placeholder="000.000.000-00" /></div></div>
          <div className="space-y-2"><Label htmlFor="driver-password">Senha</Label><div className="relative"><Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><Input id="driver-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-2xl pl-12 pr-12" placeholder="Sua senha" /><button type="button" aria-label="Mostrar senha" className="absolute right-4 top-1/2 -translate-y-1/2" onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></div>
          <Button type="submit" disabled={loading || !isValidMotoboyCpf(cpf) || password.length < 6} className="h-12 w-full rounded-2xl bg-[#ff6418] text-base font-bold hover:bg-[#e85b14]">{loading ? 'Entrando...' : <><LogIn className="mr-2" /> Entrar no app</>}</Button>
        </form>
        <p className="mt-6 text-center text-xs text-white/50">PopSystem • Entregas conectadas ao restaurante</p>
      </div>
    </main>
  );
};

export default MotoboyLogin;
