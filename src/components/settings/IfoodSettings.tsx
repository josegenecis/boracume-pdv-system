import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle, CheckCircle2, RefreshCw, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { IfoodLogo } from '@/components/icons/IfoodLogo';

const IfoodSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [formData, setFormData] = useState({
    merchant_id: '',
  });

  useEffect(() => {
    if (user) loadSettings();
  }, [user]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('ifood_settings')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data);
        setFormData({
          merchant_id: data.merchant_id || '',
        });
      }
    } catch (e: any) {
      console.error('Erro ao carregar configurações iFood:', e);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      let error;
      if (settings?.id) {
        const { error: updateError } = await supabase
          .from('ifood_settings')
          .update({
            merchant_id: formData.merchant_id || null,
            client_id: null,
            client_secret: null,
            authorization_code: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', settings.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('ifood_settings')
          .insert({
            user_id: user?.id,
            merchant_id: formData.merchant_id || null,
            client_id: null,
            client_secret: null,
            authorization_code: null,
            updated_at: new Date().toISOString()
          });
        error = insertError;
      }

      if (error) throw error;

      toast({ title: 'Configurações salvas', description: 'ID do iFood atualizado.' });
      loadSettings();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async () => {
    if (!settings?.id) return;
    
    const newStatus = settings.status === 'online' ? 'offline' : 'online';
    try {
      setLoading(true);
      const { error } = await supabase
        .from('ifood_settings')
        .update({ status: newStatus })
        .eq('id', settings.id);

      if (error) throw error;
      
      setSettings({ ...settings, status: newStatus });
      toast({ 
        title: newStatus === 'online' ? 'Loja Aberta no iFood' : 'Loja Fechada no iFood',
        description: `O status da integração foi alterado para ${newStatus}.`
      });
    } catch (e: any) {
      toast({ title: 'Erro ao alterar status', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IfoodLogo className="h-8 w-auto" />
            <span className="ml-2">Integração</span>
          </CardTitle>
          <CardDescription>
            Vincule o ID da sua loja do iFood para ativar a integração.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          
          <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
            <div className="space-y-0.5">
              <div className="font-medium text-base">Status da Loja</div>
              <div className="text-sm text-muted-foreground">
                {settings?.status === 'online' ? 'Sua loja está aberta para receber pedidos.' : 'Sua loja está fechada ou offline.'}
              </div>
            </div>
            <div className="flex items-center gap-2">
               <span className={`text-sm font-bold ${settings?.status === 'online' ? 'text-green-600' : 'text-gray-500'}`}>
                 {settings?.status === 'online' ? 'ONLINE' : 'OFFLINE'}
               </span>
               <Switch 
                 checked={settings?.status === 'online'} 
                 onCheckedChange={toggleStatus}
                 disabled={!settings?.id || loading}
               />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="merchant_id">ID da Loja no iFood</Label>
              <Input 
                id="merchant_id" 
                placeholder="Cole aqui o ID da loja" 
                value={formData.merchant_id}
                onChange={e => setFormData({ merchant_id: e.target.value })}
              />
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Como funciona</AlertTitle>
            <AlertDescription>
              No BoraCume, a integração é ativada via parceiro. Você só precisa informar o ID da loja. Se não souber onde encontrar, fale com o suporte iFood ou com o BoraCume para localizar.
            </AlertDescription>
          </Alert>

        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={loading || !formData.merchant_id.trim()}>
            {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Salvar Configurações
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default IfoodSettings;
