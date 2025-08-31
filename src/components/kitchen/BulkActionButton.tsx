import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BulkActionButtonProps {
  orderIds: string[];
  action: 'preparing' | 'ready' | 'completed';
  onBulkAction: (orderIds: string[], action: 'preparing' | 'ready' | 'completed') => Promise<{ success: boolean; updatedCount: number }>;
  disabled?: boolean;
}

const BulkActionButton: React.FC<BulkActionButtonProps> = ({
  orderIds,
  action,
  onBulkAction,
  disabled = false
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const getButtonConfig = () => {
    switch (action) {
      case 'preparing':
        return {
          label: 'Iniciar Preparo de Todos',
          confirmTitle: 'Iniciar preparo de todos os pedidos?',
          confirmDescription: `Todos os ${orderIds.length} pedidos pendentes serão movidos para "Preparando".`,
          className: 'bg-blue-600 hover:bg-blue-700'
        };
      case 'ready':
        return {
          label: 'Marcar Todos como Prontos',
          confirmTitle: 'Marcar todos como prontos?',
          confirmDescription: `Todos os ${orderIds.length} pedidos em preparo serão marcados como "Prontos".`,
          className: 'bg-green-600 hover:bg-green-700'
        };
      case 'completed':
        return {
          label: 'Enviar Todos para Entrega',
          confirmTitle: 'Enviar todos para entrega?',
          confirmDescription: `Todos os ${orderIds.length} pedidos prontos serão enviados para entrega.`,
          className: 'bg-purple-600 hover:bg-purple-700'
        };
      default:
        return {
          label: 'Ação em Massa',
          confirmTitle: 'Confirmar ação?',
          confirmDescription: 'Confirma a ação em massa?',
          className: 'bg-gray-600 hover:bg-gray-700'
        };
    }
  };

  const config = getButtonConfig();

  const handleBulkAction = async () => {
    try {
      setIsProcessing(true);
      const result = await onBulkAction(orderIds, action);
      
      if (result.success) {
        toast({
          title: "Sucesso!",
          description: `${result.updatedCount} pedidos atualizados com sucesso.`,
        });
      }
    } catch (error) {
      console.error('Erro na ação em massa:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar a ação em massa.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (orderIds.length === 0 || disabled) {
    return null;
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button 
          size="sm" 
          className={config.className}
          disabled={isProcessing}
        >
          {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {config.label} ({orderIds.length})
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{config.confirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {config.confirmDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleBulkAction}>
            Confirmar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default BulkActionButton;