
import React, { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Save } from 'lucide-react';

const marketingSchema = z.object({
  googleTagId: z.string().optional(),
  facebookPixelId: z.string().optional(),
  bannerImages: z.array(z.string()).optional(),
});

type MarketingSettingsFormValues = z.infer<typeof marketingSchema>;

const MarketingSettings: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Initialize form with default values
  const form = useForm<MarketingSettingsFormValues>({
    resolver: zodResolver(marketingSchema),
    defaultValues: {
      googleTagId: '',
      facebookPixelId: '',
      bannerImages: [],
    },
  });
  
  // Fetch current marketing settings
  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('marketing_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (error) throw error;
        
        // Update form with fetched data
        if (data) {
          form.setValue('googleTagId', data.google_tag_id || '');
          form.setValue('facebookPixelId', data.facebook_pixel_id || '');
          form.setValue('bannerImages', data.banner_images || []);
        }
      } catch (error: any) {
        console.error('Error fetching marketing settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSettings();
  }, [user, form]);
  
  // Handle form submission
  const onSubmit = async (values: MarketingSettingsFormValues) => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from('marketing_settings')
        .update({
          google_tag_id: values.googleTagId,
          facebook_pixel_id: values.facebookPixelId,
          banner_images: values.bannerImages,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      toast({
        title: 'Configurações de marketing atualizadas',
        description: 'Suas configurações foram salvas com sucesso.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar configurações',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurações de Marketing</CardTitle>
        <CardDescription>
          Configure integrações com ferramentas de marketing e banners promocionais
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Integrações</h3>
              <FormField
                control={form.control}
                name="googleTagId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID do Google Tag Manager</FormLabel>
                    <FormControl>
                      <Input placeholder="GTM-XXXXXX" {...field} />
                    </FormControl>
                    <FormDescription>
                      Insira o ID do seu Google Tag Manager para rastrear conversões e eventos.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="facebookPixelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID do Facebook Pixel</FormLabel>
                    <FormControl>
                      <Input placeholder="XXXXXXXXXXXXXXXX" {...field} />
                    </FormControl>
                    <FormDescription>
                      Insira o ID do seu Facebook Pixel para rastrear conversões no Facebook.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-medium">Banners Promocionais</h3>
              <p className="text-sm text-muted-foreground">
                Configure banners promocionais para exibir no cardápio digital e na página inicial.
                (Funcionalidade em desenvolvimento)
              </p>
              {/* Banner image upload feature will be implemented here */}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Configurações
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
};

export default MarketingSettings;
