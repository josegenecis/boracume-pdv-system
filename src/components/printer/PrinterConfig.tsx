import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Printer, Save, Upload, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import AdjustableImageDialog from '@/components/media/AdjustableImageDialog';

export const PrinterConfig = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [settings, setSettings] = useState({
    paper_width: '80mm',
    font_size: 'normal',
    print_header: '',
    print_footer: 'Obrigado pela preferência!',
    auto_print: false,
    print_kitchen_ticket: false,
    copies: 1,
    receipt_logo_url: ''
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

      if (data) setSettings((prev) => ({ ...prev, ...(data as any) }));
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
        } as any);

      if (error) throw error;
      toast({ title: 'Configurações salvas!' });
    } catch (error) {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const uploadReceiptLogo = async (file: File) => {
    if (!user) return;
    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const filePath = `${user.id}/receipt-logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(filePath);

      setSettings((prev) => ({ ...prev, receipt_logo_url: publicUrl }));
      toast({
        title: 'Logomarca ajustada',
        description: 'Agora é só salvar para usar essa logo no cupom.',
      });
    } catch (error) {
      console.error('Erro ao enviar logomarca do cupom:', error);
      toast({
        title: 'Erro no upload',
        description: 'Não foi possível carregar a logomarca do cupom.',
        variant: 'destructive',
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Selecione apenas imagens para a logomarca do cupom.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'A logomarca deve ter no máximo 5MB.',
        variant: 'destructive',
      });
      return;
    }

    setPendingLogoFile(file);
  };

  return (
    <Card>
      <AdjustableImageDialog
        open={Boolean(pendingLogoFile)}
        file={pendingLogoFile}
        title="Ajustar logo do cupom"
        aspectRatio={2}
        outputWidth={600}
        outputHeight={300}
        onCancel={() => setPendingLogoFile(null)}
        onConfirm={(file) => {
          setPendingLogoFile(null);
          void uploadReceiptLogo(file);
        }}
      />
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
            placeholder="Ex: PopSystem Lanches"
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

        <div className="space-y-3 rounded-lg border p-4">
          <div className="space-y-1">
            <Label>Logomarca do Cupom</Label>
            <p className="text-sm text-gray-500">
              Use uma imagem limpa, preferencialmente PNG com fundo transparente. Se deixar vazio, o sistema usa a logo do perfil.
            </p>
          </div>

          {settings.receipt_logo_url ? (
            <div className="rounded-lg border bg-white p-4">
              <img
                src={settings.receipt_logo_url}
                alt="Logomarca do cupom"
                className="mx-auto max-h-24 w-auto object-contain"
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-gray-500">
              Nenhuma logomarca especÃ­fica configurada para o cupom.
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Label
              htmlFor="receipt-logo-upload"
              className="inline-flex cursor-pointer items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploadingLogo ? 'Enviando...' : 'Enviar logomarca'}
            </Label>
            <input
              id="receipt-logo-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
              disabled={uploadingLogo}
            />
            {settings.receipt_logo_url ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setSettings((prev) => ({ ...prev, receipt_logo_url: '' }))}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remover logo do cupom
              </Button>
            ) : null}
          </div>
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

        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-0.5">
            <Label>Comanda da cozinha</Label>
            <p className="text-sm text-gray-500">Imprime um segundo cupom separado, sem preços, endereço e totais.</p>
          </div>
          <Switch
            checked={settings.print_kitchen_ticket}
            onCheckedChange={c => setSettings({...settings, print_kitchen_ticket: c})}
          />
        </div>

        <Button onClick={handleSave} disabled={loading} className="w-full">
          <Save className="mr-2 h-4 w-4" /> Salvar Configuração
        </Button>
      </CardContent>
    </Card>
  );
};
