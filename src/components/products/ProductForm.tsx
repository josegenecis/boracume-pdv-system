
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ImageIcon, Upload, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ProductFormProps {
  editMode?: boolean;
  onSubmit?: (data: any) => void;
  productData?: any;
  onClose?: () => void;
}

interface Category {
  id: string;
  name: string;
}

const ProductForm: React.FC<ProductFormProps> = ({ 
  editMode = false,
  onSubmit,
  productData,
  onClose
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    name: productData?.name || '',
    description: productData?.description || '',
    category_id: productData?.category_id || '',
    price: productData?.price || '',
    available: productData?.available ?? true,
    weight_based: productData?.weight_based || false,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(productData?.image_url || '');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchCategories();
    }
  }, [user]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('id, name')
        .eq('user_id', user?.id)
        .eq('active', true)
        .order('display_order');

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar categorias:', error);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Erro",
          description: "Por favor, selecione apenas arquivos de imagem.",
          variant: "destructive"
        });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Erro",
          description: "A imagem deve ter no máximo 5MB.",
          variant: "destructive"
        });
        return;
      }

      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);
      
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      console.log('Fazendo upload da imagem:', fileName);
      console.log('Tamanho do arquivo:', file.size);
      console.log('Tipo do arquivo:', file.type);
      
      // Primeiro, fazer o upload da imagem
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        });

      if (uploadError) {
        console.error('Erro no upload:', uploadError);
        throw uploadError;
      }

      console.log('Upload realizado com sucesso:', uploadData);

      // Obter a URL pública da imagem
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      console.log('URL pública obtida:', urlData.publicUrl);
      
      return urlData.publicUrl;
    } catch (error: any) {
      console.error('Erro ao fazer upload da imagem:', error);
      toast({
        title: "Erro no upload",
        description: error.message || "Não foi possível fazer upload da imagem.",
        variant: "destructive"
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado para salvar produtos.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.name || !formData.category_id || !formData.price) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      
      let imageUrl = productData?.image_url || '';
      
      // Upload da imagem se uma nova foi selecionada
      if (imageFile) {
        console.log('Fazendo upload de nova imagem...');
        const uploadedUrl = await uploadImage(imageFile);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
          console.log('URL da imagem atualizada:', imageUrl);
        } else {
          console.error('Falha no upload da imagem');
          return; // Para a execução se o upload falhar
        }
      }

      // Encontrar o nome da categoria para o campo category (obrigatório)
      const selectedCategory = categories.find(cat => cat.id === formData.category_id);
      const categoryName = selectedCategory?.name || 'Sem categoria';

      const productPayload = {
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        category: categoryName, // Campo obrigatório
        category_id: formData.category_id,
        price: parseFloat(formData.price),
        available: formData.available,
        weight_based: formData.weight_based,
        image_url: imageUrl || null,
        user_id: user.id
      };

      console.log('Salvando produto:', productPayload);

      let result;
      if (editMode && productData?.id) {
        result = await supabase
          .from('products')
          .update(productPayload)
          .eq('id', productData.id)
          .select();
      } else {
        result = await supabase
          .from('products')
          .insert([productPayload])
          .select();
      }

      if (result.error) {
        console.error('Erro ao salvar produto:', result.error);
        throw result.error;
      }

      console.log('Produto salvo com sucesso:', result.data);

      toast({
        title: "Sucesso!",
        description: `Produto ${editMode ? 'atualizado' : 'criado'} com sucesso.`,
      });

      if (onSubmit) {
        onSubmit(result.data?.[0]);
      }

      if (onClose) {
        onClose();
      }

      if (!editMode) {
        setFormData({
          name: '',
          description: '',
          category_id: '',
          price: '',
          available: true,
          weight_based: false,
        });
        setImageFile(null);
        setImagePreview('');
      }
    } catch (error: any) {
      console.error('Erro ao salvar produto:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar o produto.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview('');
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{editMode ? 'Editar Produto' : 'Novo Produto'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome do Produto *</Label>
                <Input 
                  id="name" 
                  placeholder="Ex: X-Burger Especial" 
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea 
                  id="description" 
                  placeholder="Descreva os principais ingredientes e características do produto"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              
              <div>
                <Label htmlFor="category">Categoria *</Label>
                <Select value={formData.category_id} onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="price">Preço (R$) *</Label>
                <Input 
                  id="price" 
                  type="number" 
                  min="0" 
                  step="0.01" 
                  placeholder="0,00"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  required
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch 
                  id="weight_based" 
                  checked={formData.weight_based}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, weight_based: checked }))}
                />
                <Label htmlFor="weight_based">Produto vendido por peso</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch 
                  id="available" 
                  checked={formData.available}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, available: checked }))}
                />
                <Label htmlFor="available">Disponível para venda</Label>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label>Imagem do Produto</Label>
                <div className="mt-1 border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center h-[200px] bg-muted/50 relative">
                  {imagePreview ? (
                    <div className="relative w-full h-full">
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        className="w-full h-full object-cover rounded"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={removeImage}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <ImageIcon className="h-10 w-10 text-muted-foreground mb-2" />
                      <div className="text-sm text-center text-muted-foreground mb-4">
                        Arraste uma imagem ou clique para fazer upload
                      </div>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                        id="image-upload"
                        disabled={uploading}
                      />
                      <Label htmlFor="image-upload" asChild>
                        <Button variant="outline" size="sm" type="button" disabled={uploading}>
                          <Upload className="w-4 h-4 mr-2" />
                          {uploading ? 'Enviando...' : 'Selecionar Imagem'}
                        </Button>
                      </Label>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end space-x-2">
          {onClose && (
            <Button variant="outline" type="button" onClick={onClose}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={loading || uploading}>
            {loading ? 'Salvando...' : (editMode ? 'Atualizar' : 'Criar')} Produto
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
};

export default ProductForm;
