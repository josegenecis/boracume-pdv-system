import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  addWaiterItem,
  cancelWaiterDraftItem,
  createWaiterAccount,
  formatMoney,
  getWaiterSessionDetails,
  listWaiterCatalog,
  loadWaiterCatalogCache,
  loadWaiterSessionCache,
  loadWaiterWebSession,
  logoutWaiterWeb,
  mergeWaiterAccounts,
  moveWaiterItem,
  PaymentMethod,
  Product,
  ProductCategory,
  ProductOption,
  recordWaiterPayments,
  releaseWaiterTable,
  removeWaiterAccount,
  renameWaiterAccount,
  requestWaiterCheck,
  sendAllWaiterSessionItems,
  sendWaiterAccountItems,
  TableAccount,
  TableSession,
  transferWaiterAccount,
  transferWaiterTable,
  updateWaiterDraftItem,
  WaiterPaymentInput,
} from '@/services/waiterWebClient';
import { normalizeImageUrlForDisplay } from '@/utils/normalizeImageUrl';
import { WaiterBottomNav } from '@/components/waiter-web/WaiterBottomNav';
import { WaiterEmptyState } from '@/components/waiter-web/WaiterEmptyState';
import { WaiterStatusBadge } from '@/components/waiter-web/WaiterStatusBadge';
import {
  ArrowLeft,
  Check,
  ChefHat,
  CircleDollarSign,
  Clock3,
  MoveRight,
  NotebookPen,
  PackageOpen,
  Plus,
  PlusCircle,
  ReceiptText,
  RefreshCw,
  Search,
  Send,
  Users,
} from 'lucide-react';

type PaymentLine = {
  id: string;
  accountId: string;
  method: PaymentMethod;
  amount: string;
};

const createPaymentLine = (accountId: string, amount: number, method: PaymentMethod = 'pix'): PaymentLine => ({
  id: `${accountId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  accountId,
  method,
  amount: amount > 0 ? amount.toFixed(2) : '',
});

const buildOptionLabel = (groupName: string, optionName: string) => `${groupName}: ${optionName}`;

const WaiterSessionPage = () => {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<TableSession | null>(() => loadWaiterSessionCache(sessionId));
  const [catalog, setCatalog] = useState<ProductCategory[]>(() => loadWaiterCatalogCache()?.categories || []);
  const [loading, setLoading] = useState(!loadWaiterSessionCache(sessionId));
  const [syncing, setSyncing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [accountDialogMode, setAccountDialogMode] = useState<'create' | 'edit'>('create');
  const [editingAccountId, setEditingAccountId] = useState('');
  const [accountName, setAccountName] = useState('');
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productDialogStep, setProductDialogStep] = useState<'browse' | 'configure'>('browse');
  const [catalogAccountId, setCatalogAccountId] = useState('');
  const [editingItemId, setEditingItemId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<Record<string, ProductOption[]>>({});
  const [quantity, setQuantity] = useState('1');
  const [itemNotes, setItemNotes] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([]);
  const [moveItemId, setMoveItemId] = useState('');
  const [moveTargetAccountId, setMoveTargetAccountId] = useState('');
  const [moveQuantity, setMoveQuantity] = useState('1');
  const [mergeSourceAccountId, setMergeSourceAccountId] = useState('');
  const [mergeTargetAccountId, setMergeTargetAccountId] = useState('');
  const [transferAccountId, setTransferAccountId] = useState('');
  const [transferAccountTargetId, setTransferAccountTargetId] = useState('');
  const [transferTableOpen, setTransferTableOpen] = useState(false);
  const [transferTableTargetId, setTransferTableTargetId] = useState('');
  const [activeTab, setActiveTab] = useState<'accounts' | 'timeline' | 'payments'>('accounts');
  const [sessionLoadIssue, setSessionLoadIssue] = useState('');
  const [catalogLoadIssue, setCatalogLoadIssue] = useState('');
  const deferredProductSearch = useDeferredValue(productSearch);

  const applySession = (nextSession: TableSession) => {
    setSession(nextSession);
  };

  const accountMap = useMemo(() => {
    const map = new Map<string, TableAccount>();
    (session?.accounts || []).forEach((account) => map.set(account.id, account));
    return map;
  }, [session]);

  const paymentHistory = useMemo(() => {
    return (session?.accounts || [])
      .flatMap((account) =>
        account.payments.map((payment) => ({
          ...payment,
          accountName: account.name,
        })),
      )
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }, [session]);

  const hasDraftAccounts = useMemo(() => {
    return (session?.accounts || []).some((account) => account.draftCount > 0);
  }, [session]);

  const catalogProducts = useMemo(() => catalog.flatMap((category) => category.products), [catalog]);
  const activeAccount = catalogAccountId ? accountMap.get(catalogAccountId) || null : null;
  const editingItem = useMemo(() => {
    if (!editingItemId || !session) return null;
    return session.accounts.flatMap((account) => account.items).find((item) => item.id === editingItemId) || null;
  }, [editingItemId, session]);
  const selectedProduct = selectedProductId ? catalogProducts.find((product) => product.id === selectedProductId) || null : null;

  const filteredCategories = useMemo(() => {
    const normalizedSearch = deferredProductSearch.trim().toLowerCase();

    return catalog
      .map((category) => ({
        ...category,
        products: category.products.filter((product) => {
          const matchesCategory = selectedCategoryId === 'all' || category.id === selectedCategoryId;
          const matchesSearch =
            !normalizedSearch ||
            product.name.toLowerCase().includes(normalizedSearch) ||
            String(product.description || '').toLowerCase().includes(normalizedSearch);
          return matchesCategory && matchesSearch;
        }),
      }))
      .filter((category) => category.products.length > 0);
  }, [catalog, deferredProductSearch, selectedCategoryId]);

  const transferTableChoices = useMemo(() => {
    return (session?.tableChoices || []).filter(
      (table) => table.canReceiveTableTransfer && table.id !== session?.tableId && table.status !== 'occupied',
    );
  }, [session]);

  const accountTransferChoices = useMemo(() => {
    return (session?.tableChoices || []).filter((table) => table.canReceiveAccountTransfer && table.id !== session?.tableId);
  }, [session]);

  const loadSession = async (silent = false) => {
    if (!sessionId) return;

    if (silent) {
      setSyncing(true);
    } else {
      setLoading((current) => current && !session);
    }

    try {
      const currentWaiterSession = await loadWaiterWebSession();
      if (!currentWaiterSession) {
        navigate('/waiter-login', { replace: true });
        return;
      }

      const response = await getWaiterSessionDetails(sessionId);
      applySession(response.session);
      setSessionLoadIssue('');
    } catch (error: any) {
      const message = String(error?.message || 'Nao foi possivel carregar a mesa.');
      if (!silent || !session) {
        setSessionLoadIssue(message);
      }

      if (message.toLowerCase().includes('sess')) {
        await logoutWaiterWeb();
        navigate('/waiter-login', { replace: true });
        return;
      }

      if (!silent && !session) {
        toast({
          title: 'Erro ao carregar mesa',
          description: message,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  const loadCatalog = async () => {
    try {
      const response = await listWaiterCatalog();
      setCatalog(response.categories || []);
      setCatalogLoadIssue('');
    } catch (error: any) {
      const message = error?.message || 'Nao foi possivel carregar os produtos do restaurante.';
      if (!catalog.length) {
        setCatalogLoadIssue(String(message));
      }

      if (!catalog.length) {
        toast({
          title: 'Erro ao carregar cardapio',
          description: message,
          variant: 'destructive',
        });
      }
    }
  };

  useEffect(() => {
    void loadSession(false);
    void loadCatalog();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    const interval = window.setInterval(() => {
      if (document.hidden || productDialogOpen || paymentDialogOpen || accountDialogOpen || submitting) return;
      void loadSession(true);
    }, 10000);

    return () => window.clearInterval(interval);
  }, [accountDialogOpen, paymentDialogOpen, productDialogOpen, sessionId, submitting]);

  const openAccountDialog = (mode: 'create' | 'edit', account?: TableAccount) => {
    setAccountDialogMode(mode);
    setEditingAccountId(account?.id || '');
    setAccountName(account?.name || '');
    setAccountDialogOpen(true);
  };

  const buildSelectedOptionsFromItem = (product: Product, itemOptions: TableAccount['items'][number]['options']) => {
    const nextOptions: Record<string, ProductOption[]> = {};

    product.variations.forEach((group) => {
      const matches = group.options.filter((option) =>
        itemOptions.some((itemOption) => {
          const optionLabel = String(itemOption.optionName || '').trim().toLowerCase();
          return (
            optionLabel === option.name.trim().toLowerCase() ||
            optionLabel === buildOptionLabel(group.name, option.name).toLowerCase()
          );
        }),
      );
      if (matches.length) {
        nextOptions[group.id] = matches.map((option) => ({
          ...option,
          quantity: 1,
          groupName: group.name,
          optionName: buildOptionLabel(group.name, option.name),
        }));
      }
    });

    return nextOptions;
  };

  const openProductDialog = (account: TableAccount, itemId?: string) => {
    const item = itemId ? account.items.find((current) => current.id === itemId) || null : null;
    const product = item ? catalogProducts.find((current) => current.id === item.productId) || null : null;

    setCatalogAccountId(account.id);
    setEditingItemId(item?.id || '');
    setSelectedProductId(product?.id || '');
    setSelectedOptions(product && item ? buildSelectedOptionsFromItem(product, item.options) : {});
    setQuantity(String(item?.quantity || 1));
    setItemNotes(item?.notes || '');
    setProductSearch('');
    setSelectedCategoryId(product?.categoryId || 'all');
    setProductDialogStep(product ? 'configure' : 'browse');
    setProductDialogOpen(true);
  };

  const selectProductForDialog = (product: Product) => {
    setSelectedProductId(product.id);
    setSelectedOptions({});
    setQuantity('1');
    setItemNotes('');
    setProductDialogStep('configure');
  };

  const resetProductDialog = () => {
    setProductDialogOpen(false);
    setProductDialogStep('browse');
    setCatalogAccountId('');
    setEditingItemId('');
    setSelectedProductId('');
    setSelectedOptions({});
    setQuantity('1');
    setItemNotes('');
    setProductSearch('');
    setSelectedCategoryId('all');
  };

  const toggleOption = (group: Product['variations'][number], option: ProductOption) => {
    setSelectedOptions((current) => {
      const existing = current[group.id] || [];
      const alreadySelected = existing.some((item) => item.id === option.id);

      if (alreadySelected) {
        return {
          ...current,
          [group.id]: existing.filter((item) => item.id !== option.id),
        };
      }

      if (group.maxSelections > 1 && existing.length >= group.maxSelections) {
        return current;
      }

      const nextOption = {
        ...option,
        quantity: option.quantity || 1,
        groupName: group.name,
        optionName: buildOptionLabel(group.name, option.name),
      };

      const nextOptions = group.maxSelections <= 1 ? [nextOption] : [...existing, nextOption];
      return {
        ...current,
        [group.id]: nextOptions,
      };
    });
  };

  const handleSaveAccount = async () => {
    if (!session || !accountName.trim()) return;

    setSubmitting(true);
    try {
      const response =
        accountDialogMode === 'create'
          ? await createWaiterAccount(session.id, accountName.trim())
          : await renameWaiterAccount(editingAccountId, accountName.trim());

      applySession(response.session);
      setAccountDialogOpen(false);
      setEditingAccountId('');
      setAccountName('');
      toast({
        title: accountDialogMode === 'create' ? 'Comanda criada' : 'Comanda atualizada',
        description: 'A configuracao da comanda foi salva com sucesso.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro na comanda',
        description: error?.message || 'Nao foi possivel salvar a comanda.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveAccount = async (account: TableAccount) => {
    if (!session) return;

    setSubmitting(true);
    try {
      const response = await removeWaiterAccount(account.id);
      applySession(response.session);
      toast({
        title: 'Comanda removida',
        description: `${account.name} saiu da mesa.`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao remover comanda',
        description: error?.message || 'Nao foi possivel remover a comanda.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddOrUpdateItem = async () => {
    if (!session || !activeAccount || !selectedProduct) return;

    const missingRequired = selectedProduct.variations.some(
      (group) => group.required && !(selectedOptions[group.id] || []).length,
    );

    if (missingRequired) {
      toast({
        title: 'Complementos obrigatorios',
        description: 'Selecione todos os grupos obrigatorios antes de salvar o item.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        quantity: Math.max(1, Number(quantity || 1)),
        notes: itemNotes,
        selectedOptions: Object.values(selectedOptions).flat(),
      };

      const response = editingItem
        ? await updateWaiterDraftItem({
            itemId: editingItem.id,
            ...payload,
          })
        : await addWaiterItem({
            sessionId: session.id,
            accountId: activeAccount.id,
            productId: selectedProduct.id,
            ...payload,
          });

      applySession(response.session);
      resetProductDialog();
      toast({
        title: editingItem ? 'Item atualizado' : 'Item adicionado',
        description: `${selectedProduct.name} foi salvo na comanda.`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar item',
        description: error?.message || 'Nao foi possivel salvar o item.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelDraft = async (accountId: string, itemId: string) => {
    if (!session) return;

    setSubmitting(true);
    try {
      const response = await cancelWaiterDraftItem(itemId, accountId, session.id);
      applySession(response.session);
      toast({
        title: 'Rascunho removido',
        description: 'O item saiu da comanda.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao remover item',
        description: error?.message || 'Nao foi possivel remover o item.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendAccount = async (account: TableAccount) => {
    if (!session) return;

    setSubmitting(true);
    try {
      const response = await sendWaiterAccountItems(session.id, account.id);
      applySession(response.session);
      toast({
        title: 'Pedido enviado',
        description: `${account.name} foi encaminhada para a cozinha.`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar pedido',
        description: error?.message || 'Nao foi possivel enviar esta comanda.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendAllAccounts = async () => {
    if (!session) return;

    setSubmitting(true);
    try {
      const response = await sendAllWaiterSessionItems(session.id);
      applySession(response.session);
      const sentAccounts = Number(response.sentAccounts || 0);
      toast({
        title: 'Pedidos enviados',
        description:
          sentAccounts > 1
            ? `${sentAccounts} comandas foram encaminhadas para a cozinha.`
            : 'A comanda pendente foi encaminhada para a cozinha.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar pedidos',
        description: error?.message || 'Nao foi possivel enviar as comandas da mesa.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openPaymentDialog = (account?: TableAccount) => {
    if (!session) return;

    const lines = account
      ? [createPaymentLine(account.id, account.dueAmount || account.total)]
      : session.accounts
          .filter((current) => current.dueAmount > 0)
          .map((current) => createPaymentLine(current.id, current.dueAmount));

    setPaymentLines(lines.length ? lines : [createPaymentLine(session.accounts[0]?.id || '', 0)]);
    setPaymentDialogOpen(true);
  };

  const handlePaymentLineChange = (lineId: string, key: keyof PaymentLine, value: string) => {
    setPaymentLines((current) =>
      current.map((line) => (line.id === lineId ? { ...line, [key]: value } : line)),
    );
  };

  const handleSavePayments = async () => {
    if (!session) return;

    const payload: WaiterPaymentInput[] = paymentLines
      .map((line) => ({
        accountId: line.accountId,
        method: line.method,
        amount: Number(line.amount.replace(',', '.')),
      }))
      .filter((line) => line.accountId && line.amount > 0);

    if (!payload.length) {
      toast({
        title: 'Pagamento vazio',
        description: 'Informe pelo menos uma linha de pagamento valida.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await recordWaiterPayments(session.id, payload);
      applySession(response.session);
      setPaymentDialogOpen(false);
      toast({
        title: 'Pagamento registrado',
        description: 'As comandas foram atualizadas com sucesso.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao registrar pagamento',
        description: error?.message || 'Nao foi possivel salvar os pagamentos.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleMoveItem = async () => {
    if (!moveItemId || !moveTargetAccountId) return;

    setSubmitting(true);
    try {
      const response = await moveWaiterItem({
        itemId: moveItemId,
        targetAccountId: moveTargetAccountId,
        quantity: Math.max(1, Number(moveQuantity || 1)),
      });
      applySession(response.session);
      setMoveItemId('');
      setMoveTargetAccountId('');
      setMoveQuantity('1');
      toast({
        title: 'Item movido',
        description: 'O item foi redistribuido entre as comandas.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao mover item',
        description: error?.message || 'Nao foi possivel mover o item.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleMergeAccounts = async () => {
    if (!mergeSourceAccountId || !mergeTargetAccountId) return;

    setSubmitting(true);
    try {
      const response = await mergeWaiterAccounts(mergeSourceAccountId, mergeTargetAccountId);
      applySession(response.session);
      setMergeSourceAccountId('');
      setMergeTargetAccountId('');
      toast({
        title: 'Comandas unificadas',
        description: 'Os itens e pagamentos foram consolidados.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao juntar comandas',
        description: error?.message || 'Nao foi possivel juntar estas comandas.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransferAccount = async () => {
    if (!transferAccountId || !transferAccountTargetId) return;

    setSubmitting(true);
    try {
      const response = await transferWaiterAccount(transferAccountId, transferAccountTargetId);
      applySession(response.session);
      setTransferAccountId('');
      setTransferAccountTargetId('');
      toast({
        title: 'Comanda transferida',
        description: 'A comanda foi movida para a nova mesa.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao transferir comanda',
        description: error?.message || 'Nao foi possivel transferir esta comanda.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransferTable = async () => {
    if (!session || !transferTableTargetId) return;

    setSubmitting(true);
    try {
      const response = await transferWaiterTable(session.id, transferTableTargetId);
      applySession(response.session);
      setTransferTableOpen(false);
      setTransferTableTargetId('');
      toast({
        title: 'Mesa transferida',
        description: 'Toda a operacao foi levada para a nova mesa.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao transferir mesa',
        description: error?.message || 'Nao foi possivel transferir a mesa.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestCheck = async () => {
    if (!session) return;

    setSubmitting(true);
    try {
      const response = await requestWaiterCheck(session.id);
      applySession(response.session);
      toast({
        title: 'Conta sinalizada',
        description: 'A mesa entrou em fluxo de fechamento.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao solicitar conta',
        description: error?.message || 'Nao foi possivel sinalizar a conta.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReleaseTable = async () => {
    if (!session) return;

    setSubmitting(true);
    try {
      await releaseWaiterTable(session.id);
      toast({
        title: 'Mesa liberada',
        description: 'O atendimento da mesa foi encerrado.',
      });
      navigate('/waiter-dashboard', { replace: true });
    } catch (error: any) {
      toast({
        title: 'Erro ao liberar mesa',
        description: error?.message || 'Nao foi possivel liberar a mesa.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07281e]">
        <div className="h-14 w-14 animate-spin rounded-full border-4 border-[#A4D65E]/15 border-t-[#FF6400]" />
      </div>
    );
  }

  if (!session) return null;

  const showProductBrowsePane = productDialogStep === 'browse' || !selectedProduct;
  const showProductConfigurePane = Boolean(selectedProduct) && productDialogStep === 'configure';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0B5138_0%,#083927_42%,#072C1F_100%)] pb-24 text-slate-900">
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.08] p-3 text-white shadow-[0_24px_60px_-34px_rgba(0,0,0,0.75)] backdrop-blur-sm sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              className="rounded-full border-white/15 bg-white/10 px-3 text-white hover:bg-white/15 hover:text-white"
              onClick={() => navigate('/waiter-dashboard')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Mesas</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="rounded-full border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                onClick={() => void loadSession(true)}
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                onClick={() => setTransferTableOpen(true)}
              >
                <MoveRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-2.5 flex flex-col items-center text-center">
            <img
              src="/waiter/logo-boracume.png"
              alt="BoraCume"
              className="h-11 w-auto object-contain drop-shadow-[0_14px_26px_rgba(0,0,0,0.32)] sm:h-14"
            />
            <div className="mt-1.5 inline-flex rounded-full bg-white/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/75">
              App web Garcom
            </div>
            <h1 className="mt-2 text-[1.7rem] font-semibold leading-none text-white sm:mt-3 sm:text-3xl">{session.tableLabel}</h1>
            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-white/75 sm:text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1">
                <Clock3 className="h-3.5 w-3.5 text-[#A4D65E]" />
                {Math.max(0, Math.floor((Date.now() - new Date(session.openedAt).getTime()) / 60000))} min
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1">
                <Users className="h-3.5 w-3.5 text-[#A4D65E]" />
                {session.accountCount} comandas
              </span>
              <WaiterStatusBadge
                status={
                  session.status === 'payment_pending'
                    ? 'check_requested'
                    : session.readyItemsCount > 0
                      ? 'ready'
                      : session.sentItemsCount > 0
                        ? 'preparing'
                        : 'occupied'
                }
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-1.5 sm:gap-2">
            <div className="rounded-[16px] border border-white/10 bg-white/[0.08] px-2.5 py-2 text-left">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/60">Total</span>
                <ReceiptText className="h-3.5 w-3.5 text-[#A4D65E]" />
              </div>
              <div className="mt-1.5 text-base font-semibold text-white sm:text-lg">{formatMoney(session.total)}</div>
            </div>
            <div className="rounded-[16px] border border-white/10 bg-white/[0.08] px-2.5 py-2 text-left">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/60">Recebido</span>
                <CircleDollarSign className="h-3.5 w-3.5 text-[#A4D65E]" />
              </div>
              <div className="mt-1.5 text-base font-semibold text-white sm:text-lg">{formatMoney(session.paidTotal)}</div>
            </div>
            <div className="rounded-[16px] border border-white/10 bg-white/[0.08] px-2.5 py-2 text-left">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/60">Saldo</span>
                <NotebookPen className="h-3.5 w-3.5 text-[#A4D65E]" />
              </div>
              <div className="mt-1.5 text-base font-semibold text-white sm:text-lg">{formatMoney(session.dueAmount)}</div>
            </div>
            <div className="rounded-[16px] border border-white/10 bg-white/[0.08] px-2.5 py-2 text-left">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/60">Cozinha</span>
                <ChefHat className="h-3.5 w-3.5 text-[#A4D65E]" />
              </div>
              <div className="mt-1.5 text-base font-semibold text-white sm:text-lg">
                {session.sentItemsCount} <span className="text-xs text-white/60">/ {session.readyItemsCount} prontos</span>
              </div>
            </div>
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:gap-2">
            <Button className="h-9 rounded-xl bg-[#FF6400] px-3 text-sm text-white hover:bg-[#E25A00]" onClick={() => openAccountDialog('create')}>
              <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
              Nova
            </Button>
            <Button
              variant="outline"
              className="h-9 rounded-xl border-white/15 bg-white/10 px-3 text-sm text-white hover:bg-white/15 hover:text-white"
              onClick={handleSendAllAccounts}
              disabled={submitting || !hasDraftAccounts}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Enviar tudo
            </Button>
            <Button variant="outline" className="h-9 rounded-xl border-white/15 bg-white/10 px-3 text-sm text-white hover:bg-white/15 hover:text-white" onClick={handleRequestCheck} disabled={submitting || session.dueAmount <= 0}>
              Solicitar conta
            </Button>
            <Button className="h-9 rounded-xl bg-[#082F23] px-3 text-sm text-white hover:bg-[#0B4A36]" onClick={() => openPaymentDialog()} disabled={submitting || session.dueAmount <= 0}>
              Receber
            </Button>
            <Button variant="outline" className="h-9 rounded-xl border-white/15 bg-white/10 px-3 text-sm text-white hover:bg-white/15 hover:text-white" onClick={handleReleaseTable} disabled={submitting || session.dueAmount > 0}>
              Liberar
            </Button>
          </div>

          {sessionLoadIssue || catalogLoadIssue ? (
            <div className="mt-3 rounded-[18px] border border-amber-200/40 bg-amber-100/10 px-3 py-2 text-left text-xs leading-5 text-white/80">
              Sincronizacao instavel. O app continua com os ultimos dados salvos enquanto tenta reconectar.
            </div>
          ) : null}
        </div>

        <div className="mt-4">
          <Card className="rounded-[26px] border border-[#DCE6D8] bg-white shadow-sm">
            <CardContent className="space-y-4 p-3 sm:p-4">
              <div>
                <h2 className="text-lg font-semibold text-[#082F23] sm:text-xl">Pedido</h2>
              </div>

              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'accounts' | 'timeline' | 'payments')} className="w-full">
                <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-[#F1F5EF] p-1">
                  <TabsTrigger value="accounts" className="rounded-xl text-sm">
                    Comandas
                  </TabsTrigger>
                  <TabsTrigger value="timeline" className="rounded-xl text-sm">
                    Historico
                  </TabsTrigger>
                  <TabsTrigger value="payments" className="rounded-xl text-sm">
                    Pagamentos
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="accounts" className="mt-4">
                  {session.accounts.length === 0 ? (
                    <WaiterEmptyState
                      icon={<PackageOpen className="h-7 w-7" />}
                      title="Nenhuma comanda aberta"
                      description="Crie uma nova comanda para comecar a operar esta mesa."
                      action={
                        <Button className="rounded-2xl bg-[#FF6400] hover:bg-[#E25A00]" onClick={() => openAccountDialog('create')}>
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Criar comanda
                        </Button>
                      }
                    />
                  ) : (
                    <div className="grid gap-3 xl:grid-cols-2">
                      {session.accounts.map((account) => (
                        <Card key={account.id} className="rounded-[22px] border border-[#DCE6D8] bg-[#FBFCFA] shadow-sm">
                          <CardContent className="space-y-3 p-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-base font-semibold text-[#082F23]">{account.name}</h3>
                                  <WaiterStatusBadge status={account.status} />
                                  {account.kitchenStatus !== 'idle' ? <WaiterStatusBadge status={account.kitchenStatus} /> : null}
                                </div>
                                <p className="text-xs leading-5 text-slate-500">
                                  {account.itemCount} itens, {account.draftCount} em rascunho e {account.readyCount} prontos.
                                </p>
                              </div>

                              <div className="grid min-w-[210px] grid-cols-3 gap-2">
                                <div className="rounded-2xl bg-white p-2">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Subtotal</div>
                                  <div className="mt-1 text-sm font-semibold text-[#082F23]">{formatMoney(account.total)}</div>
                                </div>
                                <div className="rounded-2xl bg-white p-2">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Recebido</div>
                                  <div className="mt-1 text-sm font-semibold text-[#082F23]">{formatMoney(account.paidTotal)}</div>
                                </div>
                                <div className="rounded-2xl bg-white p-2">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Pendente</div>
                                  <div className="mt-1 text-sm font-semibold text-[#082F23]">{formatMoney(account.dueAmount)}</div>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <Button className="h-10 rounded-2xl bg-[#082F23] text-sm hover:bg-[#0B4A36]" onClick={() => openProductDialog(account)}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Produto
                              </Button>
                              <Button
                                variant="outline"
                                className="h-10 rounded-2xl text-sm"
                                onClick={() => handleSendAccount(account)}
                                disabled={submitting || account.draftCount === 0}
                              >
                                <Send className="mr-2 h-4 w-4" />
                                Enviar
                              </Button>
                              <Button variant="outline" className="h-10 rounded-2xl text-sm" onClick={() => openPaymentDialog(account)} disabled={account.dueAmount <= 0}>
                                Receber
                              </Button>
                              <Button variant="outline" className="h-10 rounded-2xl text-sm" onClick={() => openAccountDialog('edit', account)}>
                                Editar
                              </Button>
                              <Button
                                variant="outline"
                                className="h-10 rounded-2xl text-sm"
                                onClick={() => {
                                  setMergeSourceAccountId(account.id);
                                  setMergeTargetAccountId('');
                                }}
                                disabled={session.accounts.length < 2}
                              >
                                Juntar
                              </Button>
                              <Button
                                variant="outline"
                                className="h-10 rounded-2xl text-sm"
                                onClick={() => {
                                  setTransferAccountId(account.id);
                                  setTransferAccountTargetId('');
                                }}
                              >
                                Transferir
                              </Button>
                              <Button
                                variant="outline"
                                className="h-10 rounded-2xl text-sm"
                                onClick={() => void handleRemoveAccount(account)}
                                disabled={submitting || account.itemCount > 0 || account.paidTotal > 0}
                              >
                                Excluir
                              </Button>
                            </div>

                            <div className="space-y-3">
                              {account.items.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-[#D7E2D3] bg-white px-4 py-4 text-sm text-slate-500">
                                  Esta comanda ainda nao possui itens.
                                </div>
                              ) : (
                                account.items.map((item) => (
                                  <div key={item.id} className="rounded-2xl border border-[#E7ECE4] bg-white p-3">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                      <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="font-semibold text-[#082F23]">
                                            {item.quantity}x {item.productName}
                                          </span>
                                          <WaiterStatusBadge status={item.status} />
                                        </div>
                                        <div className="text-sm text-slate-500">
                                          {item.options.length ? item.options.map((option) => option.optionName).join(', ') : 'Sem complementos'}
                                        </div>
                                        {item.notes ? <div className="text-sm text-slate-400">Obs: {item.notes}</div> : null}
                                      </div>
                                      <div className="text-right">
                                        <div className="text-base font-semibold text-[#082F23]">{formatMoney(item.totalPrice)}</div>
                                        {item.sentAt ? (
                                          <div className="text-xs text-slate-400">
                                            {new Date(item.sentAt).toLocaleTimeString('pt-BR', {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                            })}
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>

                                    {item.status === 'draft' ? (
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        <Button variant="outline" className="h-9 rounded-2xl text-sm" onClick={() => openProductDialog(account, item.id)}>
                                          Editar item
                                        </Button>
                                        <Button
                                          variant="outline"
                                          className="h-9 rounded-2xl text-sm"
                                          onClick={() => {
                                            setMoveItemId(item.id);
                                            setMoveTargetAccountId('');
                                            setMoveQuantity(String(item.quantity));
                                          }}
                                          disabled={session.accounts.length < 2}
                                        >
                                          Mover item
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          className="h-9 rounded-2xl text-sm text-[#FF6400] hover:bg-[#FFF3EB] hover:text-[#E25A00]"
                                          onClick={() => void handleCancelDraft(account.id, item.id)}
                                        >
                                          Remover
                                        </Button>
                                      </div>
                                    ) : null}
                                  </div>
                                ))
                              )}
                            </div>

                            {account.tickets.length ? (
                              <div className="rounded-2xl bg-[#F4F8F2] p-3">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Envios para cozinha</div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {account.tickets.map((ticket) => (
                                    <div key={ticket.id} className="rounded-full border border-[#D7E2D3] bg-white px-3 py-1 text-xs text-slate-600">
                                      {ticket.orderNumber || 'Pedido'} - {ticket.status}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="timeline" className="mt-4">
                  {session.history.length === 0 ? (
                    <WaiterEmptyState
                      icon={<Clock3 className="h-7 w-7" />}
                      title="Sem movimentacoes ainda"
                      description="Assim que itens forem enviados ou pagamentos forem registrados, o historico aparecera aqui."
                    />
                  ) : (
                    <ScrollArea className="h-[360px] pr-3 sm:h-[520px]">
                      <div className="space-y-3">
                        {session.history.map((entry) => (
                          <div key={entry.id} className="rounded-2xl border border-[#E7ECE4] bg-[#FBFCFA] p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="font-semibold text-[#082F23]">{entry.label}</div>
                                <div className="text-sm text-slate-500">
                                  {new Date(entry.timestamp).toLocaleString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                              </div>
                              {entry.amount ? <div className="font-semibold text-[#082F23]">{formatMoney(entry.amount)}</div> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>

                <TabsContent value="payments" className="mt-4">
                  <div className="grid gap-4 lg:grid-cols-[0.9fr,1.1fr]">
                    <div className="space-y-3">
                      {session.accounts.map((account) => (
                        <div key={account.id} className="rounded-2xl border border-[#E7ECE4] bg-[#FBFCFA] p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-[#082F23]">{account.name}</div>
                              <div className="mt-1 text-sm text-slate-500">
                                Recebido {formatMoney(account.paidTotal)} de {formatMoney(account.total)}
                              </div>
                            </div>
                            <WaiterStatusBadge status={account.status} />
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <div className="rounded-2xl bg-white p-3">
                              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Recebido</div>
                              <div className="mt-1 text-base font-semibold text-[#082F23]">{formatMoney(account.paidTotal)}</div>
                            </div>
                            <div className="rounded-2xl bg-white p-3">
                              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Saldo</div>
                              <div className="mt-1 text-base font-semibold text-[#082F23]">{formatMoney(account.dueAmount)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-[#082F23]">Historico de pagamentos</h3>
                          <p className="text-sm text-slate-500">Tudo o que ja entrou no caixa desta mesa.</p>
                        </div>
                        <Button className="rounded-2xl bg-[#FF6400] hover:bg-[#E25A00]" onClick={() => openPaymentDialog()} disabled={session.dueAmount <= 0}>
                          Registrar
                        </Button>
                      </div>

                      {paymentHistory.length === 0 ? (
                        <WaiterEmptyState
                          icon={<CircleDollarSign className="h-7 w-7" />}
                          title="Nenhum pagamento lancado"
                          description="Quando algum recebimento entrar, ele aparecera com comanda, valor e forma de pagamento."
                        />
                      ) : (
                        <div className="space-y-3">
                          {paymentHistory.map((payment) => (
                            <div key={payment.id} className="rounded-2xl border border-[#E7ECE4] bg-[#FBFCFA] p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-[#082F23]">{payment.accountName}</div>
                                  <div className="mt-1 text-sm uppercase tracking-[0.14em] text-slate-400">{payment.method}</div>
                                  <div className="mt-1 text-sm text-slate-500">
                                    {new Date(payment.createdAt).toLocaleString('pt-BR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </div>
                                </div>
                                <div className="font-semibold text-[#082F23]">{formatMoney(payment.amount)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      <WaiterBottomNav
        items={[
          {
            key: 'accounts',
            label: 'Comandas',
            icon: <ReceiptText className="h-5 w-5" />,
            active: activeTab === 'accounts',
            onClick: () => setActiveTab('accounts'),
          },
          {
            key: 'payments',
            label: 'Pagamentos',
            icon: <CircleDollarSign className="h-5 w-5" />,
            active: activeTab === 'payments',
            onClick: () => setActiveTab('payments'),
          },
          {
            key: 'timeline',
            label: 'Historico',
            icon: <Clock3 className="h-5 w-5" />,
            active: activeTab === 'timeline',
            onClick: () => setActiveTab('timeline'),
          },
          {
            key: 'tables',
            label: 'Mesas',
            icon: <ArrowLeft className="h-5 w-5" />,
            onClick: () => navigate('/waiter-dashboard'),
          },
        ]}
      />

      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent className="rounded-[28px] border-0 sm:max-w-md">
          <DialogTitle className="text-2xl font-semibold text-[#082F23]">
            {accountDialogMode === 'create' ? 'Nova comanda' : 'Editar comanda'}
          </DialogTitle>
          <DialogDescription>
            Nomeie a comanda para separar familias, casais ou pagantes independentes dentro da mesa.
          </DialogDescription>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accountName">Nome da comanda</Label>
              <Input
                id="accountName"
                value={accountName}
                onChange={(event) => setAccountName(event.target.value)}
                className="h-12 rounded-2xl"
                placeholder="Ex: Joao, Familia, Criancas"
              />
            </div>
          </div>
          <DialogFooter className="gap-3 sm:justify-between">
            <Button variant="outline" className="rounded-2xl" onClick={() => setAccountDialogOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button className="rounded-2xl bg-[#FF6400] hover:bg-[#E25A00]" onClick={handleSaveAccount} disabled={submitting || !accountName.trim()}>
              Salvar comanda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={productDialogOpen} onOpenChange={(open) => (open ? setProductDialogOpen(true) : resetProductDialog())}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden rounded-[28px] border-0 p-0">
          <div className="grid h-full gap-0 lg:grid-cols-[0.95fr,1.05fr]">
            <div className={`${showProductBrowsePane ? 'block' : 'hidden'} border-b border-slate-100 p-4 lg:block lg:border-b-0 lg:border-r lg:p-5`}>
              <DialogTitle className="text-xl font-semibold text-[#082F23]">
                {editingItem ? 'Editar item' : 'Adicionar produto'}
              </DialogTitle>

              {catalogLoadIssue ? (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
                  Cardapio offline no momento. Exibindo os ultimos produtos carregados.
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    className="h-10 rounded-2xl pl-10"
                    placeholder="Buscar produto"
                  />
                </div>

                <ScrollArea className="w-full whitespace-nowrap">
                  <div className="flex gap-1.5 pb-2">
                    <Button
                      type="button"
                      variant={selectedCategoryId === 'all' ? 'default' : 'outline'}
                      className={selectedCategoryId === 'all' ? 'h-8 rounded-full bg-[#082F23] px-3 text-xs hover:bg-[#0B4A36]' : 'h-8 rounded-full px-3 text-xs'}
                      onClick={() => setSelectedCategoryId('all')}
                    >
                      Todas
                    </Button>
                    {catalog.map((category) => (
                      <Button
                        key={category.id}
                        type="button"
                        variant={selectedCategoryId === category.id ? 'default' : 'outline'}
                        className={selectedCategoryId === category.id ? 'h-8 rounded-full bg-[#082F23] px-3 text-xs hover:bg-[#0B4A36]' : 'h-8 rounded-full px-3 text-xs'}
                        onClick={() => setSelectedCategoryId(category.id)}
                      >
                        {category.name}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>

                <ScrollArea className="h-[54vh] pr-2 lg:h-[62vh]">
                  <div className="space-y-4">
                    {filteredCategories.map((category) => (
                      <div key={category.id}>
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{category.name}</div>
                        <div className="space-y-2">
                          {category.products.map((product) => {
                            const imageUrl = normalizeImageUrlForDisplay(product.imageUrl);
                            const isSelected = selectedProductId === product.id;

                            return (
                              <div
                                key={product.id}
                                className={`flex items-center gap-2.5 rounded-[18px] border px-2.5 py-2 transition ${
                                  isSelected ? 'border-[#082F23] bg-[#EEF4E9]' : 'border-[#DCE6D8] bg-white'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => selectProductForDialog(product)}
                                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                                >
                                  <div className="h-10 w-10 flex-none overflow-hidden rounded-xl bg-[#EEF4E9]">
                                    {imageUrl ? (
                                      <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-[10px] font-medium text-[#0B4A36]">
                                        Sem foto
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-[13px] font-semibold text-[#082F23]">{product.name}</div>
                                    <div className="mt-0.5 text-[11px] font-medium text-slate-500">{formatMoney(product.price)}</div>
                                  </div>
                                </button>

                                <Button
                                  type="button"
                                  size="icon"
                                  className="h-8 w-8 rounded-full bg-[#FF6400] text-white hover:bg-[#E25A00]"
                                  onClick={() => selectProductForDialog(product)}
                                >
                                  <PlusCircle className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <div className={`${showProductConfigurePane ? 'block' : 'hidden'} bg-[#F4F8F2] p-4 lg:block lg:p-5`}>
              {selectedProduct ? (
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between gap-3 lg:hidden">
                    <Button variant="outline" className="h-9 rounded-2xl" onClick={() => setProductDialogStep('browse')}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Produtos
                    </Button>
                    <div className="text-xs font-medium text-slate-500">{activeAccount?.name || 'Comanda'}</div>
                  </div>

                  <div className="mt-3 rounded-[24px] bg-white p-4 shadow-sm lg:mt-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xl font-semibold text-[#082F23]">{selectedProduct.name}</div>
                        {selectedProduct.description ? (
                          <div className="mt-1 text-sm leading-5 text-slate-500">{selectedProduct.description}</div>
                        ) : null}
                      </div>
                      <div className="text-lg font-semibold text-[#082F23]">{formatMoney(selectedProduct.price)}</div>
                    </div>
                  </div>

                  <ScrollArea className="mt-3 h-[52vh] pr-2 lg:h-[58vh]">
                    <div className="space-y-3">
                      {selectedProduct.variations.map((group) => (
                        <div key={group.id} className="rounded-[20px] bg-white p-3 shadow-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[13px] font-semibold text-[#082F23]">{group.name}</div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                              {group.required ? 'Obrigatorio' : `Ate ${group.maxSelections}`}
                            </div>
                          </div>
                          <div className="mt-2 space-y-1.5">
                            {group.options.map((option) => {
                              const selected = (selectedOptions[group.id] || []).some((item) => item.id === option.id);
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() => toggleOption(group, option)}
                                  className={`flex w-full items-center justify-between rounded-[16px] border px-3 py-2 text-left transition ${
                                    selected ? 'border-[#082F23] bg-[#EEF4E9]' : 'border-[#DCE6D8] bg-white'
                                  }`}
                                >
                                  <div className="min-w-0 pr-3">
                                    <div className="truncate text-[13px] font-medium text-slate-700">{option.name}</div>
                                    <div className="mt-0.5 text-[11px] font-semibold text-slate-500">
                                      {option.price ? `+ ${formatMoney(option.price)}` : 'Incluso'}
                                    </div>
                                  </div>
                                  <span
                                    className={`flex h-7 w-7 flex-none items-center justify-center rounded-full border transition ${
                                      selected
                                        ? 'border-[#082F23] bg-[#082F23] text-white'
                                        : 'border-[#DCE6D8] bg-white text-[#0B4A36]'
                                    }`}
                                  >
                                    {selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {selectedProduct.variations.length === 0 ? (
                        <div className="rounded-[22px] bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">Sem complementos para este produto.</div>
                      ) : null}

                      <div className="rounded-[22px] bg-white p-3 shadow-sm">
                        <Label htmlFor="itemQuantity">Quantidade</Label>
                        <Input
                          id="itemQuantity"
                          inputMode="numeric"
                          value={quantity}
                          onChange={(event) => setQuantity(event.target.value.replace(/\D/g, '').slice(0, 2))}
                          className="mt-2 h-10 rounded-2xl"
                        />
                      </div>

                      <div className="rounded-[22px] bg-white p-3 shadow-sm">
                        <Label htmlFor="itemNotes">Observacoes</Label>
                        <Textarea
                          id="itemNotes"
                          value={itemNotes}
                          onChange={(event) => setItemNotes(event.target.value)}
                          className="mt-2 min-h-[96px] rounded-2xl"
                          placeholder="Ex: sem cebola, molho separado..."
                        />
                      </div>
                    </div>
                  </ScrollArea>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-11 rounded-2xl" onClick={() => resetProductDialog()} disabled={submitting}>
                      Cancelar
                    </Button>
                    <Button className="h-11 rounded-2xl bg-[#FF6400] hover:bg-[#E25A00]" onClick={handleAddOrUpdateItem} disabled={submitting}>
                      {editingItem ? 'Salvar' : 'Adicionar'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="hidden h-full lg:flex lg:items-center lg:justify-center">
                  <WaiterEmptyState
                    icon={<PackageOpen className="h-7 w-7" />}
                    title="Selecione um produto"
                    description="Toque em um item da lista para abrir complementos e observacoes."
                  />
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="rounded-[28px] border-0 sm:max-w-2xl">
          <DialogTitle className="text-2xl font-semibold text-[#082F23]">Recebimento da mesa</DialogTitle>
          <DialogDescription>
            Divida pagamentos por comanda e por forma de pagamento, incluindo parcelamento manual em linhas separadas.
          </DialogDescription>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-[#F4F8F2] p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Total</div>
                <div className="mt-2 text-xl font-semibold text-[#082F23]">{formatMoney(session.total)}</div>
              </div>
              <div className="rounded-2xl bg-[#F4F8F2] p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Recebido</div>
                <div className="mt-2 text-xl font-semibold text-[#082F23]">{formatMoney(session.paidTotal)}</div>
              </div>
              <div className="rounded-2xl bg-[#F4F8F2] p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Saldo</div>
                <div className="mt-2 text-xl font-semibold text-[#082F23]">{formatMoney(session.dueAmount)}</div>
              </div>
            </div>

            <div className="space-y-3">
              {paymentLines.map((line) => (
                <div key={line.id} className="grid gap-3 rounded-2xl border border-[#DCE6D8] bg-[#FBFCFA] p-4 sm:grid-cols-[1.15fr,0.85fr,0.7fr,auto]">
                  <div className="space-y-2">
                    <Label>Comanda</Label>
                    <Select value={line.accountId} onValueChange={(value) => handlePaymentLineChange(line.id, 'accountId', value)}>
                      <SelectTrigger className="h-12 rounded-2xl">
                        <SelectValue placeholder="Selecione a comanda" />
                      </SelectTrigger>
                      <SelectContent>
                        {session.accounts
                          .filter((account) => account.dueAmount > 0)
                          .map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name} - {formatMoney(account.dueAmount)}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Forma</Label>
                    <Select value={line.method} onValueChange={(value: PaymentMethod) => handlePaymentLineChange(line.id, 'method', value)}>
                      <SelectTrigger className="h-12 rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="cash">Dinheiro</SelectItem>
                        <SelectItem value="card">Cartao</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Valor</Label>
                    <Input
                      value={line.amount}
                      onChange={(event) => handlePaymentLineChange(line.id, 'amount', event.target.value)}
                      className="h-12 rounded-2xl"
                    />
                  </div>

                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      className="h-12 rounded-2xl"
                      onClick={() => setPaymentLines((current) => current.filter((entry) => entry.id !== line.id))}
                      disabled={paymentLines.length === 1}
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-start">
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => {
                  const nextAccount = session.accounts.find((account) => account.dueAmount > 0);
                  setPaymentLines((current) => [...current, createPaymentLine(nextAccount?.id || '', 0, 'pix')]);
                }}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Adicionar linha
              </Button>
            </div>
          </div>

          <DialogFooter className="gap-3 sm:justify-between">
            <Button variant="outline" className="rounded-2xl" onClick={() => setPaymentDialogOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button className="rounded-2xl bg-[#FF6400] hover:bg-[#E25A00]" onClick={handleSavePayments} disabled={submitting}>
              Confirmar pagamentos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(moveItemId)} onOpenChange={(open) => !open && setMoveItemId('')}>
        <DialogContent className="rounded-[28px] border-0 sm:max-w-lg">
          <DialogTitle className="text-2xl font-semibold text-[#082F23]">Mover item entre comandas</DialogTitle>
          <DialogDescription>
            Use este fluxo para redistribuir itens de uma comanda para outra dentro da mesma mesa.
          </DialogDescription>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Comanda de destino</Label>
              <Select value={moveTargetAccountId} onValueChange={setMoveTargetAccountId}>
                <SelectTrigger className="h-12 rounded-2xl">
                  <SelectValue placeholder="Selecione a comanda" />
                </SelectTrigger>
                <SelectContent>
                  {(session.accounts || [])
                    .filter((account) => account.id !== session.accounts.flatMap((account) => account.items).find((item) => item.id === moveItemId)?.accountId)
                    .map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantidade a mover</Label>
              <Input
                inputMode="numeric"
                value={moveQuantity}
                onChange={(event) => setMoveQuantity(event.target.value.replace(/\D/g, '').slice(0, 2))}
                className="h-12 rounded-2xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-3 sm:justify-between">
            <Button variant="outline" className="rounded-2xl" onClick={() => setMoveItemId('')} disabled={submitting}>
              Cancelar
            </Button>
            <Button className="rounded-2xl bg-[#082F23] hover:bg-[#0B4A36]" onClick={handleMoveItem} disabled={submitting || !moveTargetAccountId}>
              Confirmar movimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(mergeSourceAccountId)} onOpenChange={(open) => !open && setMergeSourceAccountId('')}>
        <DialogContent className="rounded-[28px] border-0 sm:max-w-lg">
          <DialogTitle className="text-2xl font-semibold text-[#082F23]">Juntar comandas</DialogTitle>
          <DialogDescription>
            Todos os itens e pagamentos da comanda escolhida vao para a comanda de destino.
          </DialogDescription>
          <div className="space-y-2">
            <Label>Comanda de destino</Label>
            <Select value={mergeTargetAccountId} onValueChange={setMergeTargetAccountId}>
              <SelectTrigger className="h-12 rounded-2xl">
                <SelectValue placeholder="Selecione a comanda" />
              </SelectTrigger>
              <SelectContent>
                {(session.accounts || [])
                  .filter((account) => account.id !== mergeSourceAccountId)
                  .map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-3 sm:justify-between">
            <Button variant="outline" className="rounded-2xl" onClick={() => setMergeSourceAccountId('')} disabled={submitting}>
              Cancelar
            </Button>
            <Button className="rounded-2xl bg-[#082F23] hover:bg-[#0B4A36]" onClick={handleMergeAccounts} disabled={submitting || !mergeTargetAccountId}>
              Confirmar juncao
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(transferAccountId)} onOpenChange={(open) => !open && setTransferAccountId('')}>
        <DialogContent className="rounded-[28px] border-0 sm:max-w-lg">
          <DialogTitle className="text-2xl font-semibold text-[#082F23]">Transferir comanda</DialogTitle>
          <DialogDescription>
            Mova uma comanda inteira para outra mesa, mantendo itens, historico e pagamentos.
          </DialogDescription>
          <div className="space-y-2">
            <Label>Mesa de destino</Label>
            <Select value={transferAccountTargetId} onValueChange={setTransferAccountTargetId}>
              <SelectTrigger className="h-12 rounded-2xl">
                <SelectValue placeholder="Selecione a mesa" />
              </SelectTrigger>
              <SelectContent>
                {accountTransferChoices.map((table) => (
                  <SelectItem key={table.id} value={table.id}>
                    Mesa {table.number} {table.location ? `- ${table.location}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-3 sm:justify-between">
            <Button variant="outline" className="rounded-2xl" onClick={() => setTransferAccountId('')} disabled={submitting}>
              Cancelar
            </Button>
            <Button className="rounded-2xl bg-[#082F23] hover:bg-[#0B4A36]" onClick={handleTransferAccount} disabled={submitting || !transferAccountTargetId}>
              Confirmar transferencia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transferTableOpen} onOpenChange={setTransferTableOpen}>
        <DialogContent className="rounded-[28px] border-0 sm:max-w-lg">
          <DialogTitle className="text-2xl font-semibold text-[#082F23]">Transferir mesa inteira</DialogTitle>
          <DialogDescription>
            Toda a sessao, com comandas e pedidos, sera movida para outra mesa livre.
          </DialogDescription>
          <div className="space-y-2">
            <Label>Mesa de destino</Label>
            <Select value={transferTableTargetId} onValueChange={setTransferTableTargetId}>
              <SelectTrigger className="h-12 rounded-2xl">
                <SelectValue placeholder="Selecione a mesa" />
              </SelectTrigger>
              <SelectContent>
                {transferTableChoices.map((table) => (
                  <SelectItem key={table.id} value={table.id}>
                    Mesa {table.number} {table.location ? `- ${table.location}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-3 sm:justify-between">
            <Button variant="outline" className="rounded-2xl" onClick={() => setTransferTableOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button className="rounded-2xl bg-[#082F23] hover:bg-[#0B4A36]" onClick={handleTransferTable} disabled={submitting || !transferTableTargetId}>
              Confirmar transferencia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WaiterSessionPage;
