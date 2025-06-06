
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QrCode, ExternalLink, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const Menu = () => {
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const menuUrl = `${window.location.origin}/menu-digital?user=${user?.id}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(menuUrl);
      setCopied(true);
      toast({
        title: "Link copiado!",
        description: "O link do cardápio foi copiado para a área de transferência.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível copiar o link.",
        variant: "destructive"
      });
    }
  };

  const openMenuInNewTab = () => {
    window.open(menuUrl, '_blank');
  };

  const generateQRCode = () => {
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(menuUrl)}`;
    return qrCodeUrl;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cardápio Digital</h1>
        <Button onClick={openMenuInNewTab} className="flex items-center gap-2">
          <ExternalLink size={16} />
          Ver Cardápio Público
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode size={24} />
              QR Code do Cardápio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Use este QR Code para que seus clientes acessem o cardápio digital diretamente pelo celular.
            </p>
            
            <div className="flex justify-center">
              <img 
                src={generateQRCode()} 
                alt="QR Code do Cardápio"
                className="w-48 h-48 border rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Link do Cardápio:</label>
              <div className="flex gap-2">
                <Input 
                  value={menuUrl}
                  readOnly
                  className="text-sm"
                />
                <Button
                  onClick={copyToClipboard}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Como usar o Cardápio Digital</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                  1
                </div>
                <p className="text-sm">
                  <strong>Compartilhe o link</strong> ou use o QR Code para que seus clientes acessem o cardápio.
                </p>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                  2
                </div>
                <p className="text-sm">
                  <strong>Clientes navegam</strong> pelos produtos, adicionam ao carrinho e fazem pedidos.
                </p>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                  3
                </div>
                <p className="text-sm">
                  <strong>Receba os pedidos</strong> diretamente pelo WhatsApp e gerencie as entregas.
                </p>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Dicas importantes:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Mantenha seus produtos e preços sempre atualizados</li>
                <li>• Configure os bairros de entrega em Configurações</li>
                <li>• Use imagens atrativas para seus produtos</li>
                <li>• Configure seu perfil com informações do restaurante</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Menu;
