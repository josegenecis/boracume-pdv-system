
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { QrCode, Link as LinkIcon, Copy, Share } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const QRCodeGenerator = () => {
  const [menuUrl, setMenuUrl] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const { toast } = useToast();
  
  const baseUrl = window.location.origin;
  const menuLink = `${baseUrl}/menu/${menuUrl || 'demo'}`;

  const generateQRCode = () => {
    if (!menuUrl) {
      toast({
        title: "URL obrigatória",
        description: "Digite uma URL personalizada para o seu cardápio.",
        variant: "destructive",
      });
      return;
    }
    
    // Gerar QR Code usando uma API pública
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(menuLink)}`;
    setQrCodeUrl(qrUrl);
    
    toast({
      title: "QR Code gerado!",
      description: "Seu QR Code foi criado com sucesso.",
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Link copiado para a área de transferência.",
    });
  };

  const downloadQRCode = () => {
    if (!qrCodeUrl) return;
    
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `qrcode-menu-${menuUrl}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Download iniciado",
      description: "QR Code baixado com sucesso.",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode size={24} />
            Gerador de QR Code
          </CardTitle>
          <CardDescription>
            Crie um QR Code para que seus clientes acessem o cardápio digital
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">URL Personalizada do Cardápio</label>
            <div className="flex gap-2">
              <Input
                placeholder="meu-restaurante"
                value={menuUrl}
                onChange={(e) => setMenuUrl(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              />
              <Button onClick={generateQRCode}>
                Gerar QR Code
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Link final: {menuLink}
            </p>
          </div>
          
          {qrCodeUrl && (
            <div className="flex flex-col items-center space-y-4 p-4 border rounded-lg">
              <img src={qrCodeUrl} alt="QR Code do Cardápio" className="border rounded" />
              <div className="flex gap-2">
                <Button variant="outline" onClick={downloadQRCode}>
                  Baixar QR Code
                </Button>
                <Button variant="outline" onClick={() => copyToClipboard(menuLink)}>
                  <Copy size={16} className="mr-2" />
                  Copiar Link
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon size={24} />
            Links de Compartilhamento
          </CardTitle>
          <CardDescription>
            Compartilhe seu cardápio em diferentes plataformas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">WhatsApp</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Compartilhe diretamente no WhatsApp
              </p>
              <Button 
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Confira nosso cardápio: ${menuLink}`)}`)}
              >
                <Share size={16} className="mr-2" />
                Compartilhar
              </Button>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">Instagram</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Copie o link para stories/bio
              </p>
              <Button 
                variant="outline"
                className="w-full"
                onClick={() => copyToClipboard(menuLink)}
              >
                <Copy size={16} className="mr-2" />
                Copiar Link
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QRCodeGenerator;
