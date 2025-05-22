
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
import { Plus, Minus, ImageIcon } from 'lucide-react';

interface ProductOption {
  id: string;
  name: string;
  price: number;
}

interface ProductFormProps {
  editMode?: boolean;
  onSubmit?: (data: any) => void;
}

const ProductForm: React.FC<ProductFormProps> = ({ 
  editMode = false,
  onSubmit,
}) => {
  const [options, setOptions] = useState<ProductOption[]>([
    { id: '1', name: '', price: 0 }
  ]);
  
  const handleAddOption = () => {
    setOptions([...options, { id: Date.now().toString(), name: '', price: 0 }]);
  };
  
  const handleRemoveOption = (id: string) => {
    if (options.length > 1) {
      setOptions(options.filter(option => option.id !== id));
    }
  };
  
  const handleOptionChange = (id: string, field: 'name' | 'price', value: string) => {
    setOptions(options.map(option => {
      if (option.id === id) {
        return { 
          ...option, 
          [field]: field === 'price' ? parseFloat(value) || 0 : value 
        };
      }
      return option;
    }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Form submission logic
    if (onSubmit) {
      // Get form data and pass it to onSubmit
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
                <Input id="name" placeholder="Ex: X-Burger Especial" />
              </div>
              
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea 
                  id="description" 
                  placeholder="Descreva os principais ingredientes e características do produto"
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="category">Categoria</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hamburgers">Hambúrgueres</SelectItem>
                    <SelectItem value="pizzas">Pizzas</SelectItem>
                    <SelectItem value="drinks">Bebidas</SelectItem>
                    <SelectItem value="desserts">Sobremesas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Preço (R$)</Label>
                  <Input id="price" type="number" min="0" step="0.01" placeholder="0,00" />
                </div>
                <div>
                  <Label htmlFor="cost">Custo (R$)</Label>
                  <Input id="cost" type="number" min="0" step="0.01" placeholder="0,00" />
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch id="available" />
                <Label htmlFor="available">Disponível para venda</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch id="featured" />
                <Label htmlFor="featured">Produto em destaque</Label>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label>Imagem do Produto</Label>
                <div className="mt-1 border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center h-[200px] bg-muted/50">
                  <ImageIcon className="h-10 w-10 text-muted-foreground mb-2" />
                  <div className="text-sm text-center text-muted-foreground">
                    Arraste uma imagem ou clique para fazer upload
                  </div>
                  <Button variant="outline" size="sm" className="mt-4">
                    Selecionar Imagem
                  </Button>
                </div>
              </div>
              
              <Separator className="my-4" />
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Opções/Variações</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={handleAddOption}
                  >
                    <Plus size={16} className="mr-1" /> Adicionar
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {options.map((option, index) => (
                    <div key={option.id} className="flex gap-2 items-start">
                      <div className="flex-1">
                        <Input 
                          placeholder="Nome da opção" 
                          value={option.name}
                          onChange={(e) => handleOptionChange(option.id, 'name', e.target.value)}
                        />
                      </div>
                      <div className="w-24">
                        <Input 
                          type="number" 
                          min="0" 
                          step="0.01" 
                          placeholder="Preço" 
                          value={option.price || ''}
                          onChange={(e) => handleOptionChange(option.id, 'price', e.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveOption(option.id)}
                        disabled={options.length <= 1}
                      >
                        <Minus size={16} className="text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end space-x-2">
          <Button variant="outline" type="button">Cancelar</Button>
          <Button type="submit">{editMode ? 'Atualizar' : 'Criar'} Produto</Button>
        </CardFooter>
      </Card>
    </form>
  );
};

export default ProductForm;
