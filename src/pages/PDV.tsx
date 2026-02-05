import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Minus, Trash2, Calculator, Search, Store, UtensilsCrossed, RefreshCw } from 'lucide-react';
import OperatorSwitcher from '@/components/OperatorSwitcher';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ProductVariationModal from '@/components/pdv/ProductVariationModal';
import PixPaymentModal from '@/components/payment/PixPaymentModal';
import TableAccountManager from '@/components/pdv/TableAccountManager';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import FirstOperatorDialog from '@/components/pdv/FirstOperatorDialog';
import NFCeEmissionModal from '@/components/nfce/NFCeEmissionModal';
import AdminPinDialog from '@/components/security/AdminPinDialog';
import { getLocalOperatorSession, isAdminOperator } from '@/services/operatorAuth';
import { verifyAdminPin } from '@/services/adminPin';
import { useTefSettings } from '@/hooks/useTefSettings';

interface Product {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  available: boolean;
  category_id?: string;
  description?: string;
  weight_based?: boolean;
  send_to_kds?: boolean;
}

interface ProductVariation {
  id: string;
  name: string;
  required: boolean;
  max_selections: number;
  options: Array<{name: string; price: number}>;
}

interface CartItem extends Product {
  quantity: number;
  selectedVariations?: any[];
  notes?: string;
}

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
}

interface Table {
  id: string;
  table_number: number;
  status: string;
}

interface CashSession {
  id: string;
  opened_at: string;
  initial_amount: number;
  status: string;
}

const PDV = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderType, setOrderType] = useState<'delivery' | 'pickup' | 'dine_in' | 'counter'>('counter');
  const [selectedDeliveryZone, setSelectedDeliveryZone] = useState<string>('');
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [changeAmount, setChangeAmount] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showVariationModal, setShowVariationModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productVariations, setProductVariations] = useState<ProductVariation[]>([]);
  const [activeTab, setActiveTab] = useState('products');
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [pixOrderId, setPixOrderId] = useState<string | undefined>(undefined);
  const [pixAmount, setPixAmount] = useState(0);
  const [createdOrderForNfce, setCreatedOrderForNfce] = useState<any>(null);
  const [nfceModalOpen, setNfceModalOpen] = useState(false);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [cashDialogOpen, setCashDialogOpen] = useState(false);
  const [cashDialogMode, setCashDialogMode] = useState<'open' | 'close'>('open');
  const [cashAmountInput, setCashAmountInput] = useState('');
  const [cashCloseLoading, setCashCloseLoading] = useState(false);
  const [cashCloseSummary, setCashCloseSummary] = useState<{ expectedCash: number; pix: number; card: number; cash: number; total: number; inAmount: number; outAmount: number; initial: number } | null>(null);
  const [mustCreateOperator, setMustCreateOperator] = useState(false);
  const [cashMoveOpen, setCashMoveOpen] = useState(false);
  const [cashMoveType, setCashMoveType] = useState<'in' | 'out'>('out');
  const [cashMoveAmount, setCashMoveAmount] = useState('');
  const [cashMoveDesc, setCashMoveDesc] = useState('');
  const [adminPinOpen, setAdminPinOpen] = useState(false);
  const [tefOpen, setTefOpen] = useState(false);
  const [tefData, setTefData] = useState<{ nsu: string; auth: string; brand: string; acquirer: string; installments: string } | null>(null);
  const [cardProcessingMode, setCardProcessingMode] = useState<'maquininha' | 'tef'>('maquininha');
  const { toast } = useToast();
  const { user } = useAuth();
  const { settings: tefSettings } = useTefSettings();

  // Refs for animation
  const cartContainerRef = useRef<HTMLDivElement>(null);
  const mobileCartBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      fetchData();
      fetchOpenCashSession();
      checkFirstOperator();
    }
  }, [user]);

  useEffect(() => {
    if (!tefSettings.enabled) {
      setCardProcessingMode('maquininha');
      setTefData(null);
      setTefOpen(false);
    }
  }, [tefSettings.enabled]);

  const checkFirstOperator = async () => {
    try {
      const { data, error } = await supabase
        .from('waiters' as any)
        .select('id')
        .eq('user_id', user?.id)
        .eq('active', true)
        .limit(1);
      if (error) throw error;
      const hasAny = Array.isArray(data) && data.length > 0;
      setMustCreateOperator(!hasAny);
    } catch {
      setMustCreateOperator(false);
    }
  };

  const fetchOpenCashSession = async () => {
    try {
      const { data, error } = await supabase
        .from('cash_register_sessions' as any)
        .select('id, opened_at, initial_amount, status')
        .eq('user_id', user?.id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      setCashSession((data as any) || null);
    } catch {
      setCashSession(null);
    }
  };

  const getOperatorSession = () => {
    try {
      const waiter = localStorage.getItem('waiter_session');
      if (waiter) return JSON.parse(waiter);
      const op = localStorage.getItem('operator_session');
      if (op) return JSON.parse(op);
      return null;
    } catch {
      return null;
    }
  };

  const openCashDialog = async (mode: 'open' | 'close') => {
    setCashDialogMode(mode);
    setCashCloseSummary(null);
    setCashAmountInput('');
    if (mode === 'close' && user?.id && cashSession?.id) {
      try {
        setCashCloseLoading(true);
        const [{ data: orders }, { data: moves }] = await Promise.all([
          (supabase as any)
            .from('orders')
            .select('total, payment_method, status')
            .eq('user_id', user.id)
            .eq('cash_register_session_id', cashSession.id),
          (supabase as any)
            .from('cash_movements')
            .select('type, amount')
            .eq('user_id', user.id)
            .eq('session_id', cashSession.id),
        ]);
        const sales = Array.isArray(orders) ? orders.filter((o) => o?.status !== 'cancelled') : [];
        const pix = sales.filter((o) => o.payment_method === 'pix').reduce((sum, o) => sum + Number(o.total || 0), 0);
        const card = sales.filter((o) => o.payment_method === 'cartao').reduce((sum, o) => sum + Number(o.total || 0), 0);
        const cash = sales.filter((o) => o.payment_method === 'dinheiro').reduce((sum, o) => sum + Number(o.total || 0), 0);
        const total = sales.reduce((sum, o) => sum + Number(o.total || 0), 0);
        const inAmount = (Array.isArray(moves) ? moves : []).filter((m) => m.type === 'in').reduce((sum, m) => sum + Number(m.amount || 0), 0);
        const outAmount = (Array.isArray(moves) ? moves : []).filter((m) => m.type === 'out').reduce((sum, m) => sum + Number(m.amount || 0), 0);
        const initial = Number(cashSession.initial_amount || 0);
        const expectedCash = initial + cash + inAmount - outAmount;
        setCashCloseSummary({ expectedCash, pix, card, cash, total, inAmount, outAmount, initial });
        setCashAmountInput(String(expectedCash.toFixed(2)));
      } catch {}
      setCashCloseLoading(false);
    }
    setCashDialogOpen(true);
  };

  const handleCashSubmit = async () => {
    if (!user?.id) return;
    const amount = Number(cashAmountInput.replace(',', '.'));
    if (!Number.isFinite(amount)) {
      toast({ title: 'Valor inválido', description: 'Informe um valor válido', variant: 'destructive' });
      return;
    }
    const operatorSession = getOperatorSession();
    const waiterId = operatorSession?.id || null;
    if (!operatorSession?.id) {
      toast({ title: 'Selecione um operador', description: 'Antes de abrir/fechar caixa, selecione um operador.', variant: 'destructive' });
      return;
    }

    try {
      if (cashDialogMode === 'open') {
        const payload: any = {
          user_id: user.id,
          initial_amount: amount,
          status: 'open',
          opened_at: new Date().toISOString(),
          opened_by_waiter_id: waiterId,
        };
        let error: any = null;
        const res1 = await supabase.from('cash_register_sessions' as any).insert(payload);
        error = (res1 as any).error;
        if (error && String(error.message || '').includes('opened_by_waiter_id')) {
          const { opened_by_waiter_id, ...fallback } = payload;
          const res2 = await supabase.from('cash_register_sessions' as any).insert(fallback);
          error = (res2 as any).error;
        }
        if (error) throw error;
        toast({ title: 'Caixa aberto' });
      } else {
        if (!cashSession?.id) {
          toast({ title: 'Caixa não encontrado', variant: 'destructive' });
          return;
        }
        let error: any = null;
        const updatePayload: any = {
          status: 'closed',
          closed_at: new Date().toISOString(),
          final_amount: amount,
          expected_amount: cashCloseSummary?.expectedCash ?? null,
          closed_by_waiter_id: waiterId,
        };
        const res1 = await supabase
          .from('cash_register_sessions' as any)
          .update(updatePayload)
          .eq('id', cashSession.id);
        error = (res1 as any).error;
        if (error && String(error.message || '').includes('expected_amount')) {
          const { expected_amount, ...fallback } = updatePayload;
          const res2 = await supabase
            .from('cash_register_sessions' as any)
            .update(fallback)
            .eq('id', cashSession.id);
          error = (res2 as any).error;
        }
        if (error && String(error.message || '').includes('closed_by_waiter_id')) {
          const { closed_by_waiter_id, ...fallback } = updatePayload;
          const res2 = await supabase
            .from('cash_register_sessions' as any)
            .update(fallback)
            .eq('id', cashSession.id);
          error = (res2 as any).error;
        }
        if (error) throw error;
        toast({ title: 'Caixa fechado' });
      }
      setCashDialogOpen(false);
      await fetchOpenCashSession();
    } catch (e: any) {
      toast({ title: 'Erro no caixa', description: e?.message || 'Erro desconhecido', variant: 'destructive' });
      try { alert(e?.message || 'Erro no caixa') } catch {}
    }
  };

  const submitCashMovement = async () => {
    if (!user?.id) return;
    if (!cashSession?.id) {
      toast({ title: 'Caixa fechado', description: 'Abra o caixa primeiro', variant: 'destructive' });
      return;
    }
    const amount = Number(cashMoveAmount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: 'Valor inválido', description: 'Informe um valor válido', variant: 'destructive' });
      return;
    }
    const session = getLocalOperatorSession();
    if (!session?.id) {
      toast({ title: 'Selecione um operador', variant: 'destructive' });
      return;
    }
    const needsAdmin = cashMoveType === 'out' && !isAdminOperator(session);
    if (needsAdmin) {
      setAdminPinOpen(true);
      return;
    }
    try {
      const { error } = await (supabase as any).from('cash_movements').insert({
        session_id: cashSession.id,
        user_id: user.id,
        type: cashMoveType,
        amount,
        description: cashMoveDesc || null,
      });
      if (error) throw error;
      toast({ title: cashMoveType === 'in' ? 'Suprimento registrado' : 'Sangria registrada' });
      setCashMoveOpen(false);
      setCashMoveAmount('');
      setCashMoveDesc('');
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message || 'Erro ao registrar movimentação', variant: 'destructive' });
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchProducts(),
        fetchDeliveryZones(),
        fetchTables()
      ]);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user?.id)
        .eq('available', true)
        .eq('show_in_pdv', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      setProducts([]);
    }
  };

  const fetchDeliveryZones = async () => {
    try {
      const { data: zonesData, error: zonesError } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('user_id', user?.id)
        .eq('active', true)
        .order('name');

      if (zonesError) {
        console.error('Erro ao carregar delivery_zones:', zonesError);
        setDeliveryZones([]);
        return;
      }

      const deliveryAreas: DeliveryZone[] = (zonesData || []).map(zone => ({
        id: zone.id,
        name: zone.name,
        delivery_fee: zone.delivery_fee,
        minimum_order: zone.minimum_order || 0
      }));
      
      setDeliveryZones(deliveryAreas);
    } catch (error) {
      console.error('Erro ao carregar bairros de entrega:', error);
      setDeliveryZones([]);
    }
  };

  const fetchTables = async () => {
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .eq('user_id', user?.id)
        .order('table_number');

      if (error) {
        console.error('Erro ao carregar mesas:', error);
        throw error;
      }
      
      setTables(data || []);
    } catch (error) {
      console.error('Erro ao carregar mesas:', error);
      setTables([]);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fetchProductVariations = async (productId: string): Promise<ProductVariation[]> => {
    try {
      // Buscar variações específicas do produto
      const { data: productVariations, error: productError } = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', productId);

      // Buscar variações globais associadas ao produto
      const { data: globalVariationLinks, error: globalError } = await supabase
        .from('product_global_variation_links')
        .select('global_variation_id')
        .eq('product_id', productId);

      // Buscar as variações globais pelos IDs
      let globalVariations: any[] = [];
      if (globalVariationLinks && globalVariationLinks.length > 0) {
        const globalVariationIds = globalVariationLinks.map(link => link.global_variation_id);
        
        const { data: globalVars, error: globalVarError } = await supabase
          .from('global_variations')
          .select('*')
          .in('id', globalVariationIds);

        if (globalVars) {
          globalVariations = globalVars.map(globalVar => ({
            ...globalVar,
            required: !!globalVar.required,
            min_selections: 0,
            max_selections: globalVar.max_selections ?? 1
          }));
        }
      }

      // Combinar todas as variações
      const allVariations = [
        ...(productVariations || []),
        ...globalVariations
      ];
      
      const formattedVariations: ProductVariation[] = allVariations
        .map(item => {
          try {
            let options: Array<{ name: string; price: number; }> = [];

            if (typeof item.options === 'string') {
              try {
                options = JSON.parse(item.options);
              } catch (e) {
                options = [];
              }
            } else if (Array.isArray(item.options)) {
              options = item.options
                .filter((opt: any) => {
                  return opt && 
                         typeof opt === 'object' && 
                         opt.name && 
                         typeof opt.name === 'string' &&
                         opt.price !== undefined && 
                         !isNaN(Number(opt.price));
                })
                .map((opt: any) => ({
                  name: String(opt.name).trim(),
                  price: Number(opt.price)
                }));
            }

            return {
              id: item.id,
              name: item.name || '',
              options,
              max_selections: Math.max(1, Number(item.max_selections) || 1),
              required: Boolean(item.required)
            };
          } catch (itemError) {
            return null;
          }
        })
        .filter((variation): variation is ProductVariation => variation !== null);
      
      return formattedVariations;
    } catch (error) {
      console.error('Erro geral ao carregar variações:', error);
      return [];
    }
  };

  const animateFlyToCart = (startRect: DOMRect) => {
    // Determine target based on viewport (desktop or mobile)
    const isMobile = window.innerWidth < 1024;
    const targetEl = isMobile 
      ? document.getElementById('mobile-cart-btn') 
      : document.getElementById('cart-container');
      
    if (!targetEl) return;

    const endRect = targetEl.getBoundingClientRect();
    
    const flyItem = document.createElement('div');
    flyItem.className = 'fly-item bg-primary shadow-lg z-50 fixed rounded-full flex items-center justify-center';
    flyItem.style.left = `${startRect.left}px`;
    flyItem.style.top = `${startRect.top}px`;
    flyItem.style.width = `${Math.min(startRect.width, 50)}px`;
    flyItem.style.height = `${Math.min(startRect.height, 50)}px`;
    
    // Set variables for CSS animation
    const tx = endRect.left - startRect.left + (endRect.width / 2) - (Math.min(startRect.width, 50) / 2);
    const ty = endRect.top - startRect.top + (endRect.height / 2) - (Math.min(startRect.height, 50) / 2);
    
    flyItem.style.setProperty('--tx', `${tx}px`);
    flyItem.style.setProperty('--ty', `${ty}px`);
    
    document.body.appendChild(flyItem);
    
    setTimeout(() => {
      document.body.removeChild(flyItem);
    }, 800);
  };

  const handleProductClick = async (product: Product, event?: React.MouseEvent) => {
    // Capture click position for animation if no variations
    const clickRect = event?.currentTarget.getBoundingClientRect();
    
    const variations = await fetchProductVariations(product.id);
    
    if (variations.length > 0) {
      setSelectedProduct(product);
      setProductVariations(variations);
      setShowVariationModal(true);
    } else {
      if (clickRect) {
        animateFlyToCart(clickRect);
      }
      addToCart(product, 1);
    }
  };

  const addToCart = (product: Product, quantity: number = 1, selectedVariations: any[] = [], notes: string = '') => {
    setCart(prev => {
      const variationKey = JSON.stringify(selectedVariations) + notes;
      const existing = prev.find(item => 
        item.id === product.id && 
        JSON.stringify(item.selectedVariations) === JSON.stringify(selectedVariations) &&
        item.notes === notes
      );
      
      if (existing) {
        return prev.map(item =>
          item === existing
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      
      return [...prev, { 
        ...product, 
        quantity, 
        selectedVariations: selectedVariations.length > 0 ? selectedVariations : undefined,
        notes: notes || undefined
      }];
    });

    toast({
      title: "Produto adicionado",
      description: `${product.name} foi adicionado ao carrinho.`,
      duration: 1500,
    });
  };

  // Helper function to format selected variations for display
  const formatSelectedVariations = (selectedVariations?: any[]) => {
    if (!selectedVariations || selectedVariations.length === 0) return [];
    
    try {
      return selectedVariations.flatMap(variation => {
        if (variation && variation.options && Array.isArray(variation.options)) {
          return variation.options.map((option: any) => {
            if (typeof option === 'object' && option.name) {
              return option.name;
            }
            return String(option);
          });
        }
        if (typeof variation === 'string') {
          return [variation];
        }
        if (variation && variation.options && Array.isArray(variation.options)) {
          return variation.options.map((option: any) => option.name || String(option));
        }
        return [];
      });
    } catch (error) {
      console.error('Error formatting variations:', error);
      return [];
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const getTotalValue = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getDeliveryFee = () => {
    if (orderType !== 'delivery' || !selectedDeliveryZone) return 0;
    const zone = deliveryZones.find(z => z.id === selectedDeliveryZone);
    return zone?.delivery_fee || 0;
  };

  const getFinalTotal = () => {
    return getTotalValue() + getDeliveryFee();
  };

  const getChangeValue = () => {
    if (paymentMethod === 'dinheiro' && changeAmount) {
      return parseFloat(changeAmount) - getFinalTotal();
    }
    return 0;
  };

  const generateOrderNumber = () => {
    return Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  };

  const addToTable = async () => {
    if (cart.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione produtos ao carrinho antes de adicionar à mesa.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedTable) {
      toast({
        title: "Mesa obrigatória",
        description: "Por favor, selecione uma mesa.",
        variant: "destructive",
      });
      return;
    }

    try {
      setProcessing(true);

      const orderItems = cart.map(item => ({
        product_id: item.id,
        product_name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity,
        options: item.selectedVariations || [],
        notes: item.notes || ''
      }));

      const { data: existingAccount } = await supabase
        .from('table_accounts')
        .select('*')
        .eq('table_id', selectedTable)
        .eq('status', 'open')
        .maybeSingle();

      if (existingAccount) {
        let existingItems = [];
        try {
          if (typeof existingAccount.items === 'string') {
            existingItems = JSON.parse(existingAccount.items);
          } else if (Array.isArray(existingAccount.items)) {
            existingItems = existingAccount.items;
          }
        } catch (e) {
          existingItems = [];
        }

        const updatedItems = [...existingItems, ...orderItems];
        const newTotal = updatedItems.reduce((sum: number, item: any) => sum + item.subtotal, 0);

        const { error } = await supabase
          .from('table_accounts')
          .update({
            items: updatedItems,
            total: newTotal
          })
          .eq('id', existingAccount.id);

        if (error) throw error;
      } else {
        const total = getTotalValue();
        
        const { error } = await supabase
          .from('table_accounts')
          .insert({
            user_id: user?.id,
            table_id: selectedTable,
            items: orderItems,
            total: total,
            status: 'open'
          });

        if (error) throw error;

        await supabase
          .from('tables')
          .update({ status: 'occupied' })
          .eq('id', selectedTable);
      }

      toast({
        title: "Itens adicionados à mesa!",
        description: "Os produtos foram adicionados à conta da mesa.",
      });

      setCart([]);
      setSelectedTable('');
      fetchTables();
    } catch (error: any) {
      console.error('Erro ao adicionar à mesa:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível adicionar à mesa.",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleFinalizeSale = async () => {
    console.log('Finalizando venda...');
    
    if (cart.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione produtos ao carrinho antes de finalizar a venda.",
        variant: "destructive",
      });
      return;
    }

    if (orderType !== 'dine_in' && orderType !== 'counter' && !customerName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe o nome do cliente.",
        variant: "destructive",
      });
      return;
    }

    if (orderType === 'delivery') {
      if (!customerAddress.trim()) {
        toast({
          title: "Endereço obrigatório",
          description: "Por favor, informe o endereço para entrega.",
          variant: "destructive",
        });
        return;
      }

      if (!selectedDeliveryZone) {
        toast({
          title: "Bairro obrigatório",
          description: "Por favor, selecione o bairro para entrega.",
        variant: "destructive",
        });
        return;
      }
    }

    if (orderType === 'dine_in' && !selectedTable && !customerName.includes('Mesa ')) {
      const isTableFinalization = customerName.startsWith('Mesa ') && cart.length > 0;
      if (!isTableFinalization) {
        toast({
          title: "Mesa obrigatória",
          description: "Por favor, selecione uma mesa.",
          variant: "destructive",
        });
        return;
      }
    }

    if (paymentMethod === 'dinheiro' && changeAmount && parseFloat(changeAmount) < getFinalTotal()) {
      toast({
        title: "Valor insuficiente",
        description: "O valor recebido é menor que o total do pedido.",
        variant: "destructive",
      });
      return;
    }

    if (orderType === 'delivery' && selectedDeliveryZone) {
      const zone = deliveryZones.find(z => z.id === selectedDeliveryZone);
      if (zone && getTotalValue() < zone.minimum_order) {
        toast({
          title: "Valor mínimo não atingido",
          description: `O valor mínimo para entrega neste bairro é ${formatCurrency(zone.minimum_order)}.`,
          variant: "destructive",
        });
        return;
      }
    }

    try {
      setProcessing(true);
      console.log('Validations passed, creating order...');

      const orderNumber = generateOrderNumber();
      
      const orderItems = cart.map(item => ({
        product_id: item.id,
        product_name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity,
        options: item.selectedVariations || [],
        notes: item.notes || ''
      }));

      const operatorSession = (() => {
        return getOperatorSession();
      })();

      if (!cashSession?.id) {
        toast({
          title: 'Caixa fechado',
          description: 'Abra o caixa para finalizar a venda.',
          variant: 'destructive',
        });
        openCashDialog('open');
        return;
      }

      if (!operatorSession?.id) {
        toast({
          title: 'Operador não selecionado',
          description: 'Selecione um operador antes de finalizar.',
          variant: 'destructive',
        });
        return;
      }

      const orderData: any = {
        customer_name: orderType === 'dine_in' ? (customerName.trim() || `Mesa ${selectedTable}`) : (orderType === 'counter' ? (customerName.trim() || 'Venda Balcão') : customerName.trim()),
        customer_phone: customerPhone.trim() || null,
        customer_address: orderType === 'delivery' ? customerAddress.trim() : null,
        order_type: orderType,
        delivery_zone_id: orderType === 'delivery' ? selectedDeliveryZone || null : null,
        table_id: orderType === 'dine_in' ? selectedTable || null : null,
        items: orderItems,
        total: getFinalTotal(),
        delivery_fee: getDeliveryFee(),
        payment_method: paymentMethod,
        change_amount: paymentMethod === 'dinheiro' && changeAmount ? parseFloat(changeAmount) : null,
        status: 'pending',
        acceptance_status: paymentMethod === 'pix' ? 'awaiting_pix_payment' : 'pending_acceptance',
        order_number: orderNumber,
        user_id: user?.id,
        estimated_time: '30-45 min',
        waiter_id: operatorSession?.id || null,
        cash_register_session_id: cashSession?.id || null,
        variations: {
          operator: operatorSession ? { id: operatorSession.id, name: operatorSession.name } : null,
          source: 'PDV',
          environment: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          tef: paymentMethod === 'cartao' && cardProcessingMode === 'tef' ? (tefData || null) : null
        }
      };

      console.log('Criando pedido:', orderData);

      const { data, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select();

      if (error) {
        console.error('Erro ao criar pedido:', error);
        throw error;
      }

      console.log('Pedido criado com sucesso:', data);

      if (orderType === 'dine_in' && selectedTable) {
        try {
          await supabase
            .from('tables')
            .update({ status: 'occupied' })
            .eq('id', selectedTable);
        } catch (error) {
          console.warn('Não foi possível atualizar status da mesa:', error);
        }
      }

      if (paymentMethod === 'pix') {
        setPixAmount(getFinalTotal());
        const created = Array.isArray(data) ? data[0] : data;
        setPixOrderId(created?.id || null);
        setCreatedOrderForNfce(created || null);
        setIsPixModalOpen(true);
        try {
          await supabase.from('security_logs').insert({
            user_id: user?.id,
            event_type: 'order_finalize',
            description: `Pedido ${orderNumber} criado (PIX) por ${orderData.variations?.operator?.name || 'Conta do restaurante'}`,
            severity: 'info',
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null
          } as any);
        } catch {}
        toast({
          title: "Pedido criado!",
          description: "Aguardando pagamento do PIX para enviar ao restaurante.",
        });
      } else {
        const created = Array.isArray(data) ? data[0] : data;
        setCreatedOrderForNfce(created || null);
        try {
          await supabase.from('security_logs').insert({
            user_id: user?.id,
            event_type: 'order_finalize',
            description: `Pedido ${orderNumber} finalizado por ${orderData.variations?.operator?.name || 'Conta do restaurante'}`,
            severity: 'info',
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null
          } as any);
        } catch {}
        toast({
          title: "Venda finalizada!",
          description: `Pedido #${orderNumber} finalizado com sucesso. Total: ${formatCurrency(getFinalTotal())}.`,
        });
        setNfceModalOpen(true);
        setCart([]);
        setCustomerName('');
        setCustomerPhone('');
        setCustomerAddress('');
        setSelectedDeliveryZone('');
        setSelectedTable('');
        setChangeAmount('');
        setPaymentMethod('pix');
        setOrderType('delivery');
      }
    } catch (error: any) {
      console.error('Erro ao finalizar venda:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível finalizar a venda.",
        variant: "destructive"
      });
      try {
        // Fallback visual para garantir feedback
        alert(`Falha ao finalizar: ${error?.message || 'Erro desconhecido'}`);
      } catch {}
    } finally {
      setProcessing(false);
    }
  };

  const handleTableFinalization = (items: any[], total: number, tableNumber: number, tableId: string) => {
    const cartItems: CartItem[] = items.map(item => ({
      id: item.product_id,
      name: item.product_name,
      price: item.price,
      quantity: item.quantity,
      selectedVariations: item.options,
      notes: item.notes,
      available: true
    }));

    setCart(cartItems);
    setCustomerName(`Mesa ${tableNumber}`);
    setOrderType('dine_in');
    setSelectedTable(tableId);
    setActiveTab('products');

    toast({
      title: "Conta transferida!",
      description: `A conta da Mesa ${tableNumber} foi transferida para o PDV.`,
    });
  };

  const formatCurrency = (value: number) => {
    if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00';
    try {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(value);
    } catch (e) {
      return 'R$ 0,00';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const operatorSelected = !!getOperatorSession()?.id;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50/50">
      <FirstOperatorDialog open={mustCreateOperator} onCreated={async () => { setMustCreateOperator(false); await checkFirstOperator(); }} />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col min-h-0">
        {/* Top Header Bar - Consolidated */}
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b shrink-0 z-20 gap-2 sm:gap-4">
          <TabsList className="grid w-48 sm:w-64 grid-cols-2">
            <TabsTrigger value="products">Vendas</TabsTrigger>
            <TabsTrigger value="accounts">Mesas</TabsTrigger>
          </TabsList>

          {activeTab === 'products' && (
            <div className="flex-1 max-w-md flex items-center gap-2 justify-end sm:justify-start">
              <div className="relative w-full sm:w-auto sm:flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar produtos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-9 bg-gray-50 border-gray-200 focus:bg-white transition-colors w-full"
                />
              </div>
              <Button variant="ghost" size="icon" onClick={() => fetchData()} className="shrink-0 h-9 w-9">
                <RefreshCw size={16} />
              </Button>
              <Badge variant={cashSession?.id ? 'default' : 'destructive'} className="hidden sm:inline-flex">
                {cashSession?.id ? 'Caixa Aberto' : 'Caixa Fechado'}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => openCashDialog(cashSession?.id ? 'close' : 'open')}
              >
                {cashSession?.id ? 'Fechar Caixa' : 'Abrir Caixa'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                disabled={!cashSession?.id}
                onClick={() => { setCashMoveType('in'); setCashMoveOpen(true); }}
              >
                Suprimento
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                disabled={!cashSession?.id}
                onClick={() => { setCashMoveType('out'); setCashMoveOpen(true); }}
              >
                Sangria
              </Button>
              <OperatorSwitcher />
            </div>
          )}
        </div>

        <TabsContent value="products" className="flex-1 overflow-hidden data-[state=active]:flex flex-col lg:flex-row mt-0 min-h-0">
          {/* Left Column: Products (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-4 lg:p-6 lg:border-r">
            <Card className="h-full flex flex-col border-none shadow-none bg-transparent">
              <div className="flex-1 overflow-y-auto pb-24 lg:pb-0">
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">
                      {searchQuery ? 'Nenhum produto encontrado.' : 'Nenhum produto disponível.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
                    {filteredProducts.map((product) => (
                      <Card 
                        key={product.id} 
                        className="hover:shadow-lg transition-all cursor-pointer group active:scale-95 duration-100 flex flex-col overflow-hidden border-gray-200"
                        onClick={(e) => handleProductClick(product, e)}
                      >
                        <div className="aspect-square relative overflow-hidden bg-gray-100">
                          {product.image_url ? (
                            <img 
                              id={`product-img-${product.id}`}
                              src={product.image_url} 
                              alt={product.name} 
                              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          ) : (
                            <div 
                              id={`product-img-${product.id}`}
                              className="w-full h-full flex items-center justify-center"
                            >
                              <Store className="text-gray-300 w-8 h-8" />
                            </div>
                          )}
                          <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-bold shadow-sm border border-gray-100">
                            {formatCurrency(product.price)}
                          </div>
                        </div>
                        <CardContent className="p-2 flex-1 flex flex-col justify-between bg-white">
                          <h3 className="font-medium text-xs sm:text-sm line-clamp-2 leading-tight mb-2" title={product.name}>
                            {product.name}
                          </h3>
                          <Button 
                            className="w-full bg-primary/5 text-primary hover:bg-primary hover:text-white h-7 text-xs font-medium"
                            size="sm"
                            variant="ghost"
                          >
                            Adicionar
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right Column: Cart (Desktop) */}
          <div className="hidden lg:flex lg:w-[380px] xl:w-[420px] bg-white flex-col h-full shadow-xl z-20 border-l">
            <div className="p-3 border-b bg-gray-50/80 backdrop-blur-sm shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="text-primary w-5 h-5" />
                <h2 className="font-bold text-base">Carrinho</h2>
                <span className="ml-auto text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {cart.reduce((acc, item) => acc + item.quantity, 0)} itens
                </span>
              </div>
              
              <Tabs value={orderType} onValueChange={(value) => setOrderType(value as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-8">
                  <TabsTrigger value="counter" className="text-xs h-7">Balcão</TabsTrigger>
                  <TabsTrigger value="delivery" className="text-xs h-7">Entrega</TabsTrigger>
                  <TabsTrigger value="pickup" className="text-xs h-7">Retirada</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Cart Items List - Scrollable */}
            <div 
              id="cart-container" 
              ref={cartContainerRef}
              className="flex-1 overflow-y-auto p-0 min-h-0"
            >
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-2 p-4">
                  <Store size={40} strokeWidth={1.5} />
                  <p className="text-sm">Carrinho vazio</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {cart.map((item, index) => {
                    const formattedVariations = formatSelectedVariations(item.selectedVariations);
                    return (
                      <div key={`${item.id}-${index}`} className="flex items-start justify-between p-3 hover:bg-gray-50 transition-colors group">
                        <div className="flex-1 min-w-0 pr-3">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-medium text-sm text-gray-900 leading-tight line-clamp-2">
                              {item.name}
                            </span>
                            <span className="font-bold text-sm text-gray-900 ml-2 whitespace-nowrap">
                              {formatCurrency(item.price * item.quantity)}
                            </span>
                          </div>
                          
                          <div className="flex items-center text-xs text-gray-500 mb-1">
                             <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-medium mr-2">
                               {item.quantity}x
                             </span>
                             <span>{formatCurrency(item.price)} un.</span>
                          </div>

                          {formattedVariations.length > 0 && (
                            <div className="text-[11px] text-gray-500 leading-tight mb-1">
                              {formattedVariations.join(', ')}
                            </div>
                          )}
                          
                          {item.notes && (
                            <div className="text-[11px] text-amber-600 italic bg-amber-50 px-1.5 py-0.5 rounded inline-block mt-0.5">
                              {item.notes}
                            </div>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-400 hover:text-red-500 hover:bg-red-50 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Checkout Form & Totals - Fixed at Bottom */}
            <div className="bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] shrink-0 z-30">
              <div className="p-3 space-y-3">
                {/* Compact Form */}
                <div className="space-y-2">
                   <div className="flex gap-2">
                      <Input
                        placeholder={orderType === 'dine_in' ? "Nome (Opcional)" : (orderType === 'counter' ? "CPF na Nota (Opcional)" : "Nome *")}
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="h-8 text-xs"
                      />
                      {orderType !== 'counter' && (
                        <Input
                          placeholder="Tel"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="h-8 text-xs w-28 shrink-0"
                        />
                      )}
                    </div>

                    {orderType === 'delivery' && (
                      <>
                        <Input
                          placeholder="Endereço *"
                          value={customerAddress}
                          onChange={(e) => setCustomerAddress(e.target.value)}
                          className="h-8 text-xs"
                        />
                        <Select value={selectedDeliveryZone} onValueChange={setSelectedDeliveryZone}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Bairro *" />
                          </SelectTrigger>
                          <SelectContent>
                            {deliveryZones.map((zone) => (
                              <SelectItem key={zone.id} value={zone.id}>
                                {zone.name} (+{formatCurrency(zone.delivery_fee)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    )}

                    {orderType === 'dine_in' ? (
                      <div className="flex gap-2 items-center">
                         <Select value={selectedTable} onValueChange={setSelectedTable}>
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue placeholder="Selecione a Mesa *" />
                            </SelectTrigger>
                            <SelectContent>
                              {tables.length > 0 ? (
                                tables.map((table) => (
                                  <SelectItem key={table.id} value={table.id}>
                                    Mesa {table.table_number} {table.status !== 'available' ? '(Ocupada)' : ''}
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="p-2 text-xs text-center text-muted-foreground">
                                  Nenhuma mesa cadastrada
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-red-500 hover:bg-red-50"
                            onClick={() => {
                              setOrderType('delivery');
                              setSelectedTable('');
                            }}
                          >
                            <Minus size={16} />
                          </Button>
                      </div>
                    ) : null}
                    
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={paymentMethod === 'pix' ? 'default' : 'outline'}
                          className="h-8 text-xs"
                          onClick={() => { setPaymentMethod('pix'); setTefData(null); }}
                        >
                          PIX
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={paymentMethod === 'cartao' ? 'default' : 'outline'}
                          className="h-8 text-xs"
                          onClick={() => { setPaymentMethod('cartao'); setCardProcessingMode('maquininha'); setTefOpen(false); }}
                        >
                          Cartão
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={paymentMethod === 'dinheiro' ? 'default' : 'outline'}
                          className="h-8 text-xs"
                          onClick={() => { setPaymentMethod('dinheiro'); setTefData(null); }}
                        >
                          Dinheiro
                        </Button>
                      </div>
                      {paymentMethod === 'dinheiro' && (
                        <Input
                          placeholder="Valor pago"
                          value={changeAmount}
                          onChange={(e) => setChangeAmount(e.target.value)}
                          className="h-8 text-xs"
                          type="number"
                        />
                      )}
                      {paymentMethod === 'cartao' && (
                        tefSettings.enabled ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant={cardProcessingMode === 'maquininha' ? 'default' : 'outline'}
                                className="h-8 text-xs"
                                onClick={() => { setCardProcessingMode('maquininha'); setTefData(null); setTefOpen(false); }}
                              >
                                Maquininha
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={cardProcessingMode === 'tef' ? 'default' : 'outline'}
                                className="h-8 text-xs"
                                onClick={() => { setCardProcessingMode('tef'); setTefOpen(true); }}
                              >
                                TEF
                              </Button>
                            </div>
                            {cardProcessingMode === 'tef' && (
                              <Button type="button" size="sm" variant="outline" className="h-8 text-xs w-full" onClick={() => setTefOpen(true)}>
                                Editar dados TEF
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">Cartão via maquininha</div>
                        )
                      )}
                    </div>
                </div>

                {/* Totals Summary */}
                <div className="bg-gray-50 rounded-lg p-2 text-xs space-y-1 border">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal</span>
                    <span>{formatCurrency(getTotalValue())}</span>
                  </div>
                  {getDeliveryFee() > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>Entrega</span>
                      <span>{formatCurrency(getDeliveryFee())}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm text-gray-900 pt-1 border-t border-gray-200 mt-1">
                    <span>Total</span>
                    <span>{formatCurrency(getFinalTotal())}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                       if (orderType === 'dine_in') {
                         addToTable();
                       } else {
                         setOrderType('dine_in');
                         setCustomerName('');
                       }
                    }}
                    disabled={processing || cart.length === 0}
                    className="w-full h-10 text-xs font-bold border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    {processing && orderType === 'dine_in' ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-700"></div>
                    ) : (
                      <>
                        <UtensilsCrossed className="mr-1 h-3 w-3" />
                        {orderType === 'dine_in' ? 'Confirmar' : 'Mesa'}
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={handleFinalizeSale}
                    disabled={processing || cart.length === 0}
                    className="w-full bg-green-600 hover:bg-green-700 h-10 text-sm font-bold shadow-sm"
                  >
                    {processing && orderType !== 'dine_in' ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <>
                        Finalizar
                        <span className="ml-1 opacity-90 text-xs font-normal">
                          {formatCurrency(getFinalTotal())}
                        </span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Mobile Cart Floating Button */}
          <Sheet>
            <SheetTrigger asChild>
              <div 
                id="mobile-cart-btn" 
                ref={mobileCartBtnRef}
                className="lg:hidden fixed bottom-4 right-4 z-50"
              >
                <div className="relative">
                    <Button className="h-14 w-14 rounded-full shadow-xl bg-primary text-white p-0 flex items-center justify-center">
                      <Calculator size={24} />
                    </Button>
                    {cart.length > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-white">
                        {cart.reduce((acc, item) => acc + item.quantity, 0)}
                      </span>
                    )}
                </div>
              </div>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[90vh] flex flex-col p-0">
               <SheetHeader className="p-4 border-b">
                 <SheetTitle>Carrinho de Compras</SheetTitle>
               </SheetHeader>
               
               <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-2">
                      <Store size={48} />
                      <p>Carrinho vazio</p>
                    </div>
                  ) : (
                    cart.map((item, index) => {
                      const formattedVariations = formatSelectedVariations(item.selectedVariations);
                      return (
                        <div key={`mob-${item.id}-${index}`} className="flex flex-col p-3 border rounded-lg bg-gray-50">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1 mr-2">
                              <span className="font-medium text-sm line-clamp-1">{item.name}</span>
                              <span className="text-xs text-muted-foreground block">
                                {formatCurrency(item.price)} un.
                              </span>
                            </div>
                            <span className="font-bold text-sm">
                              {formatCurrency(item.price * item.quantity)}
                            </span>
                          </div>
                          
                          {formattedVariations.length > 0 && (
                            <div className="text-xs text-gray-500 mb-2 pl-2 border-l-2 border-gray-200">
                              {formattedVariations.map((v, i) => (
                                <div key={i}>{v}</div>
                              ))}
                            </div>
                          )}
                          
                          {item.notes && (
                            <div className="text-xs text-amber-600 mb-2 italic bg-amber-50 p-1 rounded">
                              Obs: {item.notes}
                            </div>
                          )}

                          <div className="flex items-center justify-end gap-2">
                             <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            >
                              <Minus size={12} />
                            </Button>
                            <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            >
                              <Plus size={12} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 ml-2"
                              onClick={() => removeFromCart(item.id)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
               </div>

               {/* Mobile Checkout Form */}
               <div className="p-4 bg-white border-t">
                  <div className="space-y-3 mb-4 max-h-40 overflow-y-auto pr-1">
                    <div className="flex gap-2">
                      <Input
                        placeholder={orderType === 'dine_in' ? "Nome (Opcional)" : "Nome *"}
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="h-9 text-sm"
                      />
                      <Input
                        placeholder="Telefone"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>

                    {orderType === 'delivery' && (
                      <>
                        <Input
                          placeholder="Endereço Completo *"
                          value={customerAddress}
                          onChange={(e) => setCustomerAddress(e.target.value)}
                          className="h-9 text-sm"
                        />
                        <Select value={selectedDeliveryZone} onValueChange={setSelectedDeliveryZone}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Selecione o Bairro *" />
                          </SelectTrigger>
                          <SelectContent>
                            {deliveryZones.map((zone) => (
                              <SelectItem key={zone.id} value={zone.id}>
                                {zone.name} (+{formatCurrency(zone.delivery_fee)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    )}

                   {orderType === 'dine_in' ? (
                     <div className="flex gap-2 items-center">
                        <Select value={selectedTable} onValueChange={setSelectedTable}>
                           <SelectTrigger className="h-9 text-sm flex-1">
                             <SelectValue placeholder="Selecione a Mesa *" />
                           </SelectTrigger>
                           <SelectContent>
                             {tables.length > 0 ? (
                               tables.map((table) => (
                                 <SelectItem key={table.id} value={table.id}>
                                   Mesa {table.table_number} {table.status !== 'available' ? '(Ocupada)' : ''}
                                 </SelectItem>
                               ))
                             ) : (
                               <div className="p-2 text-xs text-center text-muted-foreground">
                                 Nenhuma mesa cadastrada
                               </div>
                             )}
                           </SelectContent>
                         </Select>
                         <Button 
                           variant="ghost" 
                           size="icon" 
                           className="h-9 w-9 text-red-500 hover:bg-red-50"
                           onClick={() => {
                             setOrderType('delivery');
                             setSelectedTable('');
                           }}
                         >
                           <Minus size={16} />
                         </Button>
                     </div>
                   ) : null}
                    
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          type="button"
                          variant={paymentMethod === 'pix' ? 'default' : 'outline'}
                          onClick={() => { setPaymentMethod('pix'); setTefData(null); }}
                        >
                          PIX
                        </Button>
                        <Button
                          type="button"
                          variant={paymentMethod === 'cartao' ? 'default' : 'outline'}
                          onClick={() => { setPaymentMethod('cartao'); setCardProcessingMode('maquininha'); setTefOpen(false); }}
                        >
                          Cartão
                        </Button>
                        <Button
                          type="button"
                          variant={paymentMethod === 'dinheiro' ? 'default' : 'outline'}
                          onClick={() => { setPaymentMethod('dinheiro'); setTefData(null); }}
                        >
                          Dinheiro
                        </Button>
                      </div>
                      {paymentMethod === 'dinheiro' && (
                        <Input
                          placeholder="Valor pago"
                          value={changeAmount}
                          onChange={(e) => setChangeAmount(e.target.value)}
                          className="h-9 text-sm"
                          type="number"
                        />
                      )}
                      {paymentMethod === 'cartao' && (
                        tefSettings.enabled ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                type="button"
                                variant={cardProcessingMode === 'maquininha' ? 'default' : 'outline'}
                                onClick={() => { setCardProcessingMode('maquininha'); setTefData(null); setTefOpen(false); }}
                              >
                                Maquininha
                              </Button>
                              <Button
                                type="button"
                                variant={cardProcessingMode === 'tef' ? 'default' : 'outline'}
                                onClick={() => { setCardProcessingMode('tef'); setTefOpen(true); }}
                              >
                                TEF
                              </Button>
                            </div>
                            {cardProcessingMode === 'tef' && (
                              <Button type="button" variant="outline" className="h-9 text-sm w-full" onClick={() => setTefOpen(true)}>
                                Editar dados TEF
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">Cartão via maquininha</div>
                        )
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 text-sm mb-4">
                    <div className="flex justify-between text-gray-500">
                      <span>Subtotal</span>
                      <span>{formatCurrency(getTotalValue())}</span>
                    </div>
                    {getDeliveryFee() > 0 && (
                      <div className="flex justify-between text-gray-500">
                        <span>Entrega</span>
                        <span>{formatCurrency(getDeliveryFee())}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t">
                      <span>Total</span>
                      <span>{formatCurrency(getFinalTotal())}</span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => {
                       if (orderType === 'dine_in') {
                         addToTable();
                       } else {
                         setOrderType('dine_in');
                         setCustomerName('');
                       }
                    }}
                    disabled={processing || cart.length === 0}
                    className="w-full h-12 text-lg font-bold border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    {processing && orderType === 'dine_in' ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-700"></div>
                    ) : (
                      <>
                        <UtensilsCrossed className="mr-2 h-4 w-4" />
                        {orderType === 'dine_in' ? 'Confirmar' : 'Mesa'}
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={handleFinalizeSale}
                    disabled={processing || cart.length === 0 || !cashSession?.id || !operatorSelected}
                    className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg font-bold"
                  >
                    {processing && orderType !== 'dine_in' ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>
                        Finalizar
                        <span className="ml-2 text-sm font-normal opacity-90">
                          {formatCurrency(getFinalTotal())}
                        </span>
                      </>
                    )}
                  </Button>
               </div>
            </SheetContent>
          </Sheet>
        </TabsContent>

        <TabsContent value="accounts" className="flex-1 overflow-y-auto p-4 mt-0">
          <TableAccountManager onFinalize={handleTableFinalization} />
        </TabsContent>
      </Tabs>

      {selectedProduct && (
        <ProductVariationModal
          isOpen={showVariationModal}
          product={selectedProduct}
          variations={productVariations}
          onAddToCart={(product, quantity, variations, notes) => {
            addToCart({...product, available: true}, quantity, variations, notes);
          }}
          onClose={() => {
            setShowVariationModal(false);
            setSelectedProduct(null);
            setProductVariations([]);
          }}
        />
      )}

      <PixPaymentModal
        isOpen={isPixModalOpen}
        onClose={() => setIsPixModalOpen(false)}
        amount={pixAmount}
        orderId={pixOrderId}
        onPaymentConfirmed={async () => {
          if (!pixOrderId) return;
          try {
            const { error: updateError } = await supabase
              .from('orders')
              .update({ acceptance_status: 'pending_acceptance' })
              .eq('id', pixOrderId);
            if (!updateError) {
              toast({
                title: "Pagamento confirmado!",
                description: "Pedido enviado ao restaurante.",
              });
              setNfceModalOpen(true);
              setCart([]);
              setCustomerName('');
              setCustomerPhone('');
              setCustomerAddress('');
              setSelectedDeliveryZone('');
              setSelectedTable('');
              setChangeAmount('');
              setPaymentMethod('pix');
              setOrderType('delivery');
            }
          } catch (e) {
            console.error(e);
          }
        }}
      />

      <NFCeEmissionModal
        isOpen={nfceModalOpen}
        onClose={() => setNfceModalOpen(false)}
        order={createdOrderForNfce}
        onSuccess={() => {}}
      />

      <Dialog open={tefOpen} onOpenChange={setTefOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cartão (TEF)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>NSU</Label>
              <Input value={tefData?.nsu || ''} onChange={(e) => setTefData(prev => ({ nsu: e.target.value, auth: prev?.auth || '', brand: prev?.brand || '', acquirer: prev?.acquirer || '', installments: prev?.installments || '' }))} placeholder="NSU" />
            </div>
            <div className="space-y-2">
              <Label>Autorização</Label>
              <Input value={tefData?.auth || ''} onChange={(e) => setTefData(prev => ({ nsu: prev?.nsu || '', auth: e.target.value, brand: prev?.brand || '', acquirer: prev?.acquirer || '', installments: prev?.installments || '' }))} placeholder="Código de autorização" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Bandeira</Label>
                <Input value={tefData?.brand || ''} onChange={(e) => setTefData(prev => ({ nsu: prev?.nsu || '', auth: prev?.auth || '', brand: e.target.value, acquirer: prev?.acquirer || '', installments: prev?.installments || '' }))} placeholder="Visa/Master/..." />
              </div>
              <div className="space-y-2">
                <Label>Parcelas</Label>
                <Input value={tefData?.installments || ''} onChange={(e) => setTefData(prev => ({ nsu: prev?.nsu || '', auth: prev?.auth || '', brand: prev?.brand || '', acquirer: prev?.acquirer || '', installments: e.target.value.replace(/\\D/g, '') }))} placeholder="1" inputMode="numeric" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Adquirente</Label>
              <Input value={tefData?.acquirer || ''} onChange={(e) => setTefData(prev => ({ nsu: prev?.nsu || '', auth: prev?.auth || '', brand: prev?.brand || '', acquirer: e.target.value, installments: prev?.installments || '' }))} placeholder="Ex: Stone / Cielo / Rede" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCardProcessingMode('maquininha'); setTefData(null); setTefOpen(false); }}>Pular</Button>
            <Button onClick={() => setTefOpen(false)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cashMoveOpen} onOpenChange={setCashMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{cashMoveType === 'in' ? 'Suprimento' : 'Sangria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input value={cashMoveAmount} onChange={(e) => setCashMoveAmount(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input value={cashMoveDesc} onChange={(e) => setCashMoveDesc(e.target.value)} placeholder="Ex: troco / retirada" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCashMoveOpen(false)}>Cancelar</Button>
            <Button onClick={submitCashMovement}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminPinDialog
        open={adminPinOpen}
        title="Sangria"
        description="Digite o PIN de administrador para autorizar a sangria."
        confirmLabel="Autorizar"
        onCancel={() => setAdminPinOpen(false)}
        onConfirm={async (pin) => {
          const restaurantUserId = user?.id || '';
          if (!restaurantUserId) {
            toast({ title: 'Erro', description: 'Usuário não autenticado', variant: 'destructive' });
            return;
          }
          const res = await verifyAdminPin({ restaurantUserId, pin });
          if (!res.ok) {
            toast({ title: 'Sem permissão', description: 'PIN inválido ou não é administrador', variant: 'destructive' });
            return;
          }
          setAdminPinOpen(false);
          const amount = Number(cashMoveAmount.replace(',', '.'));
          if (!cashSession?.id) return;
          const { error } = await (supabase as any).from('cash_movements').insert({
            session_id: cashSession.id,
            user_id: restaurantUserId,
            type: cashMoveType,
            amount,
            description: cashMoveDesc || null,
          });
          if (error) {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' });
            return;
          }
          toast({ title: cashMoveType === 'in' ? 'Suprimento registrado' : 'Sangria registrada' });
          setCashMoveOpen(false);
          setCashMoveAmount('');
          setCashMoveDesc('');
        }}
      />

      <Dialog open={cashDialogOpen} onOpenChange={setCashDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{cashDialogMode === 'open' ? 'Abrir Caixa' : 'Fechar Caixa'}</DialogTitle>
          </DialogHeader>
          {cashDialogMode === 'open' ? (
            <div className="space-y-2">
              <Label>Valor inicial</Label>
              <Input value={cashAmountInput} onChange={(e) => setCashAmountInput(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
          ) : (
            <div className="space-y-4">
              {cashCloseLoading ? (
                <div className="text-sm text-muted-foreground">Carregando resumo do caixa...</div>
              ) : cashCloseSummary ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border rounded-md p-3">
                      <div className="text-xs text-muted-foreground">Abertura</div>
                      <div className="text-lg font-bold">{formatCurrency(cashCloseSummary.initial)}</div>
                    </div>
                    <div className="border rounded-md p-3">
                      <div className="text-xs text-muted-foreground">Vendas (total)</div>
                      <div className="text-lg font-bold">{formatCurrency(cashCloseSummary.total)}</div>
                    </div>
                    <div className="border rounded-md p-3">
                      <div className="text-xs text-muted-foreground">PIX</div>
                      <div className="text-lg font-bold">{formatCurrency(cashCloseSummary.pix)}</div>
                    </div>
                    <div className="border rounded-md p-3">
                      <div className="text-xs text-muted-foreground">Cartão</div>
                      <div className="text-lg font-bold">{formatCurrency(cashCloseSummary.card)}</div>
                    </div>
                    <div className="border rounded-md p-3">
                      <div className="text-xs text-muted-foreground">Dinheiro (vendas)</div>
                      <div className="text-lg font-bold">{formatCurrency(cashCloseSummary.cash)}</div>
                    </div>
                    <div className="border rounded-md p-3">
                      <div className="text-xs text-muted-foreground">Suprimento / Sangria</div>
                      <div className="text-lg font-bold">
                        {formatCurrency(cashCloseSummary.inAmount)} / {formatCurrency(cashCloseSummary.outAmount)}
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-md p-3 bg-gray-50">
                    <div className="text-xs text-muted-foreground">Saldo esperado em dinheiro</div>
                    <div className="text-xl font-bold">{formatCurrency(cashCloseSummary.expectedCash)}</div>
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">Não foi possível calcular o resumo do caixa.</div>
              )}

              <div className="space-y-2">
                <Label>Valor contado em dinheiro</Label>
                <Input value={cashAmountInput} onChange={(e) => setCashAmountInput(e.target.value)} placeholder="0,00" inputMode="decimal" />
                {cashCloseSummary && (
                  <div className="text-xs text-muted-foreground">
                    Diferença: {formatCurrency(((Number.isFinite(Number(cashAmountInput.replace(',', '.'))) ? Number(cashAmountInput.replace(',', '.')) : 0) - cashCloseSummary.expectedCash))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCashDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCashSubmit} disabled={cashDialogMode === 'close' && cashCloseLoading}>
              {cashDialogMode === 'open' ? 'Abrir' : 'Fechar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PDV;
