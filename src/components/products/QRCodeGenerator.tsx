
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
            Crie um QR Code para que seus clientes acessem o cardápio digital e façam pedidos
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
              Link do cardápio: {menuLink}
            </p>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>💡 Dica:</strong> Seus clientes poderão visualizar o cardápio, adicionar itens ao carrinho e fazer pedidos diretamente através deste link!
              </p>
            </div>
          </div>
          
          {qrCodeUrl && (
            <div className="flex flex-col items-center space-y-4 p-4 border rounded-lg">
              <img src={qrCodeUrl} alt="QR Code do Cardápio" className="border rounded" />
              <div className="text-center space-y-2">
                <p className="text-sm font-medium">QR Code do Cardápio Digital</p>
                <p className="text-xs text-muted-foreground">
                  Escaneie para acessar o cardápio e fazer pedidos
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={downloadQRCode}>
                  Baixar QR Code
                </Button>
                <Button variant="outline" onClick={() => copyToClipboard(menuLink)}>
                  <Copy size={16} className="mr-2" />
                  Copiar Link
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.open(menuLink, '_blank')}
                >
                  Visualizar Cardápio
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
            Compartilhe seu cardápio digital em diferentes plataformas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">WhatsApp</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Compartilhe o cardápio digital diretamente no WhatsApp
              </p>
              <Button 
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`🍕 Confira nosso cardápio digital e faça seu pedido: ${menuLink}`)}`)}
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
          
          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
            <h3 className="font-medium mb-2 text-orange-800">📋 Como usar o cardápio digital:</h3>
            <ul className="text-sm text-orange-700 space-y-1">
              <li>• Clientes escaneiam o QR Code ou acessam o link</li>
              <li>• Visualizam produtos com fotos e descrições</li>
              <li>• Adicionam itens ao carrinho</li>
              <li>• Preenchem dados pessoais e endereço</li>
              <li>• Escolhem forma de pagamento</li>
              <li>• Finalizam o pedido que chega em tempo real</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QRCodeGenerator;
