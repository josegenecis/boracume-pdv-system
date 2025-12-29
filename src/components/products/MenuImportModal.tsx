import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Link as LinkIcon, Type, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface MenuImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

const MenuImportModal: React.FC<MenuImportModalProps> = ({ isOpen, onClose, onImportComplete }) => {
  const [activeTab, setActiveTab] = useState('text');
  const [textInput, setTextInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const parseMenuText = (text: string) => {
    // Simple parser: assumes "Name - Price" or "Name ... Price" format
    const lines = text.split('\n');
    const products = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      // Try to find price (R$ XX,XX or just XX,XX)
      const priceMatch = line.match(/(?:R\$\s*)?(\d+[,.]\d{2})/);
      
      if (priceMatch) {
        const price = parseFloat(priceMatch[1].replace(',', '.'));
        const name = line.replace(priceMatch[0], '').replace(/[.\-_]{2,}/, '').trim();
        
        if (name && price > 0) {
          products.push({ name, price });
        }
      }
    }
    
    return products;
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      let productsToImport: { name: string; price: number }[] = [];

      if (activeTab === 'text') {
        if (!textInput.trim()) throw new Error('Cole o texto do cardápio.');
        productsToImport = parseMenuText(textInput);
      } else if (activeTab === 'link') {
        // Mock import for link - in real world would need backend proxy
        if (!urlInput.trim()) throw new Error('Insira um link válido.');
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        throw new Error('Importação via link requer backend dedicado (bloqueio CORS). Use a opção de Texto por enquanto.');
      } else {
        // Image handling would go here
        throw new Error('Importação por imagem requer serviço OCR configurado.');
      }

      if (productsToImport.length === 0) {
        throw new Error('Nenhum produto identificado. Verifique o formato (Ex: Hamburguer ... 25,00)');
      }

      // Batch insert
      const productsData = productsToImport.map(p => ({
        user_id: user?.id,
        name: p.name,
        price: p.price,
        available: true,
        category_id: null // Would need category mapping logic
      }));

      const { error } = await supabase.from('products').insert(productsData);
      
      if (error) throw error;

      toast({
        title: 'Importação Concluída!',
        description: `${productsToImport.length} produtos foram importados.`,
      });
      
      onImportComplete();
      onClose();
      setTextInput('');
      
    } catch (error: any) {
      toast({
        title: 'Erro na importação',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar Cardápio</DialogTitle>
          <DialogDescription>
            Adicione produtos em massa rapidamente.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="text"><Type className="w-4 h-4 mr-2" /> Texto</TabsTrigger>
            <TabsTrigger value="link"><LinkIcon className="w-4 h-4 mr-2" /> Link</TabsTrigger>
            <TabsTrigger value="image"><Upload className="w-4 h-4 mr-2" /> Imagem</TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cole o texto do cardápio</Label>
              <Textarea 
                placeholder="Ex: X-Bacon ... R$ 25,00&#10;Coca-Cola ... R$ 6,00"
                className="h-40"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                O sistema tentará identificar Nome e Preço em cada linha.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="link" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Link do iFood ou Site</Label>
              <Input 
                placeholder="https://..." 
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
              <div className="flex items-center gap-2 p-3 bg-yellow-50 text-yellow-800 rounded-md text-xs">
                <AlertTriangle className="w-4 h-4" />
                <span>Sites como iFood podem bloquear importação automática.</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="image" className="space-y-4 py-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg h-40 flex flex-col items-center justify-center text-gray-500">
              <Upload className="w-8 h-8 mb-2" />
              <p className="text-sm">Arraste uma foto do cardápio</p>
              <p className="text-xs mt-1">(Em breve)</p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleImport} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Importar Produtos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MenuImportModal;
