
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Search, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import ProductForm from '@/components/products/ProductForm';
import BannerManager from '@/components/banners/BannerManager';
import ProductVariationsButton from '@/components/products/ProductVariationsButton';
import GlobalVariationManager from '@/components/products/GlobalVariationManager';

// Using the same ProductItem interface definition as in ProductForm.tsx to ensure consistency
interface ProductItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  category_id?: string;
  image_url?: string;
  available: boolean;
  weight_based: boolean; // Ensuring this is not optional
  send_to_kds: boolean; // Making this required to match ProductForm.tsx
  show_in_pdv: boolean;
  show_in_delivery: boolean;
}

interface Category {
  id: string;
  name: string;
}

const Products = () => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    filterProducts();
  }, [products, searchQuery, selectedCategory]);

  const fetchData = async () => {
    await Promise.all([fetchProducts(), fetchCategories()]);
  };

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user?.id)
        .order('name');
      
      if (error) throw error;
      
      // Transform data to ensure category field is present and add default values for missing fields
      const transformedProducts = (data || []).map(product => ({
        ...product,
        category: product.category || 'Sem categoria', // Ensure category is always present
        show_in_pdv: product.show_in_pdv !== undefined ? product.show_in_pdv : true,
        show_in_delivery: product.show_in_delivery !== undefined ? product.show_in_delivery : true,
        weight_based: product.weight_based !== undefined ? product.weight_based : false, // Ensure weight_based is always present
        send_to_kds: product.send_to_kds !== undefined ? product.send_to_kds : false // Ensure send_to_kds is always present
      })) as ProductItem[];
      
      setProducts(transformedProducts);
    } catch (error: any) {
      console.error('Erro ao carregar produtos:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os produtos.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

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

  const filterProducts = () => {
    let filtered = products;

    if (searchQuery) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category_id === selectedCategory);
    }

    setFilteredProducts(filtered);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;

    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);
      
      if (error) throw error;
      
      toast({
        title: 'Produto excluído',
        description: 'O produto foi excluído com sucesso.',
      });
      
      fetchProducts();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir produto',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditProduct = (product: ProductItem) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleFormSubmit = async (savedProductId?: string) => {
    await fetchProducts();
    if (savedProductId) {
      // Recarrega o produto salvo e reabre o formulário para garantir vínculo das variações globais
      const produtoSalvo = products.find(p => p.id === savedProductId);
      if (produtoSalvo) {
        setEditingProduct(produtoSalvo);
        setShowForm(true);
        return;
      }
    }
    
    setShowForm(false);
    setEditingProduct(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return 'Sem categoria';
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Categoria não encontrada';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Package className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">Produtos</h1>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Package className="h-4 w-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      <Tabs defaultValue="products" className="w-full">
        <TabsList>
          <TabsTrigger value="products">Produtos</TabsTrigger>
          <TabsTrigger value="global-variations">Variações Globais</TabsTrigger>
          <TabsTrigger value="banners">Banners</TabsTrigger>
        </TabsList>
        
        <TabsContent value="products" className="space-y-6">
          {showForm ? (
            <ProductForm
              product={editingProduct}
              onSave={handleFormSubmit}
              onCancel={() => {
                setShowForm(false);
                setEditingProduct(null);
              }}
            />
          ) : (
            <>
              {/* Filtros */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          placeholder="Buscar produtos..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant={selectedCategory === 'all' ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedCategory('all')}
                      >
                        Todos
                      </Button>
                      {categories.map(category => (
                        <Button
                          key={category.id}
                          variant={selectedCategory === category.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedCategory(category.id)}
                        >
                          {category.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Lista de Produtos */}
              {filteredProducts.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-lg font-medium mb-2">Nenhum produto encontrado</p>
                    <p className="text-muted-foreground mb-4">
                      {searchQuery || selectedCategory !== 'all'
                        ? 'Tente ajustar os filtros ou buscar por outros termos.'
                        : 'Comece criando seu primeiro produto.'}
                    </p>
                    <Button onClick={() => setShowForm(true)}>
                      <Package className="h-4 w-4 mr-2" />
                      Criar Produto
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProducts.map((product) => (
                    <Card key={product.id} className="overflow-hidden">
                      {product.image_url && (
                        <div className="aspect-video w-full overflow-hidden">
                          <img 
                            src={product.image_url} 
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg">{product.name}</CardTitle>
                          <Badge variant={product.available ? "default" : "secondary"}>
                            {product.available ? 'Disponível' : 'Indisponível'}
                          </Badge>
                        </div>
                        {product.description && (
                          <p className="text-gray-600 text-sm line-clamp-2">{product.description}</p>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-2xl font-bold text-primary">
                            {formatCurrency(product.price)}
                            {product.weight_based && <span className="text-xs text-gray-500 ml-1">/kg</span>}
                          </span>
                          <Badge variant="outline">{getCategoryName(product.category_id)}</Badge>
                        </div>

                        {/* Status badges */}
                        <div className="flex flex-wrap gap-1 mb-3">
                          {product.show_in_delivery && (
                            <Badge variant="outline" className="text-xs">Delivery</Badge>
                          )}
                          {product.show_in_pdv && (
                            <Badge variant="outline" className="text-xs">PDV</Badge>
                          )}
                          {product.send_to_kds && (
                            <Badge variant="outline" className="text-xs">KDS</Badge>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleEditProduct(product)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          
                          <ProductVariationsButton productId={product.id} />
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteProduct(product.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>
        
        <TabsContent value="global-variations">
          <GlobalVariationManager />
        </TabsContent>
        
        <TabsContent value="banners">
          <BannerManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Products;
