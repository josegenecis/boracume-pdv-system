import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

function parseHashParams(hash: string): Record<string, string> {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const sp = new URLSearchParams(raw);
  const out: Record<string, string> = {};
  sp.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const hashParams = useMemo(() => {
    try {
      return parseHashParams(window.location.hash || '');
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        if (code) {
          try {
            await supabase.auth.exchangeCodeForSession(code);
          } catch {}
        }

        const accessToken = hashParams.access_token || '';
        const refreshToken = hashParams.refresh_token || '';
        if (accessToken && refreshToken) {
          try {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          } catch {}
        }

        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        setHasRecoverySession(!!data?.session?.user);

        if (!code && (accessToken || refreshToken)) {
          try {
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch {}
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [hashParams]);

  const handleUpdatePassword = async () => {
    if (saving) return;
    const trimmed = password.trim();
    if (trimmed.length < 6) {
      toast({
        title: 'Senha fraca',
        description: 'Use uma senha com pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }
    if (trimmed !== confirmPassword.trim()) {
      toast({
        title: 'Senhas não conferem',
        description: 'Digite a mesma senha nos dois campos.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase.auth.updateUser({ password: trimmed });
      if (error) throw error;
      toast({
        title: 'Senha atualizada',
        description: 'Você já pode acessar com a nova senha.',
      });
      navigate('/login', { replace: true });
    } catch (e: any) {
      toast({
        title: 'Erro ao atualizar senha',
        description: e?.message || 'Não foi possível atualizar sua senha.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Redefinir senha</CardTitle>
            <CardDescription>Carregando…</CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      </div>
    );
  }

  if (!hasRecoverySession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Link inválido ou expirado</CardTitle>
            <CardDescription>
              Solicite um novo link de recuperação na tela de login.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-end">
            <Button onClick={() => navigate('/login')} disabled={saving}>
              Ir para login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Redefinir senha</CardTitle>
          <CardDescription>Crie uma nova senha para sua conta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleUpdatePassword} disabled={saving || password.trim().length < 6}>
            {saving ? 'Salvando…' : 'Atualizar senha'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ResetPassword;

