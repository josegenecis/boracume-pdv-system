
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ChefHat, Store, CheckCircle } from 'lucide-react';

const onboardingSchema = z.object({
  restaurantName: z.string().min(2, 'Nome do restaurante é obrigatório'),
  restaurantType: z.string().min(1, 'Tipo de restaurante é obrigatório'),
  address: z.string().min(5, 'Endereço é obrigatório'),
  phone: z.string().min(10, 'Telefone é obrigatório'),
  deliveryEnabled: z.boolean().default(false),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

interface OnboardingWizardProps {
  onComplete: () => void;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      restaurantName: '',
      restaurantType: '',
      address: '',
      phone: '',
      deliveryEnabled: false,
    },
  });

  const restaurantTypes = [
    'Restaurante',
    'Lanchonete',
    'Pizzaria',
    'Hamburgueria',
    'Sorveteria',
    'Padaria',
    'Confeitaria',
    'Bar',
    'Cafeteria',
    'Outro'
  ];

  const onSubmit = async (values: OnboardingFormValues) => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Update profile with restaurant info
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          restaurant_name: values.restaurantName,
          address: values.address,
          phone: values.phone,
          onboarding_completed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Create default categories using product_categories table
      const defaultCategories = [
        { name: 'Pratos Principais', description: 'Pratos principais do cardápio' },
        { name: 'Bebidas', description: 'Bebidas variadas' },
        { name: 'Sobremesas', description: 'Doces e sobremesas' },
      ];

      for (const category of defaultCategories) {
        await supabase
          .from('product_categories')
          .insert({
            ...category,
            user_id: user.id,
          });
      }

      // Create sample products based on restaurant type
      if (values.restaurantType === 'Pizzaria') {
        await createSampleProducts(user.id, 'pizza');
      } else if (values.restaurantType === 'Hamburgueria') {
        await createSampleProducts(user.id, 'burger');
      } else {
        await createSampleProducts(user.id, 'general');
      }

      toast({
        title: 'Configuração concluída!',
        description: 'Seu restaurante foi configurado com sucesso.',
      });

      onComplete();
    } catch (error: any) {
      toast({
        title: 'Erro na configuração',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createSampleProducts = async (userId: string, type: string) => {
    const sampleProducts = {
      pizza: [
        { name: 'Pizza Margherita', price: 25.90, description: 'Molho de tomate, mussarela e manjericão', category: 'Pratos Principais' },
        { name: 'Pizza Pepperoni', price: 29.90, description: 'Molho de tomate, mussarela e pepperoni', category: 'Pratos Principais' },
      ],
      burger: [
        { name: 'Hambúrguer Clássico', price: 18.90, description: 'Pão, carne, queijo, alface e tomate', category: 'Pratos Principais' },
        { name: 'Batata Frita', price: 8.90, description: 'Porção de batata frita crocante', category: 'Pratos Principais' },
      ],
      general: [
        { name: 'Prato do Dia', price: 15.90, description: 'Prato especial do dia', category: 'Pratos Principais' },
        { name: 'Refrigerante', price: 4.50, description: 'Refrigerante gelado', category: 'Bebidas' },
      ]
    };

    const products = sampleProducts[type as keyof typeof sampleProducts] || sampleProducts.general;
    
    for (const product of products) {
      await supabase
        .from('products')
        .insert({
          ...product,
          user_id: userId,
          available: true,
        });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-boracume-orange to-amber-500 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <ChefHat className="w-12 h-12 text-boracume-orange" />
          </div>
          <CardTitle className="text-2xl">Bem-vindo ao BoraCumê!</CardTitle>
          <CardDescription>
            Vamos configurar seu restaurante em alguns passos simples
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="mb-8">
            <div className="flex items-center justify-center mb-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-boracume-orange text-white">
                <Store className="w-5 h-5" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="font-semibold">Informações do Restaurante</h3>
              <p className="text-sm text-gray-600">Vamos começar com as informações básicas</p>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="restaurantName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Restaurante</FormLabel>
                      <FormControl>
                        <Input placeholder="Digite o nome do seu restaurante" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="restaurantType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Restaurante</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {restaurantTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço</FormLabel>
                      <FormControl>
                        <Input placeholder="Endereço completo do restaurante" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input placeholder="(11) 99999-9999" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Configurando...' : 'Concluir Configuração'}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingWizard;
