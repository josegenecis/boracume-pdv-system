
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ChefHat, Store, CheckCircle } from 'lucide-react';

const onboardingSchema = z.object({
  restaurantType: z.string().min(1, 'Tipo de restaurante é obrigatório'),
  address: z.string().min(5, 'Endereço é obrigatório'),
  phone: z.string().min(10, 'Telefone é obrigatório'),
  openingHours: z.string().min(1, 'Horário de funcionamento é obrigatório'),
  applyToAllDays: z.boolean().default(true),
  closedDay: z.string().optional(),
  description: z.string().optional(),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

interface OnboardingWizardProps {
  onComplete: () => void;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      restaurantType: '',
      address: '',
      phone: '',
      openingHours: '10:00 - 22:00',
      applyToAllDays: true,
      closedDay: 'none',
      description: '',
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

  const daysOfWeek = [
    { value: 'none', label: 'Não fecho (Aberto todos os dias)' },
    { value: 'seg', label: 'Segunda-feira' },
    { value: 'ter', label: 'Terça-feira' },
    { value: 'qua', label: 'Quarta-feira' },
    { value: 'qui', label: 'Quinta-feira' },
    { value: 'sex', label: 'Sexta-feira' },
    { value: 'sab', label: 'Sábado' },
    { value: 'dom', label: 'Domingo' },
  ];

  const onSubmit = async (values: OnboardingFormValues) => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Build opening hours string based on selection
      let openingHoursFinal = values.openingHours;
      if (values.applyToAllDays) {
        openingHoursFinal = `Seg-Dom: ${values.openingHours}`;
        if (values.closedDay && values.closedDay !== 'none') {
           openingHoursFinal += ` (Fechado: ${daysOfWeek.find(d => d.value === values.closedDay)?.label})`;
        }
      }

      // Update or Create profile with restaurant info
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          // restaurant_name is removed as per request, using existing profile name or keeping it as is
          // If no restaurant name exists, fallback to 'Restaurante' to satisfy constraints if any
          restaurant_name: profile?.restaurant_name || 'Restaurante',
          address: values.address,
          phone: values.phone,
          opening_hours: openingHoursFinal,
          description: values.description,
          onboarding_completed: true,
          updated_at: new Date().toISOString()
        })
        .select();

      if (profileError) throw profileError;

      // Force profile refresh immediately after update
      await onComplete();
      
      // Create default categories using product_categories table
      const defaultCategories = [
        { name: 'Pratos Principais', description: 'Pratos principais do cardápio' },
        { name: 'Bebidas', description: 'Bebidas variadas' },
        { name: 'Sobremesas', description: 'Doces e sobremesas' },
      ];

      const categoryIds: Record<string, string> = {};

      for (const category of defaultCategories) {
        const { data: newCat } = await supabase
          .from('product_categories')
          .insert({
            ...category,
            user_id: user.id,
          })
          .select('id')
          .single();
        
        if (newCat) {
          categoryIds[category.name] = newCat.id;
        }
      }

      // Create default delivery zone
      await supabase
        .from('delivery_zones')
        .insert({
          user_id: user.id,
          name: 'Região Central',
          delivery_fee: 5.00,
          minimum_order: 25.00,
          delivery_time: '30-45 min',
          active: true
        });

      // Create sample products based on restaurant type
      if (values.restaurantType === 'Pizzaria') {
        await createSampleProducts(user.id, 'pizza', categoryIds);
      } else if (values.restaurantType === 'Hamburgueria') {
        await createSampleProducts(user.id, 'burger', categoryIds);
      } else {
        await createSampleProducts(user.id, 'general', categoryIds);
      }

      // Create default WhatsApp settings
      await supabase
        .from('whatsapp_settings')
        .insert({
          user_id: user.id,
          phone_number: values.phone,
          default_message: `Olá! Bem-vindo ao ${profile?.restaurant_name || 'Restaurante'}. Como posso ajudar você hoje?`,
          enabled: true
        });

      toast({
        title: 'Configuração concluída!',
        description: 'Seu restaurante foi configurado com sucesso. Você já pode começar a receber pedidos!',
      });
      
      // onComplete already called above before reload
      // Force reload only after all operations are complete
      window.location.reload();
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

  const createSampleProducts = async (userId: string, type: string, categoryIds: Record<string, string>) => {
    const sampleProducts = {
      pizza: [
        { name: 'Pizza Margherita', price: 25.90, description: 'Molho de tomate, mussarela e manjericão', category: 'Pratos Principais' },
        { name: 'Pizza Pepperoni', price: 29.90, description: 'Molho de tomate, mussarela e pepperoni', category: 'Pratos Principais' },
        { name: 'Refrigerante Lata', price: 4.50, description: 'Refrigerante gelado 350ml', category: 'Bebidas' },
      ],
      burger: [
        { name: 'Hambúrguer Clássico', price: 18.90, description: 'Pão, carne, queijo, alface e tomate', category: 'Pratos Principais' },
        { name: 'Batata Frita', price: 8.90, description: 'Porção de batata frita crocante', category: 'Pratos Principais' },
        { name: 'Refrigerante Lata', price: 4.50, description: 'Refrigerante gelado 350ml', category: 'Bebidas' },
      ],
      general: [
        { name: 'Prato do Dia', price: 15.90, description: 'Prato especial do dia', category: 'Pratos Principais' },
        { name: 'Refrigerante Lata', price: 4.50, description: 'Refrigerante gelado 350ml', category: 'Bebidas' },
        { name: 'Pudim', price: 6.90, description: 'Pudim de leite condensado', category: 'Sobremesas' },
      ]
    };

    const products = sampleProducts[type as keyof typeof sampleProducts] || sampleProducts.general;
    
    for (const product of products) {
      const categoryId = categoryIds[product.category];
      if (!categoryId) continue;

      // Remove category string field and use category_id
      const { category, ...productData } = product;

      await supabase
        .from('products')
        .insert({
          ...productData,
          category: product.category, // Keep original category name as string for compatibility
          category_id: categoryId,
          user_id: userId,
          available: true,
          show_in_delivery: true,
          show_in_pdv: true,
        });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-300">
        <CardHeader className="text-center sticky top-0 bg-white z-10 border-b">
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

                <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <FormField
                    control={form.control}
                    name="openingHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horário de Funcionamento</FormLabel>
                        <FormControl>
                          <Input placeholder="10:00 - 22:00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="applyToAllDays"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-2 shadow-sm bg-white">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Aplicar este horário para todos os dias
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="closedDay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dia de Folga (Loja Fechada)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o dia de folga" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {daysOfWeek.map((day) => (
                              <SelectItem key={day.value} value={day.value}>
                                {day.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição (Opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Breve descrição do seu restaurante" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button type="submit" disabled={isLoading} className="w-full sm:w-auto bg-boracume-orange hover:bg-orange-600">
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
