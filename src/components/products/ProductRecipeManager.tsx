import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Plus, Calculator, ChevronDown, ChevronUp } from 'lucide-react';

interface RecipeItem {
  id: string;
  ingredient_id: string;
  quantity: number;
  ingredient?: {
    name: string;
    unit: string;
    cost_price: number;
  };
}

interface ProductRecipeManagerProps {
  productId: string;
}

export default function ProductRecipeManager({ productId }: ProductRecipeManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  // Novo item form
  const [selectedIngredient, setSelectedIngredient] = useState('');
  const [quantity, setQuantity] = useState('');

  useEffect(() => {
    if (user && productId && isOpen) {
      loadIngredients();
      loadRecipe();
    }
  }, [user, productId, isOpen]);

  const loadIngredients = async () => {
    const { data } = await supabase
      .from('ingredients')
      .select('id, name, unit, cost_price')
      .eq('user_id', user?.id)
      .order('name');
    setIngredients(data || []);
  };

  const loadRecipe = async () => {
    const { data } = await supabase
      .from('product_recipes')
      .select(`
        id, 
        ingredient_id, 
        quantity,
        ingredient:ingredients(name, unit, cost_price)
      `)
      .eq('product_id', productId);
    setRecipeItems(data || []);
    setLoading(false);
  };

  const handleAddItem = async () => {
    if (!selectedIngredient || !quantity || isNaN(Number(quantity))) {
      toast({ title: 'Erro', description: 'Selecione um insumo e informe a quantidade válida.', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase
        .from('product_recipes')
        .insert({
          product_id: productId,
          ingredient_id: selectedIngredient,
          quantity: Number(quantity)
        });

      if (error) throw error;
      
      setSelectedIngredient('');
      setQuantity('');
      loadRecipe();
      toast({ title: 'Adicionado', description: 'Insumo adicionado à ficha técnica.' });
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível adicionar o insumo.', variant: 'destructive' });
    }
  };

  const handleRemoveItem = async (id: string) => {
    try {
      const { error } = await supabase.from('product_recipes').delete().eq('id', id);
      if (error) throw error;
      loadRecipe();
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível remover o insumo.', variant: 'destructive' });
    }
  };

  const totalCost = recipeItems.reduce((acc, item) => {
    const cost = item.ingredient?.cost_price || 0;
    return acc + (cost * item.quantity);
  }, 0);

  return (
    <div className="bg-boracume-light/30 p-4 rounded-2xl border border-boracume-light mt-3">
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-boracume-orange" />
          <span className="font-semibold text-boracume-dark-green">Ficha Técnica e Custos (CMV)</span>
        </div>
        {isOpen ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
      </button>

      {isOpen && (
        <div className="pt-4 mt-2 border-t border-gray-100 space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Insumo</Label>
              <Select value={selectedIngredient} onValueChange={setSelectedIngredient}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {ingredients.map(ing => (
                    <SelectItem key={ing.id} value={ing.id}>
                      {ing.name} (R$ {ing.cost_price}/{ing.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-24 space-y-1">
              <Label className="text-xs">Qtd.</Label>
              <Input 
                type="number" 
                step="0.001" 
                min="0"
                value={quantity} 
                onChange={e => setQuantity(e.target.value)} 
                className="bg-white"
                placeholder="0.00"
              />
            </div>
            <Button type="button" onClick={handleAddItem} className="bg-boracume-green hover:bg-boracume-green/90">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {loading ? (
            <div className="text-center text-sm text-gray-500 py-4">Carregando ficha técnica...</div>
          ) : recipeItems.length === 0 ? (
            <div className="text-center text-sm text-gray-500 py-4 border border-dashed rounded-lg bg-white">
              Nenhum insumo cadastrado na ficha técnica.
            </div>
          ) : (
            <div className="space-y-2">
              {recipeItems.map(item => (
                <div key={item.id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{item.ingredient?.name}</div>
                    <div className="text-xs text-gray-500">
                      {item.quantity} {item.ingredient?.unit} x R$ {item.ingredient?.cost_price}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="font-semibold text-sm">
                      R$ {((item.ingredient?.cost_price || 0) * item.quantity).toFixed(2)}
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => handleRemoveItem(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              
              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border mt-2">
                <span className="font-semibold text-gray-700">Custo Total de Produção:</span>
                <span className="font-bold text-lg text-red-600">R$ {totalCost.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
