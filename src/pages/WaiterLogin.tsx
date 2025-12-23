import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { User, Lock, ArrowRight } from 'lucide-react';

const WaiterLogin = () => {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;

    setLoading(true);
    try {
      // Find waiter by PIN
      const { data, error } = await supabase
        .from('waiters')
        .select('id, name, user_id')
        .eq('pin', pin)
        .eq('active', true)
        .single();

      if (error || !data) {
        throw new Error('PIN inválido ou garçom inativo');
      }

      // Store session info (this is a simplified session)
      localStorage.setItem('waiter_session', JSON.stringify({
        id: data.id,
        name: data.name,
        restaurant_id: data.user_id,
        login_time: new Date().toISOString()
      }));

      toast({
        title: `Bem-vindo, ${data.name}!`,
        description: 'Login realizado com sucesso.',
      });

      navigate('/waiter-dashboard');
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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-2">
            <User className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-primary">Acesso Garçom</CardTitle>
          <CardDescription>Digite seu PIN para acessar o sistema de mesas</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="pin" className="text-center block text-lg">PIN de Acesso</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="pl-10 text-center text-2xl tracking-widest h-14"
                  placeholder="••••"
                  autoFocus
                />
              </div>
            </div>
            
            <Button type="submit" className="w-full h-12 text-lg" disabled={loading || pin.length < 4}>
              {loading ? 'Entrando...' : (
                <>
                  Acessar Mesas <ArrowRight className="ml-2 w-5 h-5" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default WaiterLogin;