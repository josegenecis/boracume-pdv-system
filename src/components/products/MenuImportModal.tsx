
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
          
          // Tamanho padrão de alta qualidade que o GPT-4o Vision processa bem
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
          
          // SEM CROP - Enviar imagem inteira redimensionada
          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Qualidade balanceada
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
          resolve(compressedBase64);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleImport = async () => {
    // Validação básica ANTES de iniciar o loading
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
      const timestamp = new Date().toISOString();
      console.log(`[Import] Iniciando importação (v${timestamp})...`, activeTab);

    try {
      let categoriesToImport: ImportedCategory[] = [];

      if (activeTab === 'text') {
        categoriesToImport = parseMenuText(textInput);
      } 
      else if (activeTab === 'link' || activeTab === 'image') {
        let payload = {};
        let finalUrl = '';
        
        if (activeTab === 'link') {
            finalUrl = urlInput;
        } else {
            if (!selectedImage) throw new Error('Selecione uma imagem.');
            
            // 1. Upload para Storage (Lógica Profissional: Upload Primeiro, Processa Depois)
            const fileExt = selectedImage.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `${user?.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('menu-imports')
                .upload(filePath, selectedImage);

            if (uploadError) {
                 // Tenta criar o bucket se não existir (fallback manual, idealmente via migration)
                 if (uploadError.message.includes('bucket not found')) {
                     throw new Error('Erro de configuração: Bucket menu-imports não encontrado. Contate o suporte.');
                 }
                 throw new Error(`Erro no upload da imagem: ${uploadError.message}`);
            }

            // 2. Pega URL Pública
            const { data: { publicUrl } } = supabase.storage
                .from('menu-imports')
                .getPublicUrl(filePath);

            finalUrl = publicUrl;
        }

        console.log('[Import] Processando URL:', finalUrl);
        payload = { url: finalUrl, isImageUpload: activeTab === 'image' };
        
        // Use the utility function that handles authentication and environment variables correctly
        try {
          const { data, status } = await invokeEdgeFunction('scrape-menu', payload);
          console.log('[Import] Resposta da função:', status, data);

          if (status !== 200) {
              console.error('[Import] Erro Function:', data);
              throw new Error(data?.error || `Erro ${status}: Falha ao conectar com a IA.`);
          } else {
             if (!data.success) {
                 throw new Error(data.error || 'A IA não conseguiu ler os dados.');
             }
             categoriesToImport = data.categories || [];
          }
        } catch (err: any) {
           console.error("[Import] Erro fatal na chamada:", err);
           
           // Se for erro de rede/timeout, mostra mensagem clara
           if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
               toast({
                 title: 'Erro de Conexão',
                 description: 'Não foi possível conectar ao servidor de IA. Verifique sua internet ou tente novamente.',
                 variant: 'destructive',
               });
           } else {
               // Mostra o erro real retornado pela Edge Function
               toast({
                 title: 'Falha na Importação',
                 description: `Detalhes: ${err.message || JSON.stringify(err)}`,
                 variant: 'destructive',
               });
           }
           
           setLoading(false);
           return; 
        }
      }

      if (categoriesToImport.length === 0) {
        throw new Error('Nenhum produto encontrado pela IA.');
      }
      
      console.log('[Import] Produtos encontrados:', categoriesToImport.length, 'categorias');

      let totalProducts = 0;

      // Process Categories and Products
      for (const category of categoriesToImport) {
        let categoryId: string | null = null;

        // 1. Create/Get Category
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

          // 3. Insert Products
        for (const product of category.items) {
            // First check if product already exists to avoid duplicates
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

                // 3. Insert Variants if any
                if (product.variants && product.variants.length > 0) {
                    const variantsData = product.variants.map(v => ({
                        product_id: newProduct.id,
                        name: v.name,
                        price: v.price
                    }));
                    
                    try {
                        // Cast to any to bypass strict type checking for now if table missing in types
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
      console.error(error);
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
