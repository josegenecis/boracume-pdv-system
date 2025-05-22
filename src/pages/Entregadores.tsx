
import React, { useState } from 'react';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableHead, 
  TableRow, 
  TableCell 
} from '@/components/ui/table';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Phone, MapPin, User, Truck, Calendar } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// Define types for delivery personnel data
interface DeliveryPerson {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  licensePlate: string;
  status: 'active' | 'delivering' | 'offline' | 'blocked';
  joinedDate: Date;
  deliveries: number;
  rating: number;
}

// Sample data for delivery personnel
const initialDeliveryPersons: DeliveryPerson[] = [
  {
    id: 'D001',
    name: 'Carlos Oliveira',
    phone: '(11) 98765-4321',
    vehicle: 'Moto CG 160',
    licensePlate: 'ABC-1234',
    status: 'active',
    joinedDate: new Date(2023, 6, 15),
    deliveries: 352,
    rating: 4.8
  },
  {
    id: 'D002',
    name: 'Fernanda Lima',
    phone: '(11) 91234-5678',
    vehicle: 'Moto Factor 125',
    licensePlate: 'XYZ-9876',
    status: 'delivering',
    joinedDate: new Date(2023, 8, 22),
    deliveries: 187,
    rating: 4.5
  },
  {
    id: 'D003',
    name: 'Roberto Santos',
    phone: '(11) 97890-1234',
    vehicle: 'Biz 125',
    licensePlate: 'DEF-5678',
    status: 'offline',
    joinedDate: new Date(2024, 1, 10),
    deliveries: 76,
    rating: 4.2
  }
];

// Form schema for adding/editing delivery persons
const deliveryPersonFormSchema = z.object({
  name: z.string().min(3, { message: "Nome deve ter pelo menos 3 caracteres" }),
  phone: z.string().min(10, { message: "Telefone inválido" }),
  vehicle: z.string().min(2, { message: "Veículo inválido" }),
  licensePlate: z.string().min(7, { message: "Placa inválida" }),
});

// Status badge component
const StatusBadge = ({ status }: { status: DeliveryPerson['status'] }) => {
  const statusConfig = {
    active: { color: 'bg-green-500', text: 'Disponível' },
    delivering: { color: 'bg-blue-500', text: 'Em Entrega' },
    offline: { color: 'bg-gray-500', text: 'Offline' },
    blocked: { color: 'bg-red-500', text: 'Bloqueado' }
  };
  
  return (
    <Badge className={`${statusConfig[status].color}`}>
      {statusConfig[status].text}
    </Badge>
  );
};

const Entregadores = () => {
  const [deliveryPersons, setDeliveryPersons] = useState<DeliveryPerson[]>(initialDeliveryPersons);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof deliveryPersonFormSchema>>({
    resolver: zodResolver(deliveryPersonFormSchema),
    defaultValues: {
      name: '',
      phone: '',
      vehicle: '',
      licensePlate: '',
    },
  });
  
  const handleCreateDeliveryPerson = (values: z.infer<typeof deliveryPersonFormSchema>) => {
    const newDeliveryPerson: DeliveryPerson = {
      id: `D${Math.floor(1000 + Math.random() * 9000)}`,
      name: values.name,
      phone: values.phone,
      vehicle: values.vehicle,
      licensePlate: values.licensePlate,
      status: 'offline',
      joinedDate: new Date(),
      deliveries: 0,
      rating: 0
    };
    
    setDeliveryPersons([...deliveryPersons, newDeliveryPerson]);
    form.reset();
    
    toast({
      title: "Entregador cadastrado com sucesso",
      description: `${values.name} foi adicionado à equipe de entregadores.`
    });
  };
  
  const handleEditDeliveryPerson = (id: string) => {
    const deliveryPerson = deliveryPersons.find(dp => dp.id === id);
    if (!deliveryPerson) return;
    
    setIsEditing(id);
    form.reset({
      name: deliveryPerson.name,
      phone: deliveryPerson.phone,
      vehicle: deliveryPerson.vehicle,
      licensePlate: deliveryPerson.licensePlate,
    });
  };
  
  const handleUpdateDeliveryPerson = (values: z.infer<typeof deliveryPersonFormSchema>) => {
    if (!isEditing) return;
    
    setDeliveryPersons(deliveryPersons.map(dp => 
      dp.id === isEditing 
        ? { ...dp, ...values }
        : dp
    ));
    
    setIsEditing(null);
    form.reset();
    
    toast({
      title: "Entregador atualizado com sucesso",
      description: `Os dados de ${values.name} foram atualizados.`
    });
  };
  
  const handleDeleteDeliveryPerson = (id: string) => {
    setDeliveryPersons(deliveryPersons.filter(dp => dp.id !== id));
    
    toast({
      title: "Entregador removido",
      description: "O entregador foi removido da sua equipe."
    });
  };
  
  const handleToggleStatus = (id: string) => {
    setDeliveryPersons(deliveryPersons.map(dp => {
      if (dp.id === id) {
        const newStatus = dp.status === 'active' ? 'offline' : 'active';
        return { ...dp, status: newStatus };
      }
      return dp;
    }));
  };
  
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR').format(date);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Gestão de Entregadores</h1>
      
      <Tabs defaultValue="lista" className="w-full">
        <TabsList>
          <TabsTrigger value="lista">Lista de Entregadores</TabsTrigger>
          <TabsTrigger value="cadastro">Cadastrar Entregador</TabsTrigger>
        </TabsList>
        
        <TabsContent value="lista" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Equipe de Entrega</h2>
              <p className="text-muted-foreground">Gerencie sua equipe de entregadores</p>
            </div>
            <div className="flex items-center gap-2">
              <Input 
                placeholder="Buscar entregador..." 
                className="max-w-xs"
              />
              <Button variant="outline">Filtrar</Button>
            </div>
          </div>
          
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Veículo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Desde</TableHead>
                    <TableHead>Entregas</TableHead>
                    <TableHead>Avaliação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveryPersons.map((person) => (
                    <TableRow key={person.id}>
                      <TableCell className="font-medium">{person.name}</TableCell>
                      <TableCell>{person.phone}</TableCell>
                      <TableCell>{person.vehicle} ({person.licensePlate})</TableCell>
                      <TableCell>
                        <StatusBadge status={person.status} />
                      </TableCell>
                      <TableCell>{formatDate(person.joinedDate)}</TableCell>
                      <TableCell>{person.deliveries}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          {person.rating.toFixed(1)}
                          <span className="ml-1 text-yellow-500">★</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleToggleStatus(person.id)}
                        >
                          {person.status === 'active' ? 'Desativar' : 'Ativar'}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEditDeliveryPerson(person.id)}
                        >
                          Editar
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteDeliveryPerson(person.id)}
                          className="text-red-500 hover:bg-red-50"
                        >
                          Excluir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {deliveryPersons.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhum entregador cadastrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="cadastro">
          <Card>
            <CardHeader>
              <CardTitle>{isEditing ? 'Editar Entregador' : 'Cadastrar Novo Entregador'}</CardTitle>
              <CardDescription>
                Preencha os dados do entregador para adicioná-lo à sua equipe
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form 
                  onSubmit={form.handleSubmit(isEditing ? handleUpdateDeliveryPerson : handleCreateDeliveryPerson)} 
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome Completo</FormLabel>
                          <FormControl>
                            <div className="flex items-center">
                              <User className="mr-2 h-4 w-4 text-muted-foreground" />
                              <Input placeholder="Nome do entregador" {...field} />
                            </div>
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
                            <div className="flex items-center">
                              <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                              <Input placeholder="(00) 00000-0000" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="vehicle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Veículo</FormLabel>
                          <FormControl>
                            <div className="flex items-center">
                              <Truck className="mr-2 h-4 w-4 text-muted-foreground" />
                              <Input placeholder="Modelo do veículo" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="licensePlate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Placa</FormLabel>
                          <FormControl>
                            <Input placeholder="ABC-1234" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="flex justify-end gap-3">
                    {isEditing && (
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => {
                          setIsEditing(null);
                          form.reset();
                        }}
                      >
                        Cancelar
                      </Button>
                    )}
                    <Button type="submit">
                      {isEditing ? 'Atualizar Entregador' : 'Cadastrar Entregador'}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Entregadores;
