
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const MenuLinkTester = () => {
  const { user } = useAuth();

  const menuLink = user ? `${window.location.origin}/cardapio/${user.id}` : '';

  const openMenu = () => {
    if (menuLink) {
      window.open(menuLink, '_blank');
    }
  };

  return (
    <Card className="bg-blue-50 border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Eye className="h-5 w-5" />
          Teste seu Cardápio Digital
        </CardTitle>
        <CardDescription className="text-blue-700">
          Clique no botão abaixo para visualizar como seus clientes verão o cardápio digital
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-white p-3 rounded border border-blue-200">
          <p className="text-sm text-gray-600 mb-2">Link do seu cardápio:</p>
          <p className="font-mono text-sm break-all text-blue-600">{menuLink}</p>
        </div>
        
        <Button 
          onClick={openMenu}
          disabled={!menuLink}
          className="w-full bg-blue-600 hover:bg-blue-700"
          size="lg"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Abrir Cardápio Digital em Nova Aba
        </Button>
        
        <div className="text-xs text-gray-500 bg-white p-3 rounded border">
          <p className="font-semibold mb-1">💡 O que você pode testar:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Ver seus produtos organizados por categoria</li>
            <li>Adicionar produtos ao carrinho</li>
            <li>Preencher dados de cliente</li>
            <li>Selecionar área de entrega</li>
            <li>Finalizar um pedido de teste</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default MenuLinkTester;
