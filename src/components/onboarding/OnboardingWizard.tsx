
import React, { useState } from 'react';
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
import { ChefHat, Store, CheckCircle, Utensils, Wand2, Plus } from 'lucide-react';
import MenuImportModal from '../products/MenuImportModal';

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
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
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

  const handleStep1Submit = async (values: OnboardingFormValues) => {
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
          restaurant_name: profile?.restaurant_name || 'Restaurante',
          address: values.address,
          phone: values.phone,
          opening_hours: openingHoursFinal,
          description: values.description,
          // Don't set onboarding_completed yet, wait for step 2
          updated_at: new Date().toISOString()
        })
        .select();

      if (profileError) throw profileError;

      // Create default WhatsApp settings immediately (Non-blocking)
      try {
        await supabase
          .from('whatsapp_settings')
          .upsert({
            user_id: user.id,
            phone_number: values.phone,
            default_message: `Olá! Bem-vindo ao ${profile?.restaurant_name || 'Restaurante'}. Como posso ajudar você hoje?`,
            enabled: true
          });
      } catch (wsError) {
        console.error('Error creating whatsapp settings:', wsError);
        // Continue anyway
      }

      // Move to Step 2
      setStep(2);
      
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Erro na configuração',
        description: error.message || 'Verifique os campos obrigatórios',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const onInvalid = (errors: any) => {
    console.error("Form errors:", errors);
    toast({
      title: 'Campos inválidos',
      description: 'Por favor, preencha todos os campos obrigatórios.',
      variant: 'destructive',
    });
  };

  const finishWizard = async () => {
    try {
       // Mark onboarding as completed in DB
       if (user) {
         await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id);
       }
       
       await onComplete();
       window.location.reload();
    } catch (error) {
       console.error(error);
    }
  };

  const createSampleProducts = async (type: string) => {
    if (!user) return;
    setIsLoading(true);
    try {
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

      // Sample Data Logic
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

      // Determine key for sample products
      let typeKey = 'general';
      if (type.toLowerCase().includes('pizza')) typeKey = 'pizza';
      if (type.toLowerCase().includes('hamburguer') || type.toLowerCase().includes('burger')) typeKey = 'burger';

      const products = sampleProducts[typeKey as keyof typeof sampleProducts] || sampleProducts.general;
      
      for (const product of products) {
        const categoryId = categoryIds[product.category];
        if (!categoryId) continue;

        const { category, ...productData } = product;

        await supabase
          .from('products')
          .insert({
            ...productData,
            category: product.category,
            category_id: categoryId,
            user_id: user.id,
            available: true,
            show_in_delivery: true,
            show_in_pdv: true,
          });
      }

      toast({
        title: 'Cardápio criado!',
        description: 'Produtos de exemplo foram adicionados.',
      });
      
      await finishWizard();

    } catch (error: any) {
      toast({
        title: 'Erro ao criar cardápio',
        description: error.message,
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  const handleManualStart = async () => {
     // Just create basic categories but no products, or simply finish
     // Let's create basic categories to help user
     if (!user) return;
     setIsLoading(true);
     try {
        const defaultCategories = [
            { name: 'Pratos Principais', description: 'Pratos principais do cardápio' },
            { name: 'Bebidas', description: 'Bebidas variadas' },
        ];
        for (const category of defaultCategories) {
            await supabase.from('product_categories').insert({ ...category, user_id: user.id });
        }
        await finishWizard();
     } catch (error) {
        await finishWizard();
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
            {step === 1 ? 'Vamos configurar seu restaurante em alguns passos simples' : 'Como você deseja montar seu cardápio?'}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          {step === 1 ? (
            <>
              <div className="mb-8">
                <div className="flex items-center justify-center mb-2">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-boracume-orange text-white">
                    <Store className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="font-semibold">Informações do Restaurante</h3>
                  <p className="text-sm text-gray-600">Passo 1 de 2</p>
                </div>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleStep1Submit, onInvalid)} className="space-y-6">
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

                    <div className="flex justify-end gap-2">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        onClick={() => setStep(2)}
                        disabled={isLoading}
                      >
                        Pular Configuração
                      </Button>
                      <Button type="submit" disabled={isLoading} className="w-full sm:w-auto bg-boracume-orange hover:bg-orange-600">
                        {isLoading ? 'Salvando...' : 'Continuar para Cardápio >'}
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </>
          ) : (
            <div className="space-y-6">
               <div className="mb-8">
                <div className="flex items-center justify-center mb-2">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-purple-600 text-white">
                    <Utensils className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="font-semibold">Configuração do Cardápio</h3>
                  <p className="text-sm text-gray-600">Escolha como deseja começar</p>
                </div>
              </div>

              <div className="grid gap-4">
                <Button 
                  variant="outline" 
                  className="h-auto p-4 flex items-center justify-start gap-4 hover:bg-orange-50 border-2 hover:border-orange-200 transition-all"
                  onClick={() => createSampleProducts(form.getValues('restaurantType'))}
                  disabled={isLoading}
                >
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-semibold text-gray-900">Criar Cardápio Automático</h4>
                    <p className="text-sm text-gray-500">Gera categorias e produtos de exemplo baseados no seu tipo de negócio.</p>
                  </div>
                </Button>

                <Button 
                  variant="outline" 
                  className="h-auto p-4 flex items-center justify-start gap-4 hover:bg-purple-50 border-2 hover:border-purple-200 transition-all"
                  onClick={() => setShowImportModal(true)}
                  disabled={isLoading}
                >
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                    <Wand2 className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-semibold text-gray-900">Importar com Inteligência Artificial</h4>
                    <p className="text-sm text-gray-500">Envie uma foto do seu cardápio ou um link (iFood/Goomer) e a IA cria tudo pra você.</p>
                  </div>
                </Button>

                <Button 
                  variant="ghost" 
                  className="h-auto p-4 flex items-center justify-start gap-4 hover:bg-gray-50"
                  onClick={handleManualStart}
                  disabled={isLoading}
                >
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <Plus className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-semibold text-gray-900">Começar do Zero</h4>
                    <p className="text-sm text-gray-500">Quero cadastrar meus produtos manualmente depois.</p>
                  </div>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <MenuImportModal 
        isOpen={showImportModal} 
        onClose={() => setShowImportModal(false)} 
        onImportComplete={finishWizard}
      />
    </div>
  );
};

export default OnboardingWizard;
