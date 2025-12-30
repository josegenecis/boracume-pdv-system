import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Link as LinkIcon, Type, Loader2, AlertTriangle, CheckCircle2, Wand2 } from 'lucide-react';
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
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Resize to max 1024px width/height to save bandwidth and stay within limits
          const MAX_SIZE = 1024;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG 0.7 quality
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          resolve(compressedBase64);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      let productsToImport: { name: string; price: number, description?: string }[] = [];

      if (activeTab === 'text') {
        if (!textInput.trim()) throw new Error('Cole o texto do cardápio.');
        productsToImport = parseMenuText(textInput);
      } 
      else if (activeTab === 'link') {
        if (!urlInput.trim()) throw new Error('Insira um link válido.');
        
        const { data, error } = await supabase.functions.invoke('scrape-menu', {
          body: { url: urlInput }
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error || 'Falha ao ler o site.');
        
        productsToImport = data.products;
      } 
      else if (activeTab === 'image') {
        if (!selectedImage) throw new Error('Selecione uma imagem do cardápio.');

        // Convert image to base64
        const base64Image = await convertFileToBase64(selectedImage);

        const { data, error } = await supabase.functions.invoke('scrape-menu', {
          body: { imageBase64: base64Image }
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error || 'Falha ao processar imagem.');

        productsToImport = data.products;
      }

      if (productsToImport.length === 0) {
        throw new Error('Nenhum produto identificado. Tente novamente ou verifique a imagem/link.');
      }

      const productsData = productsToImport.map(p => ({
        user_id: user?.id,
        name: p.name,
        price: p.price,
        description: p.description || '',
        available: true,
        category_id: null
      }));

      const { error } = await supabase.from('products').insert(productsData);
      
      if (error) throw error;

      toast({
        title: 'Importação Concluída!',
        description: `${productsToImport.length} produtos foram importados com Inteligência Artificial.`,
      });
      
      onImportComplete();
      onClose();
      setTextInput('');
      setSelectedImage(null);
      setImagePreview(null);
      setUrlInput('');
      
    } catch (error: any) {
      console.error(error);
      let errorMessage = error.message;
      if (errorMessage.includes('OPENAI_API_KEY')) {
        errorMessage = "Configuração necessária: Adicione a chave OPENAI_API_KEY nos segredos do Supabase.";
      }
      
      toast({
        title: 'Erro na importação',
        description: errorMessage,
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
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-600" />
            Importar Cardápio com IA
          </DialogTitle>
          <DialogDescription>
            Use Inteligência Artificial para ler cardápios por Link ou Foto.
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
                Importação manual simples (sem IA).
              </p>
            </div>
          </TabsContent>

          <TabsContent value="link" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Link do Cardápio Digital (iFood, Goomer, Site próprio)</Label>
              <Input 
                placeholder="https://..." 
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
              <div className="flex items-center gap-2 p-3 bg-purple-50 text-purple-800 rounded-md text-xs border border-purple-100">
                <Wand2 className="w-4 h-4" />
                <span>A IA visitará o site e extrairá os produtos automaticamente.</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="image" className="space-y-4 py-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg h-48 flex flex-col items-center justify-center text-gray-500 relative overflow-hidden bg-gray-50">
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-contain opacity-50" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Button variant="secondary" size="sm" className="shadow-lg" onClick={() => {
                        setSelectedImage(null);
                        setImagePreview(null);
                    }}>
                      Trocar Imagem
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 mb-2" />
                  <p className="text-sm">Clique para enviar foto do cardápio</p>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleImageSelect}
                  />
                </>
              )}
            </div>
            <div className="flex items-center gap-2 p-3 bg-purple-50 text-purple-800 rounded-md text-xs border border-purple-100">
                <Wand2 className="w-4 h-4" />
                <span>O GPT-4o Vision analisará a foto e identificará os itens.</span>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleImport} disabled={loading} className={activeTab !== 'text' ? "bg-purple-600 hover:bg-purple-700" : ""}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            {activeTab === 'text' ? 'Importar' : 'Processar com IA'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MenuImportModal;
