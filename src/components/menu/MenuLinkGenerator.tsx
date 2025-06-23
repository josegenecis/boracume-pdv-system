
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, ExternalLink, QrCode } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import QRCodeGenerator from '@/components/products/QRCodeGenerator';

const MenuLinkGenerator = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showQRCode, setShowQRCode] = useState(false);

  // Gerar o link correto do cardápio
  const menuLink = user ? `${window.location.origin}/cardapio/${user.id}` : '';

  const copyToClipboard = () => {
    if (menuLink) {
      navigator.clipboard.writeText(menuLink);
      toast({
        title: "Link copiado!",
        description: "O link do cardápio foi copiado para a área de transferência.",
      });
    }
  };

  const openInNewTab = () => {
    if (menuLink) {
      window.open(menuLink, '_blank');
    }
  };

  const shareLink = () => {
    if (navigator.share && menuLink) {
      navigator.share({
        title: 'Nosso Cardápio Digital',
        text: 'Confira nosso cardápio digital!',
        url: menuLink,
      });
    } else {
      copyToClipboard();
    }
  };

  const generateQRCode = () => {
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(menuLink)}`;
    return qrCodeUrl;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ExternalLink className="h-5 w-5" />
          Link do Cardápio Digital
        </CardTitle>
        <CardDescription>
          Compartilhe este link para que seus clientes acessem o cardápio digital e façam pedidos online.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="menu-link">Link do Cardápio</Label>
          <div className="flex gap-2">
            <Input
              id="menu-link"
              value={menuLink}
              readOnly
              className="flex-1"
              placeholder="Link será gerado automaticamente..."
            />
            <Button 
              variant="outline" 
              size="icon"
              onClick={copyToClipboard}
              disabled={!menuLink}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={openInNewTab}
              disabled={!menuLink}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={shareLink}
            disabled={!menuLink}
            className="flex-1"
          >
            Compartilhar Link
          </Button>
          <Button 
            variant="outline"
            onClick={() => setShowQRCode(!showQRCode)}
            disabled={!menuLink}
          >
            <QrCode className="h-4 w-4 mr-2" />
            {showQRCode ? 'Ocultar QR Codes' : 'Mostrar QR Codes'}
          </Button>
        </div>

        {/* QR Codes */}
        {showQRCode && menuLink && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {/* QR Code Nativo */}
            <div className="text-center space-y-4">
              <h4 className="font-medium text-lg">QR Code Nativo</h4>
              <div className="border rounded-lg p-4 bg-white">
                <img 
                  src={generateQRCode()} 
                  alt="QR Code do Cardápio"
                  className="mx-auto w-48 h-48"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                QR Code simples e rápido
              </p>
            </div>

            {/* QR Code Personalizado */}
            <div className="text-center space-y-4">
              <h4 className="font-medium text-lg">QR Code Personalizado</h4>
              <div className="border rounded-lg p-4 bg-white">
                <QRCodeGenerator 
                  value={menuLink}
                  size={200}
                  title="Cardápio Digital"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                QR Code com estilo personalizado
              </p>
            </div>
          </div>
        )}

        <div className="text-sm text-muted-foreground bg-blue-50 p-4 rounded-lg">
          <p><strong>Como usar:</strong></p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Copie e cole o link em redes sociais</li>
            <li>Adicione na bio do Instagram</li>
            <li>Envie por WhatsApp para clientes</li>
            <li>Use qualquer um dos QR Codes em materiais impressos</li>
            <li>Coloque QR Codes em mesas do restaurante</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default MenuLinkGenerator;
