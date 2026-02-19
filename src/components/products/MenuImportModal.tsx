import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Link as LinkIcon, Type, Loader2, CheckCircle2, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { invokeEdgeFunction } from '@/utils/invokeEdgeFunction';

interface MenuImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

interface ImportedVariant {
  name: string;
  price: number;
}

interface ImportedProduct {
  name: string;
  price: number;
  description?: string;
  image_url?: string;
  variants?: ImportedVariant[];
}

interface ImportedCategory {
  name: string;
  items: ImportedProduct[];
}

const MenuImportModal: React.FC<MenuImportModalProps> = ({ isOpen, onClose, onImportComplete }) => {
  const [activeTab, setActiveTab] = useState('text');
  const [textInput, setTextInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processando...');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { user } = useAuth();

  const parseMenuText = (text: string) => {
    const lines = text.split('\n');
    const products: ImportedProduct[] = [];
    
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
    
    return [{ name: "Geral", items: products }];
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
          
          const MAX_SIZE = 1200; 
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
          
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
          resolve(compressedBase64);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = error => reject(error);
    });
  };

  const pollForResults = async (runId: string): Promise<ImportedCategory[]> => {
      const POLL_INTERVAL = 5000; // 5 segundos
      const MAX_ATTEMPTS = 60; // 5 minutos máximo
      let attempts = 0;

      return new Promise((resolve, reject) => {
          const checkStatus = async () => {
              attempts++;
              setLoadingMessage(`Extraindo cardápio... (${attempts}s)`);
              
              try {
                  const { data, status } = await invokeEdgeFunction('scrape-menu', { 
                      action: 'check', 
                      runId: runId 
                  });

                  if (status !== 200 || !data.success) {
                      // Se falhar o check, paramos
                      if (data?.status === 'failed') {
                          reject(new Error(data.error || 'Falha na extração dos dados.'));
                          return;
                      }
                      // Se for erro de rede, tentamos de novo
                      console.warn('Erro ao checar status, tentando novamente...', data);
                  } else {
                      if (data.status === 'completed') {
                          resolve(data.categories || []);
                          return;
                      }
                      // Se ainda estiver processando (status: processing)
                  }

                  if (attempts >= MAX_ATTEMPTS) {
                      reject(new Error('Tempo limite excedido (5 minutos).'));
                      return;
                  }

                  // Tentar novamente
                  setTimeout(checkStatus, POLL_INTERVAL);

              } catch (e) {
                  console.error('Erro no polling:', e);
                  // Continuar tentando mesmo com erro de rede
                  if (attempts >= MAX_ATTEMPTS) {
                      reject(e);
                  } else {
                      setTimeout(checkStatus, POLL_INTERVAL);
                  }
              }
          };

          checkStatus();
      });
  };

  const handleImport = async () => {
    if (activeTab === 'text' && !textInput.trim()) {
        toast({ title: 'Atenção', description: 'Cole o texto do cardápio.', variant: 'destructive' });
        return;
    }
    if (activeTab === 'link' && !urlInput.trim()) {
        toast({ title: 'Atenção', description: 'Insira um link válido.', variant: 'destructive' });
        return;
    }
    if (activeTab === 'image' && !selectedImage) {
        toast({ title: 'Atenção', description: 'Selecione uma imagem.', variant: 'destructive' });
        return;
    }

    setLoading(true);
    setLoadingMessage('Iniciando...');
    console.log(`[Import] Iniciando importação...`, activeTab);

    try {
      let categoriesToImport: ImportedCategory[] = [];

      if (activeTab === 'text') {
        categoriesToImport = parseMenuText(textInput);
      } 
      else if (activeTab === 'link') {
        // 1. Iniciar Job (Async)
        setLoadingMessage('Conectando ao iFood...');
        const { data: startData, status: startStatus } = await invokeEdgeFunction('scrape-menu', { 
            type: 'url', 
            data: urlInput,
            action: 'start'
        });

        if (startStatus !== 200 || !startData.success) {
            throw new Error(startData?.error || 'Não foi possível iniciar a leitura.');
        }

        const runId = startData.runId;
        
        // 2. Se retornou runId, fazer Polling
        if (runId) {
            console.log('[Import] Job iniciado. RunID:', runId);
            categoriesToImport = await pollForResults(runId);
        } else {
            // Fallback para caso não tenha retornado runId (ex: imagem ou erro)
            categoriesToImport = startData.categories || [];
        }
      }
      else if (activeTab === 'image') {
         setLoadingMessage('Processando imagem...');
         const optimizedBase64 = await convertFileToBase64(selectedImage!);
         
         const { data, status } = await invokeEdgeFunction('scrape-menu', { 
            type: 'image',
            data: optimizedBase64,
            action: 'start' // Imagem ainda é síncrona
         });

         if (status !== 200 || !data.success) {
             throw new Error(data?.error || 'Erro ao processar imagem.');
         }
         categoriesToImport = data.categories || [];
      }

      if (categoriesToImport.length === 0) {
        throw new Error('Nenhum produto encontrado.');
      }
      
      console.log('[Import] Sucesso! Importando para o banco...');
      setLoadingMessage('Salvando produtos...');

      let totalProducts = 0;

      // Salvamento no Banco (igual ao anterior)
      for (const category of categoriesToImport) {
        let categoryId: string | null = null;

        if (category.name && category.name !== 'Geral') {
            const { data: existingCat } = await supabase
                .from('product_categories')
                .select('id')
                .eq('user_id', user?.id)
                .eq('name', category.name)
                .maybeSingle();
            
            if (existingCat) {
                categoryId = existingCat.id;
            } else {
                const { data: newCat, error: catError } = await supabase
                    .from('product_categories')
                    .insert({ user_id: user?.id, name: category.name })
                    .select('id')
                    .single();
                
                if (!catError && newCat) categoryId = newCat.id;
            }
        }

        for (const product of category.items) {
            const { data: existingProduct } = await supabase
                .from('products')
                .select('id')
                .eq('user_id', user?.id)
                .eq('name', product.name)
                .maybeSingle();
            
            if (existingProduct) continue;

            const { data: newProduct, error: prodError } = await supabase
                .from('products')
                .insert({
                    user_id: user?.id,
                    name: product.name,
                    price: product.price,
                    description: product.description || '',
                    image_url: product.image_url,
                    category: category.name || 'Geral',
                    category_id: categoryId,
                    available: true,
                    show_in_pdv: true,
                    show_in_delivery: true
                })
                .select('id')
                .single();

            if (!prodError && newProduct) {
                totalProducts++;
                if (product.variants && product.variants.length > 0) {
                    const variantsData = product.variants.map(v => ({
                        product_id: newProduct.id,
                        name: v.name,
                        price: v.price
                    }));
                    try {
                        await (supabase as any).from('product_variants').insert(variantsData);
                    } catch (varError) {
                        console.error('Error inserting variants:', varError);
                    }
                }
            }
        }
      }

      toast({
        title: 'Importação Concluída!',
        description: `${totalProducts} produtos importados com sucesso.`,
      });
      
      onImportComplete();
      onClose();
      setTextInput('');
      setSelectedImage(null);
      setImagePreview(null);
      setUrlInput('');
      
    } catch (error: any) {
      console.error('[Import] Erro:', error);
      toast({
        title: 'Erro na importação',
        description: error?.message || 'Erro desconhecido.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setLoadingMessage('Processando...');
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
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleImport} disabled={loading} className={activeTab !== 'text' ? "bg-purple-600 hover:bg-purple-700" : ""}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            {loading ? loadingMessage : (activeTab === 'text' ? 'Importar' : 'Processar com IA')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MenuImportModal;
