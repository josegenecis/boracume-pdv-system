
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Package, Search, Plus, ArrowLeft } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import ProductForm from '@/components/products/ProductForm';

// Sample product data
const products = [
  {
    id: '1',
    name: 'X-Burger Especial',
    description: 'Hambúrguer artesanal, queijo cheddar, bacon, alface, tomate e molho especial',
    price: 29.90,
    category: 'hamburgers',
    image: 'https://via.placeholder.com/150',
    available: true,
  },
  {
    id: '2',
    name: 'Pizza Margherita',
    description: 'Molho de tomate, mussarela, tomate e manjericão',
    price: 45.90,
    category: 'pizzas',
    image: 'https://via.placeholder.com/150',
    available: true,
  },
  {
    id: '3',
    name: 'Refrigerante Cola 2L',
    description: 'Refrigerante sabor cola',
    price: 12.90,
    category: 'drinks',
    image: 'https://via.placeholder.com/150',
    available: true,
  },
  {
    id: '4',
    name: 'Sorvete de Chocolate',
    description: 'Sorvete cremoso de chocolate com calda',
    price: 15.90,
    category: 'desserts',
    image: 'https://via.placeholder.com/150',
    available: false,
  }
];

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const ProductCard: React.FC<{ product: typeof products[0]; onEdit: (id: string) => void }> = ({ product, onEdit }) => {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-video relative overflow-hidden">
        <img 
          src={product.image} 
          alt={product.name} 
          className="object-cover w-full h-full"
        />
        {!product.available && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <Badge variant="destructive" className="text-sm">Indisponível</Badge>
          </div>
        )}
      </div>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-lg">{product.name}</CardTitle>
        <CardDescription className="line-clamp-2">{product.description}</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="font-bold text-lg text-boracume-orange">{formatCurrency(product.price)}</p>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button variant="outline" className="w-full" onClick={() => onEdit(product.id)}>
          Editar
        </Button>
      </CardFooter>
    </Card>
  );
};

const Products = () => {
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  
  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const handleEdit = (id: string) => {
    setEditingProduct(id);
    setShowForm(true);
  };
  
  const handleAddNew = () => {
    setEditingProduct(null);
    setShowForm(true);
  };
  
  const handleBack = () => {
    setShowForm(false);
    setEditingProduct(null);
  };
  
  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {editingProduct ? 'Editar Produto' : 'Novo Produto'}
          </h1>
        </div>
        
        <ProductForm editMode={!!editingProduct} />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Produtos</h1>
        <Button onClick={handleAddNew}>
          <Plus size={18} className="mr-2" /> Novo Produto
        </Button>
      </div>
      
      <div className="flex gap-2 relative">
        <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
        <Input 
          placeholder="Buscar produtos..." 
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="hamburgers">Hambúrgueres</TabsTrigger>
          <TabsTrigger value="pizzas">Pizzas</TabsTrigger>
          <TabsTrigger value="drinks">Bebidas</TabsTrigger>
          <TabsTrigger value="desserts">Sobremesas</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-6">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <Package size={48} className="mx-auto text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">Nenhum produto encontrado</h3>
              <p className="text-muted-foreground">
                Tente ajustar sua busca ou adicione novos produtos.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map((product) => (
                <ProductCard 
                  key={product.id} 
                  product={product}
                  onEdit={handleEdit}
                />
              ))}
            </div>
          )}
        </TabsContent>
        
        {/* Conteúdo das outras abas seria filtrado por categoria */}
        <TabsContent value="hamburgers" className="mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts
              .filter(p => p.category === 'hamburgers')
              .map((product) => (
                <ProductCard 
                  key={product.id} 
                  product={product}
                  onEdit={handleEdit}
                />
              ))}
          </div>
        </TabsContent>
        
        {/* Outras abas seguiriam o mesmo padrão */}
      </Tabs>
    </div>
  );
};

export default Products;
