import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Printer, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const PrinterConfig = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    paper_width: '80mm',
    font_size: 'normal',
    print_header: '',
    print_footer: 'Obrigado pela preferência!',
    auto_print: false,
    copies: 1
  });

  useEffect(() => {
    if (user) loadSettings();
  }, [user]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('printer_settings')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (data) setSettings(data as any);
    } catch (error) {
      console.error('Erro ao carregar config impressora:', error);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('printer_settings')
        .upsert({
          user_id: user?.id,
          ...settings,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      toast({ title: 'Configurações salvas!' });
    } catch (error) {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="h-5 w-5" /> Configuração de Impressão
        </CardTitle>
        <CardDescription>Ajuste o modelo para sua impressora térmica</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Largura do Papel</Label>
            <Select 
              value={settings.paper_width} 
              onValueChange={(v) => setSettings({...settings, paper_width: v})}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="58mm">58mm (Bobina Estreita)</SelectItem>
                <SelectItem value="80mm">80mm (Bobina Larga)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tamanho da Fonte</Label>
            <Select 
              value={settings.font_size} 
              onValueChange={(v) => setSettings({...settings, font_size: v})}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Pequena (Compacta)</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="large">Grande (Melhor Leitura)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Cabeçalho (Nome da Loja)</Label>
          <Input 
            value={settings.print_header || ''} 
            onChange={e => setSettings({...settings, print_header: e.target.value})}
            placeholder="Ex: BoraCumê Lanches"
          />
        </div>

        <div className="space-y-2">
          <Label>Rodapé</Label>
          <Input 
            value={settings.print_footer || ''} 
            onChange={e => setSettings({...settings, print_footer: e.target.value})}
            placeholder="Mensagem final"
          />
        </div>

        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-0.5">
            <Label>Impressão Automática</Label>
            <p className="text-sm text-gray-500">Abrir janela de impressão ao aceitar pedido</p>
          </div>
          <Switch 
            checked={settings.auto_print}
            onCheckedChange={c => setSettings({...settings, auto_print: c})}
          />
        </div>

        <Button onClick={handleSave} disabled={loading} className="w-full">
          <Save className="mr-2 h-4 w-4" /> Salvar Configuração
        </Button>
      </CardContent>
    </Card>
  );
};
