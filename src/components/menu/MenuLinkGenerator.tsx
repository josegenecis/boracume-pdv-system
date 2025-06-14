
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QrCode, Download, Copy, ExternalLink, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const MenuLinkGenerator = () => {
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const menuUrl = `${window.location.protocol}//${window.location.hostname}:8080/menu/${user?.id}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(menuUrl)}`;

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

  const downloadQRCode = () => {
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = 'cardapio-qrcode.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Download iniciado!",
      description: "O QR Code está sendo baixado.",
    });
  };

  const openMenuInNewTab = () => {
    window.open(menuUrl, '_blank');
  };

  const shareMenu = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Cardápio Digital',
          text: 'Confira nosso cardápio digital!',
          url: menuUrl,
        });
      } catch (error) {
        console.log('Erro ao compartilhar:', error);
      }
    } else {
      copyToClipboard();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="w-5 h-5" />
          Cardápio Digital
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center">
          <div className="inline-block p-4 bg-white rounded-lg shadow-lg">
            <img 
              src={qrCodeUrl} 
              alt="QR Code do Cardápio" 
              className="w-64 h-64 mx-auto"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="menu-url">Link do Cardápio</Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="menu-url"
                value={menuUrl}
                readOnly
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyToClipboard}
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={openMenuInNewTab}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Compartilhe este link com seus clientes para que possam acessar seu cardápio digital.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button onClick={downloadQRCode} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Baixar QR
            </Button>
            <Button onClick={copyToClipboard} variant="outline">
              <Copy className="w-4 h-4 mr-2" />
              Copiar Link
            </Button>
            <Button onClick={shareMenu} variant="outline">
              <Share2 className="w-4 h-4 mr-2" />
              Compartilhar
            </Button>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-2">Como usar:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Imprima o QR Code e cole em suas mesas, balcão ou materiais promocionais</li>
            <li>• Clientes podem escanear com a câmera do celular para acessar o cardápio</li>
            <li>• O link também pode ser compartilhado diretamente via WhatsApp ou redes sociais</li>
            <li>• Os pedidos feitos pelo cardápio chegam automaticamente na sua tela de pedidos</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default MenuLinkGenerator;
