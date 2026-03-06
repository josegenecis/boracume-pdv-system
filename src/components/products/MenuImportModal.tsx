import React, { useEffect, useRef, useState } from 'react';
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
import Tesseract from 'tesseract.js';

interface MenuImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

interface ImportedVariant {
  name: string;
  price: number;
}

interface ImportedVariationGroup {
  name: string;
  required?: boolean;
  max_selections?: number;
  options: ImportedVariant[];
}

interface ImportedProduct {
  name: string;
  price: number;
  description?: string;
  image_url?: string;
  variants?: ImportedVariant[];
  price_variants?: ImportedVariant[];
  variations?: ImportedVariationGroup[];
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
  const cancelRef = useRef(false);
  
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    cancelRef.current = !isOpen;
  }, [isOpen]);

  const isValidUrl = (value: string) => {
    try {
      const u = new URL(value.trim());
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const normalizeImageUrl = (value?: string | null) => {
    const v = (value || '').trim().replace(/^['"]|['"]$/g, '');
    if (!v || v === 'null' || v === 'undefined' || v === '[object Object]') return null;
    if (v.startsWith('//')) return `https:${v}`;
    if (v.startsWith('http://')) return `https://${v.slice('http://'.length)}`;
    if (v.startsWith('https://')) return v;
    if (v.includes('ifood-static.com.br') || v.includes('ifood-static.com')) return `https://${v}`;
    return null;
  };

  const normalizeKey = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  const mergeImportedMenus = (base: ImportedCategory[], enrich: ImportedCategory[]) => {
    const enrichProducts = new Map<string, ImportedProduct>();
    for (const c of enrich || []) {
      for (const p of c.items || []) {
        if (!p?.name) continue;
        enrichProducts.set(normalizeKey(p.name), p);
      }
    }
    return (base || []).map(cat => ({
      ...cat,
      items: (cat.items || []).map(p => {
        const e = enrichProducts.get(normalizeKey(p.name || ''));
        if (!e) return p;
        const merged: ImportedProduct = { ...p };
        if ((!merged.description || !merged.description.trim()) && e.description) merged.description = e.description;
        if ((!merged.image_url || !normalizeImageUrl(merged.image_url)) && e.image_url) merged.image_url = e.image_url;
        if ((!merged.price_variants || merged.price_variants.length === 0) && e.price_variants?.length) merged.price_variants = e.price_variants;
        if ((!merged.variants || merged.variants.length === 0) && e.variants?.length) merged.variants = e.variants;
        if ((!merged.variations || merged.variations.length === 0) && e.variations?.length) merged.variations = e.variations;
        return merged;
      })
    }));
  };

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
          
          const MAX_SIZE = 900; 
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
          
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);
          resolve(compressedBase64);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = error => reject(error);
    });
  };

  const invokeScrapeMenuWithRetry = async (body: any, retries = 2) => {
    let last: { data: any | null; status: number } = { data: null, status: 500 };
    for (let i = 0; i <= retries; i++) {
      last = await invokeEdgeFunction('scrape-menu', body);
      if (last.status === 200) return last;
      await new Promise<void>(resolve => window.setTimeout(resolve, 600 + i * 600));
    }
    return last;
  };

  const pollForResults = async (runId: string): Promise<ImportedCategory[]> => {
      const POLL_INTERVAL = 5000; // 5 segundos
      const MAX_ATTEMPTS = 60; // 5 minutos máximo
      let attempts = 0;
      let consecutiveFailures = 0;

      return new Promise((resolve, reject) => {
          const checkStatus = async () => {
              if (cancelRef.current) {
                reject(new Error('Cancelado.'));
                return;
              }
              attempts++;
              setLoadingMessage(`Extraindo cardápio... (${attempts}s)`);
              
              try {
                  const { data, status } = await invokeEdgeFunction('scrape-menu', { 
                      action: 'check', 
                      runId: runId 
                  });

                  // 1. Erro de Rede ou Status HTTP (não 200)
                  if (status !== 200) {
                      consecutiveFailures++;
                      // Se for erro 500 (interno), geralmente é falha fatal se não tiver success: true
                      console.warn('Erro HTTP ao checar status:', status, data);
                      if (consecutiveFailures >= 3) {
                        reject(new Error(data?.error || 'Falha de rede ao consultar o servidor. Tente novamente.'));
                        return;
                      }
                      // Tentar novamente (pode ser instabilidade)
                  } 
                  
                  // 2. Erro Lógico retornado pelo Backend
                  else if (!data.success) {
                      try {
                        console.error('[Import] scrape-menu falhou:', { runId, data });
                      } catch {}
                      // Se o backend diz que falhou, PARAR IMEDIATAMENTE.
                      // Isso evita o loop infinito quando o backend retorna "Dataset vazio" ou "Erro Apify".
                      const details = data?.debug?.datasetId ? ` (runId: ${runId}, dataset: ${data.debug.datasetId})` : ` (runId: ${runId})`;
                      reject(new Error(`${data.error || 'Falha desconhecida na extração.'}${details}`));
                      return;
                  }
                  
                  // 3. Status Específico do Job
                  else if (data.status === 'failed') {
                      const details = data?.debug?.datasetId ? ` (runId: ${runId}, dataset: ${data.debug.datasetId})` : ` (runId: ${runId})`;
                      reject(new Error(`${data.error || 'O processo de extração falhou.'}${details}`));
                      return;
                  }
                  else if (data.status === 'completed') {
                      resolve(data.categories || []);
                      return;
                  }
                  else {
                      consecutiveFailures = 0;
                  }
                  
                  // 4. Timeout Frontend
                  if (attempts >= MAX_ATTEMPTS) {
                      reject(new Error('Tempo limite excedido (5 minutos).'));
                      return;
                  }

                  // 5. Tentar novamente (status: processing ou erro de rede)
                  if (!cancelRef.current) setTimeout(checkStatus, POLL_INTERVAL);

              } catch (e) {
                  console.error('Erro no polling:', e);
                  // Continuar tentando mesmo com erro de rede
                  consecutiveFailures++;
                  if (attempts >= MAX_ATTEMPTS || consecutiveFailures >= 3) {
                      reject(e);
                      return;
                  }
                  if (!cancelRef.current) setTimeout(checkStatus, POLL_INTERVAL);
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
    if (activeTab === 'link' && urlInput.trim() && !isValidUrl(urlInput)) {
        toast({ title: 'Atenção', description: 'O valor informado não é uma URL válida. Use a aba Texto para colar descrições.', variant: 'destructive' });
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
        setLoadingMessage('Processando texto...');
        const { data, status } = await invokeEdgeFunction('scrape-menu', {
          type: 'text',
          data: textInput,
          action: 'start'
        });
        if (status !== 200 || !data.success) {
          categoriesToImport = parseMenuText(textInput);
        } else {
          categoriesToImport = data.categories || [];
        }
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
         setLoadingMessage('Lendo texto da imagem...');
         const optimizedBase64 = await convertFileToBase64(selectedImage!);
         let extractedText = '';
         try {
           const res = await Tesseract.recognize(optimizedBase64, 'por', {
             logger: (m: any) => {
               if (m?.status === 'recognizing text' && typeof m?.progress === 'number') {
                 setLoadingMessage(`Lendo texto da imagem... ${Math.round(m.progress * 100)}%`);
               }
             }
           });
           extractedText = String(res?.data?.text || '').trim();
         } catch {}

         if (extractedText) {
           setLoadingMessage('Estruturando cardápio...');
           const { data, status } = await invokeEdgeFunction('scrape-menu', {
             type: 'text',
             data: extractedText,
             action: 'start'
           });
           if (status === 200 && data.success) {
             categoriesToImport = data.categories || [];
           }
         }

         const hasAnyVariantsOrAddons = (categoriesToImport || []).some((c: ImportedCategory) =>
           (c.items || []).some((p: ImportedProduct) =>
             (p.price_variants && p.price_variants.length > 0) ||
             (p.variants && p.variants.length > 0) ||
             (p.variations && p.variations.length > 0)
           )
         );

         if (categoriesToImport.length === 0) {
           setLoadingMessage('Processando imagem...');
           const { data, status } = await invokeEdgeFunction('scrape-menu', { 
              type: 'image',
              data: optimizedBase64,
              action: 'start'
           });
           if (status !== 200 || !data.success) {
               throw new Error(data?.error || 'Erro ao processar imagem.');
           }
           categoriesToImport = data.categories || [];
         } else if (!hasAnyVariantsOrAddons) {
           setLoadingMessage('Procurando variações e adicionais...');
           const { data, status } = await invokeScrapeMenuWithRetry({ 
              type: 'image',
              data: optimizedBase64,
              action: 'start'
           });
           if (status === 200 && data?.success && Array.isArray(data.categories) && data.categories.length > 0) {
             categoriesToImport = mergeImportedMenus(categoriesToImport, data.categories);
           }
         }
      }

      if (categoriesToImport.length === 0) {
        throw new Error('Nenhum produto encontrado.');
      }
      
      console.log('[Import] Sucesso! Importando para o banco...');
      setLoadingMessage('Salvando produtos...');

      let totalProducts = 0;
      let totalImages = 0;
      let totalAddonGroupsLinked = 0;
      let totalAddonGroupsCreated = 0;
      let totalAddonErrors = 0;

      const normalizeOptionsToString = (raw: any) => {
        let arr: any[] = [];
        if (!raw) arr = [];
        else if (typeof raw === 'string') {
          try { arr = JSON.parse(raw); } catch { arr = []; }
        } else if (Array.isArray(raw)) {
          arr = raw;
        } else if (typeof raw === 'object') {
          arr = Object.entries(raw).map(([name, price]) => ({ name, price }));
        }
        const normalized = (arr || [])
          .map((o: any) => ({
            name: String(o?.name || '').trim(),
            price: Number(o?.price) >= 0 ? Number(o?.price) : 0
          }))
          .filter((o: any) => o.name);
        normalized.sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR'));
        return JSON.stringify(normalized);
      };

      const keyForGlobalVariation = (name: string, options: any) =>
        `${normalizeKey(name)}|${normalizeOptionsToString(options)}`;

      const globalVariationByKey = new Map<string, string>();
      try {
        const { data: existingGlobals } = await supabase
          .from('global_variations')
          .select('id,name,options')
          .eq('user_id', user?.id);
        for (const gv of (existingGlobals || []) as any[]) {
          const k = keyForGlobalVariation(String(gv?.name || ''), gv?.options);
          if (k) globalVariationByKey.set(k, String(gv.id));
        }
      } catch {}

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

            const priceVariants = (product.price_variants && product.price_variants.length > 0)
              ? product.price_variants
              : (product.variants || []);

            const normalizedPriceVariants = (priceVariants || [])
              .filter(v => v && String(v.name || '').trim())
              .map(v => ({
                name: String(v.name).trim(),
                price: Number(v.price) || 0
              }))
              .filter(v => v.price > 0);

            const effectiveBasePrice =
              Number(product.price) > 0
                ? Number(product.price)
                : (normalizedPriceVariants.length > 0
                    ? Math.min(...normalizedPriceVariants.map(v => v.price))
                    : 0);
            const normalizedImageUrl = normalizeImageUrl(product.image_url);

            const { data: newProduct, error: prodError } = await supabase
                .from('products')
                .insert({
                    user_id: user?.id,
                    name: product.name,
                    price: effectiveBasePrice,
                    description: product.description || '',
                    image_url: normalizedImageUrl,
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
                if (normalizedImageUrl) totalImages++;
                if (normalizedPriceVariants.length > 0) {
                    const variantsData = normalizedPriceVariants.map(v => ({
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

                if (product.variations && product.variations.length > 0) {
                    for (const v of product.variations || []) {
                      const groupName = String(v?.name || '').trim();
                      if (!groupName) continue;
                      const optionsString = normalizeOptionsToString(v?.options);
                      const optionsArr: any[] = (() => { try { return JSON.parse(optionsString); } catch { return []; } })();
                      if (!Array.isArray(optionsArr) || optionsArr.length === 0) continue;

                      const key = `${normalizeKey(groupName)}|${optionsString}`;
                      let globalId = globalVariationByKey.get(key);

                      if (!globalId) {
                        try {
                          const { data: created, error: createError } = await supabase
                            .from('global_variations')
                            .insert({
                              user_id: user?.id,
                              name: groupName,
                              required: Boolean(v?.required),
                              max_selections: Math.max(1, Number(v?.max_selections) || 1),
                              options: optionsString,
                              description: ''
                            })
                            .select('id')
                            .single();
                          if (!createError && created?.id) {
                            globalId = String(created.id);
                            globalVariationByKey.set(key, globalId);
                            totalAddonGroupsCreated++;
                          }
                        } catch (e) {
                          totalAddonErrors++;
                          continue;
                        }
                      }

                      if (globalId) {
                        try {
                          await (supabase as any)
                            .from('product_global_variation_links')
                            .upsert(
                              { product_id: newProduct.id, global_variation_id: globalId },
                              { onConflict: 'product_id,global_variation_id', ignoreDuplicates: true }
                            );
                          totalAddonGroupsLinked++;
                        } catch (e) {
                          totalAddonErrors++;
                        }
                      }
                    }
                }
            }
        }
      }

      const addonsSummary = `${totalAddonGroupsLinked} complementos vinculados` + (totalAddonGroupsCreated > 0 ? ` (${totalAddonGroupsCreated} novos)` : '');
      const addonsErrorsSummary = totalAddonErrors > 0 ? ` • ${totalAddonErrors} falhas em complementos` : '';
      toast({
        title: 'Importação Concluída!',
        description: `${totalProducts} produtos importados. ${totalImages} imagens. ${addonsSummary}${addonsErrorsSummary}.`,
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
          <Button
            variant="outline"
            onClick={() => {
              cancelRef.current = true;
              setLoading(false);
              setLoadingMessage('Processando...');
              onClose();
            }}
          >
            Cancelar
          </Button>
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
