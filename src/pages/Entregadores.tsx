
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Define delivery personnel type
interface DeliveryPerson {
  id: string;
  name: string;
  phone: string;
  vehicle_type: string;
  vehicle_plate: string | null;
  status: 'available' | 'busy' | 'offline';
}

// Define form schema
const deliveryPersonSchema = z.object({
  name: z.string().min(3, { message: 'Nome deve ter pelo menos 3 caracteres' }),
  phone: z.string().min(8, { message: 'Telefone inválido' }),
  vehicle_type: z.string().min(1, { message: 'Tipo de veículo é obrigatório' }),
  vehicle_plate: z.string().optional(),
  status: z.enum(['available', 'busy', 'offline']),
});

type DeliveryPersonFormValues = z.infer<typeof deliveryPersonSchema>;

const Entregadores: React.FC = () => {
  const [deliveryPersonnel, setDeliveryPersonnel] = useState<DeliveryPerson[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentDeliveryPerson, setCurrentDeliveryPerson] = useState<DeliveryPerson | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Initialize form
  const form = useForm<DeliveryPersonFormValues>({
    resolver: zodResolver(deliveryPersonSchema),
    defaultValues: {
      name: '',
      phone: '',
      vehicle_type: '',
      vehicle_plate: '',
      status: 'available',
    },
  });
  
  // Fetch delivery personnel
  const fetchDeliveryPersonnel = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('delivery_personnel')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      
      if (error) throw error;
      
      setDeliveryPersonnel(data as DeliveryPerson[]);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar entregadores',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchDeliveryPersonnel();
  }, [user, toast]);
  
  // Handle form submission
  const onSubmit = async (data: DeliveryPersonFormValues) => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      if (currentDeliveryPerson) {
        // Update existing delivery person
        const { error } = await supabase
          .from('delivery_personnel')
          .update({
            name: data.name,
            phone: data.phone,
            vehicle_type: data.vehicle_type,
            vehicle_plate: data.vehicle_plate || null,
            status: data.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentDeliveryPerson.id);
        
        if (error) throw error;
        
        toast({
          title: 'Entregador atualizado',
          description: 'As informações do entregador foram atualizadas com sucesso.',
        });
      } else {
        // Create new delivery person
        const { error } = await supabase
          .from('delivery_personnel')
          .insert({
            user_id: user.id,
            name: data.name,
            phone: data.phone,
            vehicle_type: data.vehicle_type,
            vehicle_plate: data.vehicle_plate || null,
            status: data.status,
          });
        
        if (error) throw error;
        
        toast({
          title: 'Entregador adicionado',
          description: 'O entregador foi adicionado com sucesso.',
        });
      }
      
      // Refresh list and reset form
      await fetchDeliveryPersonnel();
      resetForm();
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar entregador',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Delete delivery person
  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este entregador?')) return;
    
    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from('delivery_personnel')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: 'Entregador excluído',
        description: 'O entregador foi removido com sucesso.',
      });
      
      await fetchDeliveryPersonnel();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir entregador',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Edit delivery person
  const handleEdit = (deliveryPerson: DeliveryPerson) => {
    setCurrentDeliveryPerson(deliveryPerson);
    
    form.setValue('name', deliveryPerson.name);
    form.setValue('phone', deliveryPerson.phone);
    form.setValue('vehicle_type', deliveryPerson.vehicle_type);
    form.setValue('vehicle_plate', deliveryPerson.vehicle_plate || '');
    form.setValue('status', deliveryPerson.status);
    
    setIsDialogOpen(true);
  };
  
  // Open dialog for new delivery person
  const handleAddNew = () => {
    resetForm();
    setCurrentDeliveryPerson(null);
    setIsDialogOpen(true);
  };
  
  // Reset form
  const resetForm = () => {
    form.reset({
      name: '',
      phone: '',
      vehicle_type: '',
      vehicle_plate: '',
      status: 'available',
    });
  };
  
  // Get status badge variant
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-500';
      case 'busy':
        return 'bg-yellow-500';
      case 'offline':
        return 'bg-gray-500';
      default:
        return 'bg-blue-500';
    }
  };
  
  // Get status label
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available':
        return 'Disponível';
      case 'busy':
        return 'Em Entrega';
      case 'offline':
        return 'Offline';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Gestão de Entregadores</h1>
        <Button onClick={handleAddNew}>
          <Plus className="mr-2 h-4 w-4" /> Novo Entregador
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Entregadores</CardTitle>
          <CardDescription>
            Gerencie a equipe de entregadores do seu restaurante
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Carregando entregadores...
            </div>
          ) : deliveryPersonnel.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhum entregador cadastrado. Clique em "Novo Entregador" para adicionar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveryPersonnel.map((deliveryPerson) => (
                  <TableRow key={deliveryPerson.id}>
                    <TableCell className="font-medium">{deliveryPerson.name}</TableCell>
                    <TableCell>{deliveryPerson.phone}</TableCell>
                    <TableCell>{deliveryPerson.vehicle_type}</TableCell>
                    <TableCell>{deliveryPerson.vehicle_plate || '-'}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadge(deliveryPerson.status)}>
                        {getStatusLabel(deliveryPerson.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEdit(deliveryPerson)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-red-500 hover:text-red-500"
                          onClick={() => handleDelete(deliveryPerson.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* Dialog for adding/editing delivery personnel */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {currentDeliveryPerson ? 'Editar Entregador' : 'Novo Entregador'}
            </DialogTitle>
            <DialogDescription>
              {currentDeliveryPerson
                ? 'Edite as informações do entregador abaixo.'
                : 'Preencha as informações do novo entregador.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do entregador" {...field} />
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
                      <Input placeholder="(00) 00000-0000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="vehicle_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Veículo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo de veículo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Moto">Moto</SelectItem>
                        <SelectItem value="Carro">Carro</SelectItem>
                        <SelectItem value="Bicicleta">Bicicleta</SelectItem>
                        <SelectItem value="A pé">A pé</SelectItem>
                        <SelectItem value="Van">Van</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="vehicle_plate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Placa do Veículo (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="ABC-1234" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="available">Disponível</SelectItem>
                        <SelectItem value="busy">Em Entrega</SelectItem>
                        <SelectItem value="offline">Offline</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="submit" disabled={isLoading}>
                  {isLoading
                    ? 'Salvando...'
                    : currentDeliveryPerson
                    ? 'Salvar Alterações'
                    : 'Adicionar Entregador'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Entregadores;
