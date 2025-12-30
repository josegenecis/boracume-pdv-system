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
import Tesseract from 'tesseract.js';

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
  const [ocrProgress, setOcrProgress] = useState(0);
  const { toast } = useToast();
  const { user } = useAuth();

  const parseMenuText = (text: string) => {
    const lines = text.split('\n');
    const products = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setOcrProgress(0);

    try {
      const { data: { text } } = await Tesseract.recognize(
        file,
        'por', // Portuguese
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              setOcrProgress(Math.round(m.progress * 100));
            }
          }
        }
      );

      setTextInput(text);
      setActiveTab('text');
      toast({
        title: "OCR Concluído",
        description: "Texto extraído da imagem. Verifique e corrija se necessário.",
      });

    } catch (error) {
      console.error(error);
      toast({
        title: "Erro no OCR",
        description: "Não foi possível ler a imagem. Tente uma foto mais clara.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setOcrProgress(0);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      let productsToImport: { name: string; price: number }[] = [];

      if (activeTab === 'text' || activeTab === 'image') { // Image ultimately fills textInput
        if (!textInput.trim()) throw new Error('Cole o texto do cardápio ou use OCR.');
        productsToImport = parseMenuText(textInput);
      } else if (activeTab === 'link') {
        if (!urlInput.trim()) throw new Error('Insira um link válido.');
        
        const { data, error } = await supabase.functions.invoke('scrape-menu', {
          body: { url: urlInput }
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error || 'Falha ao ler o site.');
        
        productsToImport = data.products;
      }

      if (productsToImport.length === 0) {
        throw new Error('Nenhum produto identificado. Verifique o formato (Ex: Hamburguer ... 25,00)');
      }

      const productsData = productsToImport.map(p => ({
        user_id: user?.id,
        name: p.name,
        price: p.price,
        available: true,
        category_id: null
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
            Importe por Texto, Link ou Foto (OCR).
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
            <div className="border-2 border-dashed border-gray-300 rounded-lg h-40 flex flex-col items-center justify-center text-gray-500 relative">
              {loading && activeTab === 'image' ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <p className="text-sm">Lendo imagem... {ocrProgress}%</p>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 mb-2" />
                  <p className="text-sm">Clique para enviar foto</p>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleImageUpload}
                  />
                </>
              )}
            </div>
            <p className="text-xs text-center text-muted-foreground">
              A foto será convertida em texto e jogada na aba "Texto" para revisão.
            </p>
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
