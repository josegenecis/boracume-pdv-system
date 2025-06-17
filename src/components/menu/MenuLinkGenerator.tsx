
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
  const menuLink = user ? `${window.location.origin}/menu/${user.id}` : '';

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
            QR Code
          </Button>
        </div>

        {showQRCode && menuLink && (
          <div className="mt-4 text-center">
            <QRCodeGenerator 
              value={menuLink}
              size={200}
              title="Cardápio Digital"
            />
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          <p><strong>Como usar:</strong></p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Copie e cole em redes sociais</li>
            <li>Adicione na bio do Instagram</li>
            <li>Envie por WhatsApp para clientes</li>
            <li>Use o QR Code em materiais impressos</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default MenuLinkGenerator;
