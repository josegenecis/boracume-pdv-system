
import React, { useState } from 'react';
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
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Plus, Minus, ImageIcon, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ProductOption {
  id: string;
  name: string;
  price: number;
}

interface ProductFormProps {
  editMode?: boolean;
  onSubmit?: (data: any) => void;
  productData?: any;
}

const ProductForm: React.FC<ProductFormProps> = ({ 
  editMode = false,
  onSubmit,
  productData
}) => {
  const [formData, setFormData] = useState({
    name: productData?.name || '',
    description: productData?.description || '',
    category: productData?.category || '',
    price: productData?.price || '',
    available: productData?.available ?? true,
    featured: false,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(productData?.image_url || '');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (error) {
      console.error('Erro ao fazer upload da imagem:', error);
      toast({
        title: "Erro",
        description: "Não foi possível fazer upload da imagem.",
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

    try {
      setLoading(true);
      
      let imageUrl = productData?.image_url || '';
      
      if (imageFile) {
        const uploadedUrl = await uploadImage(imageFile);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }

      const productPayload = {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        price: parseFloat(formData.price),
        available: formData.available,
        image_url: imageUrl,
        user_id: user.id
      };

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
        throw result.error;
      }

      toast({
        title: "Sucesso!",
        description: `Produto ${editMode ? 'atualizado' : 'criado'} com sucesso.`,
      });

      if (onSubmit) {
        onSubmit(result.data?.[0]);
      }
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o produto.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
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
                <Label htmlFor="name">Nome do Produto</Label>
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
                <Label htmlFor="category">Categoria</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hamburgers">Hambúrgueres</SelectItem>
                    <SelectItem value="pizzas">Pizzas</SelectItem>
                    <SelectItem value="drinks">Bebidas</SelectItem>
                    <SelectItem value="desserts">Sobremesas</SelectItem>
                    <SelectItem value="appetizers">Petiscos</SelectItem>
                    <SelectItem value="mains">Pratos Principais</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="price">Preço (R$)</Label>
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
                <div className="mt-1 border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center h-[200px] bg-muted/50">
                  {imagePreview ? (
                    <div className="relative w-full h-full">
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        className="w-full h-full object-cover rounded"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="absolute bottom-2 right-2"
                        onClick={() => {
                          setImagePreview('');
                          setImageFile(null);
                        }}
                      >
                        Remover
                      </Button>
                    </div>
                  ) : (
                    <>
                      <ImageIcon className="h-10 w-10 text-muted-foreground mb-2" />
                      <div className="text-sm text-center text-muted-foreground">
                        Arraste uma imagem ou clique para fazer upload
                      </div>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                        id="image-upload"
                      />
                      <Label htmlFor="image-upload" asChild>
                        <Button variant="outline" size="sm" className="mt-4" type="button">
                          <Upload className="w-4 h-4 mr-2" />
                          Selecionar Imagem
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
          <Button variant="outline" type="button">Cancelar</Button>
          <Button type="submit" disabled={loading || uploading}>
            {loading || uploading ? 'Salvando...' : (editMode ? 'Atualizar' : 'Criar')} Produto
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
};

export default ProductForm;
