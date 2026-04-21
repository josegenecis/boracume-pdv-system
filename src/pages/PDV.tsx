import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Minus, Trash2, Calculator, Search, Store, UtensilsCrossed, RefreshCw, Wallet } from 'lucide-react';
import OperatorSwitcher from '@/components/OperatorSwitcher';
import { useToast } from '@/hooks/use-toast';
import { normalizeImageUrlForDisplay } from '@/utils/normalizeImageUrl';
import { formatBRL } from '@/lib/currency';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ProductVariationModal from '@/components/pdv/ProductVariationModal';
import PixPaymentModal from '@/components/payment/PixPaymentModal';
import PixCheckoutModal from '@/components/payment/PixCheckoutModal';
import TableManager from '@/components/tables/TableManager';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import FirstOperatorDialog from '@/components/pdv/FirstOperatorDialog';
import NFCeEmissionModal from '@/components/nfce/NFCeEmissionModal';
import AdminPinDialog from '@/components/security/AdminPinDialog';
import { getLocalOperatorSession, isAdminOperator } from '@/services/operatorAuth';
import { verifyAdminPin } from '@/services/adminPin';
import { useTefSettings } from '@/hooks/useTefSettings';
import { PrinterService } from '@/utils/printerService';
import { invokeEdgeFunction } from '@/utils/invokeEdgeFunction';
import { notifyOrderCreatedById } from '@/utils/orderNotifications';
import { ensureDefaultTables } from '@/utils/tableDefaults';
import { updateOrderStatus as updateOrderStatusRemote } from '@/utils/updateOrderStatus';
import { useSidebar } from '@/contexts/SidebarContext';
import { useNavigate } from 'react-router-dom';

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

type SelectedVariationsPayload =
  | string[]
  | {
      options?: string[];
      variationLines?: string[];
    };

interface CartItem extends Product {
  cartItemId: string;
  quantity: number;
  selectedVariations?: SelectedVariationsPayload;
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
  const [mpPixCheckout, setMpPixCheckout] = useState<null | { correlationID: string; brCode: string; qrCodeImage?: string; paymentLinkUrl?: string; paymentId?: string }>(null);
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
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isMobile } = useSidebar();
  const { settings: tefSettings } = useTefSettings();
  const navigate = useNavigate();

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

    try {
      if (cashDialogMode === 'open') {
        if (cashSession?.id) {
          toast({ title: 'Caixa já está aberto' });
          setCashDialogOpen(false);
          return;
        }
        const payload: any = {
          user_id: user.id,
          initial_amount: amount,
          status: 'open',
          opened_at: new Date().toISOString(),
        };
        if (waiterId) payload.opened_by_waiter_id = waiterId;
        let error: any = null;
        const res1 = await supabase.from('cash_register_sessions' as any).insert(payload);
        error = (res1 as any).error;
        if (error && String(error.message || '').includes('opened_by_waiter_id')) {
          const { opened_by_waiter_id, ...fallback } = payload;
          const res2 = await supabase.from('cash_register_sessions' as any).insert(fallback);
          error = (res2 as any).error;
        }
        if (error && (error.code === '23505' || String(error.message || '').toLowerCase().includes('cash_register_sessions_one_open_per_user'))) {
          await fetchOpenCashSession();
          toast({ title: 'Caixa já está aberto' });
          setCashDialogOpen(false);
          return;
        }
        if (error) throw error;
        toast({ title: 'Caixa aberto' });
        await PrinterService.printCashReport({
          title: 'Abertura de Caixa',
          userId: user.id,
          lines: [
            `Data/Hora: ${new Date().toLocaleString('pt-BR')}`,
            `Valor inicial: R$ ${amount.toFixed(2)}`,
            operatorSession?.name ? `Operador: ${operatorSession.name}` : ''
          ].filter(Boolean) as string[]
        });
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
        };
        if (waiterId) updatePayload.closed_by_waiter_id = waiterId;
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
        await PrinterService.printCashReport({
          title: 'Fechamento de Caixa',
          userId: user.id,
          lines: [
            `Data/Hora: ${new Date().toLocaleString('pt-BR')}`,
            `Valor informado: R$ ${amount.toFixed(2)}`,
            cashCloseSummary?.expectedCash != null ? `Valor esperado: R$ ${Number(cashCloseSummary.expectedCash).toFixed(2)}` : '',
            cashCloseSummary?.pix != null ? `PIX: R$ ${Number(cashCloseSummary.pix).toFixed(2)}` : '',
            cashCloseSummary?.card != null ? `Cartão: R$ ${Number(cashCloseSummary.card).toFixed(2)}` : '',
            cashCloseSummary?.cash != null ? `Dinheiro (vendas): R$ ${Number(cashCloseSummary.cash).toFixed(2)}` : '',
            cashCloseSummary?.inAmount != null ? `Suprimentos: R$ ${Number(cashCloseSummary.inAmount).toFixed(2)}` : '',
            cashCloseSummary?.outAmount != null ? `Sangrias: R$ ${Number(cashCloseSummary.outAmount).toFixed(2)}` : '',
            operatorSession?.name ? `Operador: ${operatorSession.name}` : ''
          ].filter(Boolean) as string[]
        });
      }
      setCashDialogOpen(false);
      await fetchOpenCashSession();
      window.dispatchEvent(new CustomEvent('cash-session-changed'));
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
      await PrinterService.printCashReport({
        title: cashMoveType === 'in' ? 'Suprimento' : 'Sangria',
        userId: user.id,
        lines: [
          `Data/Hora: ${new Date().toLocaleString('pt-BR')}`,
          `Valor: R$ ${amount.toFixed(2)}`,
          cashMoveDesc ? `Descrição: ${cashMoveDesc}` : '',
          session?.name ? `Operador: ${session.name}` : ''
        ].filter(Boolean) as string[]
      });
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
      let data: any = null;
      let error: any = null;

      const res1 = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user?.id)
        .eq('available', true)
        .eq('show_in_pdv', true)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      data = res1.data;
      error = res1.error;

      if (error && String(error.message || '').includes('display_order')) {
        const res2 = await supabase
          .from('products')
          .select('*')
          .eq('user_id', user?.id)
          .eq('available', true)
          .eq('show_in_pdv', true)
          .order('name', { ascending: true });
        data = res2.data;
        error = res2.error;
      }

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
      const data = await ensureDefaultTables(user?.id);
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
      let productVariations: any[] | null = null;
      let productError: any = null;
      const res1 = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', productId)
        .order('display_order', { ascending: true });
      productVariations = res1.data as any;
      productError = res1.error as any;
      if (productError && String(productError.message || '').includes('display_order')) {
        const res2 = await supabase
          .from('product_variations')
          .select('*')
          .eq('product_id', productId)
          .order('name', { ascending: true });
        productVariations = res2.data as any;
        productError = res2.error as any;
      }

      // Buscar variações globais associadas ao produto
      const { data: globalVariationLinks, error: globalError } = await supabase
        .from('product_global_variation_links')
        .select('global_variation_id,required,min_selections,max_selections,display_order')
        .eq('product_id', productId)
        .order('display_order', { ascending: true });

      // Buscar as variações globais pelos IDs
      let globalVariations: any[] = [];
      if (globalVariationLinks && globalVariationLinks.length > 0) {
        const globalVariationIds = (globalVariationLinks as any[]).map((link: any) => link.global_variation_id);
        
        const { data: globalVars, error: globalVarError } = await supabase
          .from('global_variations')
          .select('*')
          .in('id', globalVariationIds);

        if (globalVars) {
          const linkById = new Map((globalVariationLinks as any[]).map((l: any) => [String(l.global_variation_id), l]));
          globalVariations = globalVars.map((globalVar: any) => {
            const link = linkById.get(String(globalVar.id));
            return {
              ...globalVar,
              required: link?.required !== undefined && link?.required !== null ? Boolean(link.required) : Boolean(globalVar.required),
              min_selections: link?.min_selections ?? 0,
              max_selections: link?.max_selections ?? (globalVar.max_selections ?? 1),
              display_order: link?.display_order
            };
          });
        }
      }

      // Combinar todas as variações
      const allVariations = [...(productVariations || []), ...globalVariations];
      
      const formattedVariations: (ProductVariation & { display_order?: number })[] = allVariations
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
              required: Boolean(item.required),
              display_order: item.display_order
            };
          } catch (itemError) {
            return null;
          }
        })
        .filter((variation): variation is ProductVariation => variation !== null);

      const sorted = [...formattedVariations].sort((a: any, b: any) => {
        const ao = a.display_order !== undefined && a.display_order !== null ? Number(a.display_order) : 10_000;
        const bo = b.display_order !== undefined && b.display_order !== null ? Number(b.display_order) : 10_000;
        if (ao !== bo) return ao - bo;
        return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
      });
      
      return sorted as ProductVariation[];
    } catch (error) {
      console.error('Erro geral ao carregar variações:', error);
      return [];
    }
  };

  const handleProductClick = async (product: Product) => {
    const variations = await fetchProductVariations(product.id);
    
    if (variations.length > 0) {
      setSelectedProduct(product);
      setProductVariations(variations);
      setShowVariationModal(true);
    } else {
      addToCart(product, 1);
    }
  };

  const makeCartItemId = () => {
    try {
      if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
    } catch {}
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const unpackSelectedVariations = (value: SelectedVariationsPayload | undefined) => {
    if (!value) return { options: [] as string[], variationLines: [] as string[] };
    if (Array.isArray(value)) return { options: value.map((v) => String(v || '').trim()).filter(Boolean), variationLines: [] as string[] };
    const options = Array.isArray(value.options) ? value.options.map((v) => String(v || '').trim()).filter(Boolean) : [];
    const variationLines = Array.isArray(value.variationLines) ? value.variationLines.map((v) => String(v || '').trim()).filter(Boolean) : [];
    return { options, variationLines };
  };

  const addToCart = (product: Product, quantity: number = 1, selectedVariations: SelectedVariationsPayload = [], notes: string = '') => {
    setCart(prev => {
      const variationKey = JSON.stringify(selectedVariations) + notes;
      const existing = prev.find(item => 
        item.id === product.id && 
        JSON.stringify(item.selectedVariations) === JSON.stringify(selectedVariations) &&
        item.notes === notes
      );
      
      if (existing) {
        return prev.map(item =>
          item.cartItemId === existing.cartItemId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      
      return [...prev, { 
        ...product, 
        cartItemId: makeCartItemId(),
        quantity, 
        selectedVariations: (() => {
          if (Array.isArray(selectedVariations)) return selectedVariations.length > 0 ? selectedVariations : undefined;
          const { options, variationLines } = unpackSelectedVariations(selectedVariations);
          if (options.length === 0 && variationLines.length === 0) return undefined;
          return { options, variationLines };
        })(),
        notes: notes || undefined
      }];
    });

    toast({
      title: "Produto adicionado",
      description: `${product.name} foi adicionado ao pedido.`,
      duration: 1500,
    });
  };

  // Helper function to format selected variations for display
  const formatSelectedVariations = (selectedVariations?: SelectedVariationsPayload) => {
    const { options, variationLines } = unpackSelectedVariations(selectedVariations);
    if (variationLines.length > 0) return variationLines;
    if (options.length === 0) return [];
    
    try {
      return options;
    } catch (error) {
      console.error('Error formatting variations:', error);
      return [];
    }
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(prev => prev.filter(item => item.cartItemId !== cartItemId));
  };

  const updateQuantity = (cartItemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.cartItemId === cartItemId ? { ...item, quantity: newQuantity } : item
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
        title: "Pedido vazio",
        description: "Adicione produtos ao pedido antes de adicionar à mesa.",
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

    if (!cashSession?.id) {
      toast({
        title: "Caixa fechado",
        description: "Abra o caixa antes de lançar itens em mesas.",
        variant: "destructive",
      });
      openCashDialog('open');
      return;
    }

    try {
      setProcessing(true);

      const orderItems = cart.map(item => {
        const { options, variationLines } = unpackSelectedVariations(item.selectedVariations);
        return {
        product_id: item.id,
        product_name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity,
        options,
        variations: variationLines,
        notes: item.notes || ''
        };
      });

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
      setMobileCartOpen(false);
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
        title: "Pedido vazio",
        description: "Adicione produtos ao pedido antes de finalizar a venda.",
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
      
        const orderItems = cart.map(item => {
          const { options, variationLines } = unpackSelectedVariations(item.selectedVariations);
          return {
        product_id: item.id,
        product_name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity,
        options,
        variations: variationLines,
        notes: item.notes || ''
          };
        });

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
        status: paymentMethod === 'pix' ? 'pending' : 'preparing',
        acceptance_status: paymentMethod === 'pix' ? 'awaiting_pix_payment' : 'accepted',
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

      if (paymentMethod === 'pix') {
        const { data: pixCfg, error: pixCfgErr } = await supabase
          .from('pix_settings')
          .select('enabled, bank, client_id, mp_access_token, mp_pdv_enabled')
          .eq('user_id', user?.id)
          .maybeSingle()

        if (pixCfgErr) {
          toast({ title: 'PIX', description: pixCfgErr.message || 'Falha ao carregar configuração do PIX.', variant: 'destructive' });
        }

        const useMpPixPdv =
          Boolean((pixCfg as any)?.enabled) &&
          String((pixCfg as any)?.bank || '').toLowerCase() === 'mercadopago' &&
          Boolean((pixCfg as any)?.mp_pdv_enabled) &&
          Boolean((pixCfg as any)?.client_id || (pixCfg as any)?.mp_access_token)

        if (!useMpPixPdv && (pixCfg as any)?.enabled && String((pixCfg as any)?.bank || '').toLowerCase() === 'mercadopago') {
          if (!(pixCfg as any)?.mp_pdv_enabled) {
            toast({ title: 'PIX', description: 'Mercado Pago no PDV está desativado em Configurações → PIX.', variant: 'destructive' });
          } else if (!((pixCfg as any)?.client_id || (pixCfg as any)?.mp_access_token)) {
            toast({ title: 'PIX', description: 'Mercado Pago não está conectado. Conecte em Configurações → PIX.', variant: 'destructive' });
          }
        }

        if (useMpPixPdv) {
          const mpPayload = {
            ...orderData,
            payment_method: 'pix',
            status: 'preparing',
            acceptance_status: 'accepted',
          }

          const { data: checkout } = await invokeEdgeFunction<any>('pix-start-checkout', {
            restaurantUserId: user?.id,
            orderPayload: mpPayload,
            preferredMethod: 'pix',
          }, { timeoutMs: 60000 })

          if (!checkout?.ok || !checkout?.brCode || !checkout?.correlationID) {
            throw new Error(checkout?.error || checkout?.message || 'Falha ao gerar QR do Mercado Pago')
          }

          setMpPixCheckout({
            correlationID: String(checkout.correlationID),
            brCode: String(checkout.brCode),
            qrCodeImage: checkout.qrCodeImage ? String(checkout.qrCodeImage) : undefined,
            paymentLinkUrl: checkout.paymentLinkUrl ? String(checkout.paymentLinkUrl) : undefined,
            paymentId: checkout.paymentId ? String(checkout.paymentId) : undefined,
          })
          setPixAmount(getFinalTotal())
          toast({ title: 'Aguardando pagamento', description: 'Escaneie o QR Code para concluir a venda.' })
          return
        }
      }

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

      const created = Array.isArray(data) ? data[0] : data;

      try {
        await notifyOrderCreatedById(created?.id);
      } catch (waErr) {
        console.warn('Falha ao notificar pedido via WhatsApp:', waErr);
      }

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
        setCreatedOrderForNfce(created || null);
        try {
          await PrinterService.printOrder(created);
        } catch (e) {
          console.warn('Falha ao imprimir automaticamente:', e);
        }
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
        setMobileCartOpen(false);
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
    return formatBRL(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const operatorSelected = !!getOperatorSession()?.id;
  const cartItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const mobileOrderTypeOptions: Array<{ value: 'counter' | 'delivery' | 'pickup' | 'dine_in'; label: string }> = [
    { value: 'counter', label: 'Balcão' },
    { value: 'delivery', label: 'Entrega' },
    { value: 'pickup', label: 'Retirada' },
    { value: 'dine_in', label: 'Mesa' },
  ];

  return (
    <div className="-mx-4 -mt-4 -mb-4 flex h-[calc(100%+1rem)] flex-col overflow-hidden bg-white sm:-mx-6 sm:-mt-6 sm:-mb-6 sm:h-[calc(100%+1.5rem)]">
      <FirstOperatorDialog open={mustCreateOperator} onCreated={async () => { setMustCreateOperator(false); await checkFirstOperator(); }} />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col min-h-0">
        <TabsContent value="products" className="flex-1 overflow-hidden data-[state=active]:flex flex-col lg:flex-row mt-0 min-h-0">
          {/* Left Column: Products (Scrollable) */}
          <div className="flex-1 overflow-y-auto scrollbar-hide px-2 pb-2 pt-0 sm:px-4 sm:pb-4 sm:pt-0 lg:border-r">
            <div className="sticky top-0 z-20 mb-3 flex flex-col gap-3 border-b border-[#FF6400]/10 bg-gradient-to-r from-[#F5EBE1] via-white to-[#FFF8F2] px-2 pb-3 pt-2 shadow-[0_18px_35px_-32px_rgba(0,50,35,0.26)] sm:px-4 lg:px-6">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <TabsList className="grid h-9 w-full grid-cols-2 rounded-xl border border-[#FF6400]/15 bg-white/80 p-1 shadow-sm xl:w-64">
                  <TabsTrigger value="products" className="h-7 rounded-lg text-sm font-semibold text-[#003223]/75 data-[state=active]:bg-[#FF6400] data-[state=active]:text-white data-[state=active]:shadow-sm">Vendas</TabsTrigger>
                  <TabsTrigger value="accounts" className="h-7 rounded-lg text-sm font-semibold text-[#003223]/75 data-[state=active]:bg-[#FF6400] data-[state=active]:text-white data-[state=active]:shadow-sm">Mesas</TabsTrigger>
                </TabsList>
                <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:flex-nowrap">
                  <div className="relative min-w-[220px] flex-1 xl:w-80 xl:flex-none">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#003223]/40" />
                    <Input
                      placeholder="Buscar produtos..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-9 w-full rounded-xl border-[#FF6400]/15 bg-white/85 pl-9 text-sm text-[#003223] transition-colors focus:bg-white focus-visible:ring-[#FF6400]/25"
                    />
                  </div>
                  <Button variant="outline" size="icon" onClick={() => fetchData()} className="h-9 w-9 shrink-0 rounded-xl border-[#FF6400]/15 bg-white/85 hover:bg-[#F5EBE1]">
                    <RefreshCw size={18} className="text-[#003223]/70" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden h-9 rounded-xl whitespace-nowrap border-[#FF6400]/15 bg-white/85 px-4 font-semibold text-[#003223] hover:bg-[#F5EBE1] md:inline-flex"
                    disabled={!cashSession?.id}
                    onClick={() => { setCashMoveType('in'); setCashMoveOpen(true); }}
                  >
                    Suprimento
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden h-9 rounded-xl whitespace-nowrap border-[#FF6400]/15 bg-white/85 px-4 font-semibold text-[#003223] hover:bg-[#F5EBE1] md:inline-flex"
                    disabled={!cashSession?.id}
                    onClick={() => { setCashMoveType('out'); setCashMoveOpen(true); }}
                  >
                    Sangria
                  </Button>
                </div>
              </div>
              <div className="space-y-2 lg:hidden">
                <div className="scrollbar-hide flex gap-2 overflow-x-auto">
                  {mobileOrderTypeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setOrderType(option.value)}
                      className={`shrink-0 rounded-2xl border px-3 py-2 text-xs font-semibold transition-colors ${
                        orderType === option.value
                          ? 'border-[#003223] bg-[#003223] text-white'
                          : 'border-[#FF6400]/15 bg-white/90 text-[#003223]'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => (cashSession?.id ? navigate('/caixa') : openCashDialog('open'))}
                    className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-left text-xs font-semibold shadow-sm ${
                      cashSession?.id
                        ? 'border-[#8CC850]/45 bg-[#F4FAEC] text-[#245B2B]'
                        : 'border-[#FF6400]/18 bg-white text-[#003223]'
                    }`}
                  >
                    <Wallet className="h-4 w-4" />
                    <span>{cashSession?.id ? 'Caixa aberto' : 'Abrir caixa'}</span>
                  </button>
                  <div className={`rounded-2xl border px-3 py-2 text-xs font-semibold shadow-sm ${operatorSelected ? 'border-[#003223]/12 bg-white text-[#003223]' : 'border-red-200 bg-red-50 text-red-600'}`}>
                    {operatorSelected ? 'Operador selecionado' : 'Selecione o operador'}
                  </div>
                </div>
              </div>
            </div>
            <Card className="h-full flex flex-col border-none shadow-none bg-transparent">
              <div className={`flex-1 ${isMobile ? 'pb-40' : 'pb-24 lg:pb-0'}`}>
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">
                      {searchQuery ? 'Nenhum produto encontrado.' : 'Nenhum produto disponível.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(130px,1fr))]">
                    {filteredProducts.map((product) => (
                      (() => {
                        const track = !!(product as any)?.track_stock;
                        const qty = Number((product as any)?.stock_quantity ?? 0) || 0;
                        const threshold = Number((product as any)?.low_stock_threshold ?? 0) || 0;
                        const isLowStock = track && qty <= threshold;
                        return (
                      <Card 
                        key={product.id} 
                        className={`cursor-pointer group flex flex-col overflow-hidden border border-[#8CC850]/60 shadow-[0_0_0_1px_rgba(140,200,80,0.08),0_0_18px_-12px_rgba(140,200,80,0.85)] transition-all duration-150 hover:shadow-[0_0_0_1px_rgba(140,200,80,0.16),0_0_22px_-10px_rgba(140,200,80,0.95)] active:scale-95 ${isLowStock ? 'animate-stock-pulse border-red-500 shadow-none' : ''}`}
                        onClick={(e) => handleProductClick(product, e)}
                      >
                        <div className="aspect-[4/3] relative overflow-hidden bg-gray-100">
                          {normalizeImageUrlForDisplay(product.image_url) ? (
                            <img 
                              id={`product-img-${product.id}`}
                              src={normalizeImageUrlForDisplay(product.image_url)} 
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
                          <div className="absolute top-2 right-2 rounded-full border border-[#003223]/10 bg-white/95 px-1.5 py-0.5 text-[11px] font-bold text-[#0B5137] shadow-sm backdrop-blur-sm">
                            {formatCurrency(product.price)}
                          </div>
                          {isLowStock && (
                            <div className="absolute top-2 left-2 bg-red-600 text-white rounded-full px-1.5 py-0.5 text-[9px] font-bold shadow-sm">
                              Estoque baixo
                            </div>
                          )}
                        </div>
                        <CardContent className="p-1.5 flex-1 flex flex-col justify-between bg-white">
                          <h3 className="font-medium text-[11px] sm:text-xs line-clamp-2 leading-tight mb-1.5" title={product.name}>
                            {product.name}
                          </h3>
                          <Button 
                            className="h-6 w-full border border-[#8CC850]/70 bg-white text-[#0B5137] shadow-none hover:border-[#FF6400] hover:bg-[#FF6400] hover:text-white text-[10px] font-semibold"
                            size="sm"
                            variant="ghost"
                          >
                            Adicionar
                          </Button>
                        </CardContent>
                      </Card>
                        );
                      })()
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right Column: Cart (Desktop) */}
          <div className="hidden lg:flex lg:w-[380px] xl:w-[420px] bg-white flex-col h-full z-20 border-l border-[#FF6400]/10">
            <div className="border-b border-[#FF6400]/10 bg-gradient-to-r from-[#FFF8F2] via-white to-[#F5EBE1]/70 p-3 backdrop-blur-sm shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="text-primary w-5 h-5" />
                <h2 className="font-bold text-base">Pedido</h2>
                <span className="ml-auto text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {cart.reduce((acc, item) => acc + item.quantity, 0)} itens
                </span>
              </div>
              
              <Tabs value={orderType} onValueChange={(value) => setOrderType(value as any)} className="w-full">
                <TabsList className="grid h-10 w-full grid-cols-3 items-center rounded-xl border border-[#FF6400]/12 bg-[#F5EBE1]/85 p-1">
                  <TabsTrigger value="counter" className="flex h-8 items-center justify-center rounded-lg text-xs font-semibold text-[#003223]/70 data-[state=active]:bg-[#FF6400] data-[state=active]:text-white">Balcão</TabsTrigger>
                  <TabsTrigger value="delivery" className="flex h-8 items-center justify-center rounded-lg text-xs font-semibold text-[#003223]/70 data-[state=active]:bg-[#FF6400] data-[state=active]:text-white">Entrega</TabsTrigger>
                  <TabsTrigger value="pickup" className="flex h-8 items-center justify-center rounded-lg text-xs font-semibold text-[#003223]/70 data-[state=active]:bg-[#FF6400] data-[state=active]:text-white">Retirada</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Cart Items List - Scrollable */}
            <div 
              id="cart-container" 
              ref={cartContainerRef}
              className="flex-1 overflow-y-auto scrollbar-hide p-0 min-h-0"
            >
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-2 p-4">
                  <Store size={40} strokeWidth={1.5} />
                  <p className="text-sm">Sem itens</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {cart.map((item, index) => {
                    const formattedVariations = formatSelectedVariations(item.selectedVariations);
                    const seq = String(index + 1).padStart(2, '0');
                    return (
                      <div key={item.cartItemId} className="flex items-start justify-between p-3 hover:bg-gray-50 transition-colors group">
                        <div className="flex-1 min-w-0 pr-3">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-medium text-sm text-gray-900 leading-tight line-clamp-2">
                              <span className="text-gray-500 mr-1">{seq}.</span>
                              {item.name}
                            </span>
                            <span className="font-bold text-sm text-gray-900 ml-2 whitespace-nowrap">
                              {formatCurrency(item.price * item.quantity)}
                            </span>
                          </div>
                          
                          <div className="flex items-center text-xs text-gray-500 mb-1 gap-2">
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                              >
                                <Minus size={12} />
                              </Button>
                              <span className="w-7 text-center text-xs font-medium text-gray-700">{item.quantity}</span>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                              >
                                <Plus size={12} />
                              </Button>
                            </div>
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
                          onClick={() => removeFromCart(item.cartItemId)}
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
          
          {/* Mobile Cart Summary */}
          <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                id="mobile-cart-btn" 
                ref={mobileCartBtnRef}
                className="mobile-safe-x lg:hidden fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+5.8rem)] z-40 flex w-full items-center justify-between rounded-[26px] border border-[#003223]/12 bg-[#003223] px-4 py-3 text-left text-white shadow-[0_20px_40px_-24px_rgba(0,50,35,0.55)]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                    <Calculator className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">
                      {cartItemsCount > 0 ? `${cartItemsCount} item(ns) no pedido` : 'Abrir pedido'}
                    </div>
                    <div className="truncate text-xs text-white/75">
                      {mobileOrderTypeOptions.find((option) => option.value === orderType)?.label || 'Balcão'} • {operatorSelected ? 'operador ok' : 'selecione operador'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/70">Total</div>
                  <div className="text-base font-bold">{formatCurrency(getFinalTotal())}</div>
                </div>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[88vh] flex flex-col p-0">
               <SheetHeader className="p-4 border-b">
                 <SheetTitle className="flex items-center justify-between gap-3">
                   <span>Pedido</span>
                   <span className="text-sm font-normal text-muted-foreground">{cartItemsCount} item(ns)</span>
                 </SheetTitle>
               </SheetHeader>
               <div className="border-b bg-[#F8FBF8] px-4 py-3">
                  <div className="scrollbar-hide flex gap-2 overflow-x-auto">
                    {mobileOrderTypeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setOrderType(option.value)}
                        className={`shrink-0 rounded-2xl border px-3 py-2 text-xs font-semibold transition-colors ${
                          orderType === option.value
                            ? 'border-[#003223] bg-[#003223] text-white'
                            : 'border-[#DCE6DF] bg-white text-[#003223]'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
               </div>
               
               <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-2">
                      <Store size={48} />
                      <p>Sem itens</p>
                    </div>
                  ) : (
                    cart.map((item, index) => {
                      const formattedVariations = formatSelectedVariations(item.selectedVariations);
                      const seq = String(index + 1).padStart(2, '0');
                      return (
                        <div key={item.cartItemId} className="flex flex-col p-3 border rounded-lg bg-gray-50">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1 mr-2">
                              <span className="font-medium text-sm line-clamp-1">
                                <span className="text-muted-foreground mr-1">{seq}.</span>
                                {item.name}
                              </span>
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
                              onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                            >
                              <Minus size={12} />
                            </Button>
                            <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                            >
                              <Plus size={12} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 ml-2"
                              onClick={() => removeFromCart(item.cartItemId)}
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

          <TabsContent value="accounts" className="flex-1 overflow-y-auto mt-0">
            <div className="sticky top-0 z-20 border-b border-[#FF6400]/10 bg-gradient-to-r from-[#F5EBE1] via-white to-[#FFF8F2] px-4 pb-3 pt-2 shadow-[0_18px_35px_-32px_rgba(0,50,35,0.26)]">
              <TabsList className="grid h-9 w-full max-w-64 grid-cols-2 rounded-xl border border-[#FF6400]/15 bg-white/80 p-1 shadow-sm">
                <TabsTrigger value="products" className="h-7 rounded-lg text-sm font-semibold text-[#003223]/75 data-[state=active]:bg-[#FF6400] data-[state=active]:text-white data-[state=active]:shadow-sm">Vendas</TabsTrigger>
                <TabsTrigger value="accounts" className="h-7 rounded-lg text-sm font-semibold text-[#003223]/75 data-[state=active]:bg-[#FF6400] data-[state=active]:text-white data-[state=active]:shadow-sm">Mesas</TabsTrigger>
              </TabsList>
            </div>
            <div className="p-4">
              <TableManager />
            </div>
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

      {mpPixCheckout ? (
        <PixCheckoutModal
          isOpen={!!mpPixCheckout}
          onClose={() => setMpPixCheckout(null)}
          correlationID={mpPixCheckout.correlationID}
          brCode={mpPixCheckout.brCode}
          qrCodeImage={mpPixCheckout.qrCodeImage}
          paymentLinkUrl={mpPixCheckout.paymentLinkUrl}
          paymentId={mpPixCheckout.paymentId}
          onPaid={(orderId) => {
            void (async () => {
              setMpPixCheckout(null);
              try {
                const { data: order } = await supabase
                  .from('orders')
                  .select('*')
                  .eq('id', orderId)
                  .maybeSingle();

                const resolvedOrder =
                  order ||
                  ({
                    id: orderId,
                    user_id: user?.id,
                    order_number: 'PIX',
                    created_at: new Date().toISOString(),
                    items: cart,
                    total: pixAmount,
                    delivery_fee: getDeliveryFee(),
                    payment_method: 'pix',
                    customer_name: customerName,
                  } as any);

                setCreatedOrderForNfce(resolvedOrder);
                try {
                  await PrinterService.printOrder(resolvedOrder);
                } catch (e) {
                  console.warn('Falha ao imprimir automaticamente (PIX):', e);
                }
                toast({
                  title: "Pagamento confirmado!",
                  description: "Pedido entrou em preparo e foi enviado para impressão.",
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
              } catch (e: any) {
                console.error(e);
                toast({ title: 'Erro', description: e?.message || 'Não foi possível concluir a venda.', variant: 'destructive' });
              }
            })();
          }}
        />
      ) : null}

      <PixPaymentModal
        isOpen={isPixModalOpen}
        onClose={() => setIsPixModalOpen(false)}
        amount={pixAmount}
        orderId={pixOrderId}
        onPaymentConfirmed={async () => {
          if (!pixOrderId) return;
          try {
            const updated = await updateOrderStatusRemote(pixOrderId, 'preparing');
            try {
              await PrinterService.printOrder(updated || { id: pixOrderId, user_id: user?.id, order_number: 'PIX', created_at: new Date().toISOString(), items: cart, total: pixAmount, delivery_fee: getDeliveryFee(), payment_method: 'pix', customer_name: customerName });
            } catch (e) {
              console.warn('Falha ao imprimir automaticamente (PIX):', e);
            }
            toast({
              title: "Pagamento confirmado!",
              description: "Pedido entrou em preparo e foi enviado para impressão.",
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
