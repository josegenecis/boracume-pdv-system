import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PixPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    amount: number;
    orderId?: string;
    onPaymentConfirmed?: () => void;
}

const PixPaymentModal: React.FC<PixPaymentModalProps> = ({
    isOpen,
    onClose,
    amount,
    orderId,
    onPaymentConfirmed
}) => {
    const [pixCode, setPixCode] = useState('');
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    // Generate a random PIX payload for simulation
    // In a real app, this would come from a backend integration (Mercado Pago, Gerencianet, etc.)
    const generatePixCode = () => {
        setLoading(true);

        // Simulate API delay
        setTimeout(() => {
            // This is a dummy PIX payload structure
            // Real payload would be generated based on the amount and merchant key
            const randomId = Math.random().toString(36).substring(7);
            const payload = `00020126580014BR.GOV.BCB.PIX0136123e4567-e89b-12d3-a456-426614174000520400005303986540${amount.toFixed(2).replace('.', '')}5802BR5913Boracume PDV6008Sao Paulo62070503***6304${randomId}`;

            setPixCode(payload);
            setLoading(false);
        }, 1000);
    };

    useEffect(() => {
        if (isOpen) {
            generatePixCode();
        } else {
            setPixCode('');
            setCopied(false);
        }
    }, [isOpen, amount]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(pixCode);
            setCopied(true);
            toast({
                title: "Código PIX copiado",
                description: "Cole no seu aplicativo de banco para pagar.",
            });

            setTimeout(() => setCopied(false), 3000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleConfirm = () => {
        if (onPaymentConfirmed) {
            onPaymentConfirmed();
        }
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Pagamento via PIX</DialogTitle>
                    <DialogDescription>
                        Escaneie o QR Code ou copie o código para pagar.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center justify-center p-6 space-y-4">
                    {loading ? (
                        <div className="h-48 w-48 flex items-center justify-center border-2 border-dashed rounded-lg">
                            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <div className="bg-white p-4 rounded-lg border shadow-sm">
                            <QRCodeSVG value={pixCode} size={200} />
                        </div>
                    )}

                    <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-1">Valor a pagar</p>
                        <p className="text-2xl font-bold text-green-600">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)}
                        </p>
                    </div>

                    <div className="w-full flex gap-2">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={handleCopy}
                            disabled={loading || !pixCode}
                        >
                            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                            {copied ? 'Copiado!' : 'Copiar Código'}
                        </Button>
                    </div>
                </div>

                <DialogFooter className="sm:justify-between">
                    <Button variant="ghost" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button onClick={handleConfirm} className="bg-green-600 hover:bg-green-700">
                        Confirmar Pagamento
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PixPaymentModal;
