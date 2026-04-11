import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  addWaiterItem,
  cancelWaiterDraftItem,
  createWaiterAccount,
  formatMoney,
  getSessionTotal,
  getWaiterSessionDetails,
  listWaiterCatalog,
  loadWaiterWebSession,
  logoutWaiterWeb,
  PaymentMethod,
  Product,
  ProductCategory,
  ProductOption,
  recordWaiterPayment,
  removeWaiterAccount,
  renameWaiterAccount,
  sendWaiterAccountItems,
  TableAccount,
  TableSession,
} from '@/services/waiterWebClient';
import {
  ArrowLeft,
  Check,
  ChefHat,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Loader2,
  Pencil,
  PlusCircle,
  Receipt,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  Users,
} from 'lucide-react';

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  pix: 'PIX',
  card: 'Cartão',
};

const WaiterSession = () => {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<TableSession | null>(null);
  const [catalog, setCatalog] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [newAccountOpen, setNewAccountOpen] = useState(false);
  const [renameAccountOpen, setRenameAccountOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<TableAccount | null>(null);
  const [renameAccount, setRenameAccount] = useState<TableAccount | null>(null);
  const [paymentAccountId, setPaymentAccountId] = useState<string>('all');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, ProductOption[]>>({});
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadSession = async (showSpinner = true) => {
    if (!sessionId) return;
    if (showSpinner) setLoading(true);
    try {
      const currentSession = await loadWaiterWebSession();
      if (!currentSession) {
        navigate('/waiter-login', { replace: true });
        return;
      }
      const response = await getWaiterSessionDetails(sessionId);
      setSession(response.session);
    } catch (error: any) {
      if (String(error?.message || '').toLowerCase().includes('sessão')) {
        await logoutWaiterWeb();
        navigate('/waiter-login', { replace: true });
        return;
      }
      toast({
        title: 'Erro ao carregar mesa',
        description: error?.message || 'Não foi possível carregar a sessão da mesa.',
        variant: 'destructive',
      });
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const loadCatalog = async () => {
    try {
      const response = await listWaiterCatalog();
      setCatalog(response.categories || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar cardápio',
        description: error?.message || 'Não foi possível listar os produtos do salão.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    loadSession();
    loadCatalog();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const interval = window.setInterval(() => {
      loadSession(false);
    }, 8000);
    return () => {
      window.clearInterval(interval);
    };
  }, [sessionId]);

  const filteredCategories = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return catalog
      .map((category) => ({
        ...category,
        products: category.products.filter((product) => {
          const matchSearch =
            !normalizedSearch ||
            product.name.toLowerCase().includes(normalizedSearch) ||
            String(product.description || '').toLowerCase().includes(normalizedSearch);
          const matchCategory = selectedCategoryId === 'all' || category.id === selectedCategoryId;
          return matchSearch && matchCategory;
        }),
      }))
      .filter((category) => category.products.length > 0);
  }, [catalog, search, selectedCategoryId]);

  const sessionTotal = useMemo(() => getSessionTotal(session?.accounts || []), [session]);
  const pendingAccounts = useMemo(() => (session?.accounts || []).filter((account) => account.status === 'open'), [session]);
  const draftCount = useMemo(
    () => (session?.accounts || []).reduce((sum, account) => sum + account.items.filter((item) => item.status === 'draft').length, 0),
    [session],
  );

  const openCatalogForAccount = (account: TableAccount) => {
    setSelectedAccount(account);
    setSelectedProduct(null);
    setSelectedOptions({});
    setQuantity('1');
    setNotes('');
    setSearch('');
    setSelectedCategoryId('all');
    setCatalogOpen(true);
  };

  const toggleOption = (groupId: string, option: ProductOption, maxSelections: number) => {
    setSelectedOptions((current) => {
      const existing = current[groupId] || [];
      const alreadySelected = existing.some((item) => item.id === option.id);
      if (alreadySelected) {
        return {
          ...current,
          [groupId]: existing.filter((item) => item.id !== option.id),
        };
      }
      const limited = maxSelections <= 1 ? [option] : [...existing.slice(0, maxSelections - 1), option];
      return {
        ...current,
        [groupId]: limited,
      };
    });
  };

  const handleAddItem = async () => {
    if (!selectedAccount || !selectedProduct || !session) return;

    const missingRequired = selectedProduct.variations.some(
      (group) => group.required && !(selectedOptions[group.id] || []).length,
    );

    if (missingRequired) {
      toast({
        title: 'Complementos obrigatórios',
        description: 'Selecione os complementos obrigatórios antes de adicionar o item.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      await addWaiterItem({
        sessionId: session.id,
        accountId: selectedAccount.id,
        productId: selectedProduct.id,
        quantity: Math.max(1, Number(quantity || 1)),
        notes,
        selectedOptions: Object.values(selectedOptions).flat(),
      });
      await loadSession(false);
      toast({
        title: 'Item adicionado',
        description: `${selectedProduct.name} entrou como rascunho na ${selectedAccount.name}.`,
      });
      setSelectedProduct(null);
      setSelectedOptions({});
      setQuantity('1');
      setNotes('');
    } catch (error: any) {
      toast({
        title: 'Erro ao adicionar item',
        description: error?.message || 'Não foi possível lançar o item.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendAccount = async (account: TableAccount) => {
    setSubmitting(true);
    try {
      await sendWaiterAccountItems(sessionId, account.id);
      await loadSession(false);
      toast({
        title: 'Pedido enviado',
        description: `Os itens pendentes da ${account.name} já foram para produção.`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar pedido',
        description: error?.message || 'Não foi possível enviar os itens da conta.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelDraft = async (itemId: string, accountId: string) => {
    setSubmitting(true);
    try {
      await cancelWaiterDraftItem(itemId, accountId, sessionId);
      await loadSession(false);
    } catch (error: any) {
      toast({
        title: 'Erro ao cancelar item',
        description: error?.message || 'Não foi possível cancelar o rascunho.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openPaymentDialog = (account?: TableAccount) => {
    if (!session) return;
    setPaymentAccountId(account?.id || 'all');
    setPaymentAmount(String(account ? account.total : sessionTotal).toFixed(2));
    setPaymentMethod('pix');
    setPaymentOpen(true);
  };

  const handlePayment = async () => {
    if (!session) return;
    setSubmitting(true);
    try {
      await recordWaiterPayment(
        session.id,
        paymentAccountId === 'all' ? null : paymentAccountId,
        Number(paymentAmount || 0),
        paymentMethod,
      );
      await loadSession(false);
      setPaymentOpen(false);
      toast({
        title: 'Pagamento registrado',
        description: 'A conta foi atualizada com sucesso.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro no pagamento',
        description: error?.message || 'Não foi possível registrar o pagamento.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!session || !newAccountName.trim()) return;
    setSubmitting(true);
    try {
      await createWaiterAccount(session.id, newAccountName.trim());
      await loadSession(false);
      setNewAccountName('');
      setNewAccountOpen(false);
    } catch (error: any) {
      toast({
        title: 'Erro ao criar conta',
        description: error?.message || 'Não foi possível criar a nova conta.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRenameAccount = async () => {
    if (!renameAccount || !renameValue.trim()) return;
    setSubmitting(true);
    try {
      await renameWaiterAccount(renameAccount.id, renameValue.trim());
      await loadSession(false);
      setRenameAccountOpen(false);
      setRenameAccount(null);
      setRenameValue('');
    } catch (error: any) {
      toast({
        title: 'Erro ao renomear conta',
        description: error?.message || 'Não foi possível atualizar o nome da conta.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveAccount = async (account: TableAccount) => {
    setSubmitting(true);
    try {
      await removeWaiterAccount(account.id);
      await loadSession(false);
    } catch (error: any) {
      toast({
        title: 'Erro ao remover conta',
        description: error?.message || 'Não foi possível remover a conta.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,#fff4ea_0%,#fff_40%,#f8fafc_100%)]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#FF6400]/20 border-t-[#FF6400]" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff4ea_0%,#fff_40%,#f8fafc_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[32px] bg-[#003223] p-6 text-white shadow-[0_35px_80px_-45px_rgba(0,50,35,0.65)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Button
                variant="outline"
                className="mb-4 rounded-2xl border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                onClick={() => navigate('/waiter-dashboard')}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para mesas
              </Button>
              <h1 className="text-3xl font-black">Mesa {session.tableNumber}</h1>
              <p className="mt-1 text-sm text-white/70">
                {session.guestCount} pessoas • {pendingAccounts.length} contas abertas • {draftCount} itens pendentes
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="rounded-2xl border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                onClick={async () => {
                  setRefreshing(true);
                  await loadSession(false);
                  setRefreshing(false);
                }}
              >
                {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Atualizar
              </Button>
              <Button className="rounded-2xl bg-[#FF6400] hover:bg-[#e55a00]" onClick={() => openPaymentDialog()}>
                <CircleDollarSign className="mr-2 h-4 w-4" />
                Receber mesa
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <Card className="rounded-3xl border-0 bg-white/10 text-white">
              <CardContent className="p-5">
                <div className="text-sm text-white/70">Total da mesa</div>
                <div className="mt-2 text-3xl font-black">{formatMoney(sessionTotal)}</div>
              </CardContent>
            </Card>
            <Card className="rounded-3xl border-0 bg-white/10 text-white">
              <CardContent className="p-5">
                <div className="text-sm text-white/70">Abertas</div>
                <div className="mt-2 text-3xl font-black">{pendingAccounts.length}</div>
              </CardContent>
            </Card>
            <Card className="rounded-3xl border-0 bg-white/10 text-white">
              <CardContent className="p-5">
                <div className="text-sm text-white/70">Itens pendentes</div>
                <div className="mt-2 text-3xl font-black">{draftCount}</div>
              </CardContent>
            </Card>
            <Card className="rounded-3xl border-0 bg-white/10 text-white">
              <CardContent className="p-5">
                <div className="text-sm text-white/70">Tempo aberto</div>
                <div className="mt-2 text-3xl font-black flex items-center gap-2">
                  <Clock3 className="h-5 w-5 text-[#8CC850]" />
                  {Math.max(0, Math.floor((Date.now() - new Date(session.openedAt).getTime()) / 60000))} min
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr,0.7fr]">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Contas da mesa</h2>
                <p className="text-sm text-slate-500">Lance itens, envie para produção e receba por conta.</p>
              </div>
              <Button className="rounded-2xl bg-[#003223] hover:bg-[#0b4733]" onClick={() => setNewAccountOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Nova conta
              </Button>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {session.accounts.map((account) => {
                const draftItems = account.items.filter((item) => item.status === 'draft');
                return (
                  <Card key={account.id} className="rounded-[28px] border-2 border-slate-200 bg-white shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-xl text-slate-900">{account.name}</CardTitle>
                          <p className="mt-1 text-sm text-slate-500">{account.itemCount} itens • {formatMoney(account.total)}</p>
                        </div>
                        <Badge className={account.status === 'paid' ? 'bg-[#EEF7E4] text-[#4E8A1F]' : 'bg-[#FFF1E8] text-[#C14E00]'}>
                          {account.status === 'paid' ? 'Paga' : 'Aberta'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="rounded-xl bg-[#FF6400] hover:bg-[#e55a00]"
                          onClick={() => openCatalogForAccount(account)}
                          disabled={account.status === 'paid'}
                        >
                          <ShoppingBag className="mr-2 h-4 w-4" />
                          Adicionar item
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => {
                            setRenameAccount(account);
                            setRenameValue(account.name);
                            setRenameAccountOpen(true);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Renomear
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => handleRemoveAccount(account)}
                          disabled={account.itemCount > 0}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remover
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {account.items.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                            Nenhum item lançado nesta conta.
                          </div>
                        ) : (
                          account.items.map((item) => (
                            <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-slate-900">{item.quantity}x {item.productName}</div>
                                  <div className="mt-1 text-sm text-slate-500">
                                    {item.options.map((option) => option.optionName).join(', ') || 'Sem complementos'}
                                  </div>
                                  {item.notes ? <div className="mt-1 text-sm text-slate-400">Obs: {item.notes}</div> : null}
                                </div>
                                <div className="text-right">
                                  <div className="font-semibold text-slate-900">{formatMoney(item.totalPrice)}</div>
                                  <Badge variant="outline" className="mt-2">
                                    {item.status === 'draft' ? 'Rascunho' : 'Enviado'}
                                  </Badge>
                                </div>
                              </div>
                              {item.status === 'draft' ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="mt-3 h-8 rounded-xl px-0 text-[#FF6400] hover:bg-transparent hover:text-[#e55a00]"
                                  onClick={() => handleCancelDraft(item.id, account.id)}
                                >
                                  Cancelar rascunho
                                </Button>
                              ) : null}
                            </div>
                          ))
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          className="flex-1 rounded-2xl bg-[#003223] hover:bg-[#0b4733]"
                          onClick={() => handleSendAccount(account)}
                          disabled={!draftItems.length || account.status === 'paid' || submitting}
                        >
                          <ChefHat className="mr-2 h-4 w-4" />
                          Enviar pedido
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 rounded-2xl"
                          onClick={() => openPaymentDialog(account)}
                          disabled={account.status === 'paid'}
                        >
                          <CreditCard className="mr-2 h-4 w-4" />
                          Receber
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <Card className="rounded-[28px] border-2 border-slate-200 bg-white">
              <CardHeader>
                <CardTitle className="text-xl text-slate-900">Histórico da sessão</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[520px] pr-4">
                  <div className="space-y-3">
                    {session.history.length === 0 ? (
                      <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                        Nenhuma movimentação registrada ainda.
                      </div>
                    ) : (
                      session.history.map((entry) => (
                        <div key={entry.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-slate-900">{entry.label}</div>
                              <div className="mt-1 text-sm text-slate-500">
                                {new Date(entry.timestamp).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </div>
                            {entry.amount ? <div className="font-semibold text-slate-900">{formatMoney(entry.amount)}</div> : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl rounded-[28px] border-0 p-0">
          <div className="grid h-full gap-0 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="border-b border-slate-100 p-6 lg:border-b-0 lg:border-r">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black text-slate-900">
                  Adicionar item {selectedAccount ? `• ${selectedAccount.name}` : ''}
                </DialogTitle>
                <DialogDescription>
                  Escolha um produto, configure os complementos e lance como rascunho.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-5 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar produto"
                    className="h-11 rounded-2xl pl-10"
                  />
                </div>

                <ScrollArea className="w-full whitespace-nowrap">
                  <div className="flex gap-2 pb-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={selectedCategoryId === 'all' ? 'default' : 'outline'}
                      className="rounded-full"
                      onClick={() => setSelectedCategoryId('all')}
                    >
                      Todas
                    </Button>
                    {catalog.map((category) => (
                      <Button
                        key={category.id}
                        type="button"
                        size="sm"
                        variant={selectedCategoryId === category.id ? 'default' : 'outline'}
                        className="rounded-full"
                        onClick={() => setSelectedCategoryId(category.id)}
                      >
                        {category.name}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>

                <ScrollArea className="h-[430px] pr-3">
                  <div className="space-y-5">
                    {filteredCategories.map((category) => (
                      <div key={category.id}>
                        <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">{category.name}</div>
                        <div className="grid gap-3">
                          {category.products.map((product) => (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => {
                                setSelectedProduct(product);
                                setSelectedOptions({});
                                setQuantity('1');
                                setNotes('');
                              }}
                              className={`rounded-2xl border p-4 text-left transition ${selectedProduct?.id === product.id ? 'border-[#FF6400] bg-[#FFF7F2]' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-slate-900">{product.name}</div>
                                  <div className="mt-1 text-sm text-slate-500">{product.description || 'Sem descrição'}</div>
                                </div>
                                <div className="font-bold text-slate-900">{formatMoney(product.price)}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <div className="bg-slate-50 p-6">
              {selectedProduct ? (
                <div className="flex h-full flex-col">
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <div className="text-xl font-black text-slate-900">{selectedProduct.name}</div>
                    <div className="mt-1 text-sm text-slate-500">{selectedProduct.description || 'Produto pronto para lançamento.'}</div>
                    <div className="mt-4 text-3xl font-black text-[#003223]">{formatMoney(selectedProduct.price)}</div>
                  </div>

                  <ScrollArea className="mt-4 h-[350px] pr-3">
                    <div className="space-y-4">
                      {selectedProduct.variations.map((group) => (
                        <div key={group.id} className="rounded-3xl bg-white p-4 shadow-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold text-slate-900">{group.name}</div>
                            <Badge variant="outline">
                              {group.required ? 'Obrigatório' : `Até ${group.maxSelections}`}
                            </Badge>
                          </div>
                          <div className="mt-3 space-y-2">
                            {group.options.map((option) => {
                              const selected = (selectedOptions[group.id] || []).some((item) => item.id === option.id);
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() => toggleOption(group.id, option, group.maxSelections)}
                                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${selected ? 'border-[#FF6400] bg-[#FFF7F2]' : 'border-slate-200 bg-white'}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? 'border-[#FF6400] bg-[#FF6400] text-white' : 'border-slate-300 text-transparent'}`}>
                                      <Check className="h-3 w-3" />
                                    </div>
                                    <span className="font-medium text-slate-700">{option.name}</span>
                                  </div>
                                  <span className="text-sm font-semibold text-slate-500">{option.price ? `+ ${formatMoney(option.price)}` : 'Incluso'}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      <div className="rounded-3xl bg-white p-4 shadow-sm">
                        <Label htmlFor="quantity">Quantidade</Label>
                        <Input
                          id="quantity"
                          inputMode="numeric"
                          value={quantity}
                          onChange={(event) => setQuantity(event.target.value.replace(/\D/g, '').slice(0, 2))}
                          className="mt-2 h-11 rounded-2xl"
                        />
                      </div>

                      <div className="rounded-3xl bg-white p-4 shadow-sm">
                        <Label htmlFor="notes">Observações</Label>
                        <Textarea
                          id="notes"
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                          className="mt-2 min-h-[110px] rounded-2xl"
                          placeholder="Ex: sem cebola, ponto da carne..."
                        />
                      </div>
                    </div>
                  </ScrollArea>

                  <div className="mt-4">
                    <Button
                      className="h-12 w-full rounded-2xl bg-[#FF6400] text-base font-bold hover:bg-[#e55a00]"
                      onClick={handleAddItem}
                      disabled={submitting}
                    >
                      {submitting ? 'Adicionando...' : 'Adicionar à conta'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
                  Selecione um produto para configurar complementos e lançar na conta.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="rounded-[28px] border-0 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-900">Receber mesa</DialogTitle>
            <DialogDescription>Escolha se o pagamento será de uma conta específica ou da mesa inteira.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Conta</Label>
              <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                <SelectTrigger className="h-12 rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Mesa inteira</SelectItem>
                  {session.accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} • {formatMoney(account.total)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Método</Label>
              <Select value={paymentMethod} onValueChange={(value: PaymentMethod) => setPaymentMethod(value)}>
                <SelectTrigger className="h-12 rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value.replace(',', '.'))}
                className="h-12 rounded-2xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-3 sm:justify-between">
            <Button variant="outline" className="rounded-2xl" onClick={() => setPaymentOpen(false)}>
              Cancelar
            </Button>
            <Button className="rounded-2xl bg-[#003223] hover:bg-[#0b4733]" onClick={handlePayment} disabled={submitting}>
              <Receipt className="mr-2 h-4 w-4" />
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newAccountOpen} onOpenChange={setNewAccountOpen}>
        <DialogContent className="rounded-[28px] border-0 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova conta</DialogTitle>
            <DialogDescription>Crie uma comanda extra dentro da mesa atual.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="accountName">Nome da conta</Label>
            <Input
              id="accountName"
              value={newAccountName}
              onChange={(event) => setNewAccountName(event.target.value)}
              className="h-12 rounded-2xl"
              placeholder="Ex: Conta do casal"
            />
          </div>
          <DialogFooter className="gap-3 sm:justify-between">
            <Button variant="outline" className="rounded-2xl" onClick={() => setNewAccountOpen(false)}>
              Cancelar
            </Button>
            <Button className="rounded-2xl bg-[#FF6400] hover:bg-[#e55a00]" onClick={handleCreateAccount} disabled={submitting}>
              Criar conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameAccountOpen} onOpenChange={setRenameAccountOpen}>
        <DialogContent className="rounded-[28px] border-0 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renomear conta</DialogTitle>
            <DialogDescription>Ajuste o nome da comanda para facilitar a operação no salão.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="renameValue">Nome da conta</Label>
            <Input
              id="renameValue"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              className="h-12 rounded-2xl"
            />
          </div>
          <DialogFooter className="gap-3 sm:justify-between">
            <Button variant="outline" className="rounded-2xl" onClick={() => setRenameAccountOpen(false)}>
              Cancelar
            </Button>
            <Button className="rounded-2xl bg-[#003223] hover:bg-[#0b4733]" onClick={handleRenameAccount} disabled={submitting}>
              Salvar nome
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WaiterSession;
