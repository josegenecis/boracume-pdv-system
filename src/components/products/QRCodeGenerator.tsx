
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QrCode, Download, Copy, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const QRCodeGenerator = () => {
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [menuUrl, setMenuUrl] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      // Gera a URL do cardápio usando o ID do usuário
      const baseUrl = window.location.origin;
      const url = `${baseUrl}/menu/${user.id}`;
      setMenuUrl(url);
      
      // Gera o QR Code usando uma API gratuita
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
      setQrCodeUrl(qrUrl);
    }
  }, [user]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copiado!",
        description: "Link copiado para a área de transferência.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível copiar o link.",
        variant: "destructive"
      });
    }
  };

  const downloadQRCode = () => {
    if (qrCodeUrl) {
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
    }
  };

  const openMenu = () => {
    if (menuUrl) {
      window.open(menuUrl, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            QR Code do Cardápio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            {qrCodeUrl ? (
              <div className="inline-block p-4 bg-white rounded-lg shadow-lg">
                <img 
                  src={qrCodeUrl} 
                  alt="QR Code do Cardápio" 
                  className="w-64 h-64 mx-auto"
                />
              </div>
            ) : (
              <div className="w-64 h-64 mx-auto bg-gray-200 rounded-lg flex items-center justify-center">
                <QrCode className="w-16 h-16 text-gray-400" />
              </div>
            )}
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
                  onClick={() => copyToClipboard(menuUrl)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={openMenu}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Compartilhe este link com seus clientes para que possam acessar seu cardápio digital.
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={downloadQRCode} className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Baixar QR Code
              </Button>
              <Button variant="outline" onClick={() => copyToClipboard(menuUrl)} className="flex-1">
                <Copy className="w-4 h-4 mr-2" />
                Copiar Link
              </Button>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Como usar:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Baixe o QR Code e cole em suas mesas, balcão ou materiais promocionais</li>
              <li>• Clientes podem escanear com a câmera do celular para acessar o cardápio</li>
              <li>• O link também pode ser compartilhado diretamente via WhatsApp ou redes sociais</li>
              <li>• Os pedidos feitos pelo cardápio chegam automaticamente na sua tela de pedidos</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QRCodeGenerator;
