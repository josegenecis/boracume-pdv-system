import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Copy, Loader2, Plus, QrCode, ShieldCheck, Trash2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ChecklistTask {
  id: string;
  title: string;
  area: string;
  shift: string;
  sort_order: number;
  required: boolean;
}

interface ChecklistRun {
  id: string;
  status: string;
  checked_task_ids: string[];
  notes?: string | null;
  completed_by?: string | null;
  completed_at?: string | null;
}

interface OperationalChecklistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
  locked?: boolean;
}

const defaultTasks = [
  'Conferir caixa, troco e operador do turno',
  'Conferir impressora, papel e som de pedidos',
  'Higienizar balcão, mesas e área de atendimento',
  'Conferir cozinha, pré-preparo e embalagens',
  'Conferir estoque crítico e produtos indisponíveis',
  'Conferir WhatsApp, cardápio online e formas de pagamento',
];

const todayKey = () => new Date().toISOString().slice(0, 10);

export const OperationalChecklistDialog: React.FC<OperationalChecklistDialogProps> = ({ open, onOpenChange, onUpdated, locked = false }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [tasks, setTasks] = useState<ChecklistTask[]>([]);
  const [run, setRun] = useState<ChecklistRun | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [publicToken, setPublicToken] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const progress = useMemo(() => {
    if (tasks.length === 0) return 0;
    return Math.round((checkedIds.size / tasks.length) * 100);
  }, [checkedIds.size, tasks.length]);

  const pendingRequired = tasks.filter((task) => task.required && !checkedIds.has(task.id));

  const seedDefaultTasks = async () => {
    if (!user?.id) return [];
    const rows = defaultTasks.map((title, index) => ({
      user_id: user.id,
      title,
      area: index <= 1 ? 'caixa' : index <= 3 ? 'operacao' : 'gestao',
      shift: 'abertura',
      sort_order: index + 1,
      required: true,
      active: true,
    }));
    const { data, error } = await (supabase as any)
      .from('restaurant_checklist_tasks')
      .insert(rows)
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data || [];
  };

  const createPublicToken = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID().replace(/-/g, '');
    }
    return `${Date.now()}${Math.random().toString(36).slice(2)}`.replace(/[^a-zA-Z0-9]/g, '');
  };

  const checklistUrl = useMemo(() => {
    if (!publicToken || typeof window === 'undefined') return '';
    return `${window.location.origin}/checklist/${publicToken}`;
  }, [publicToken]);

  const loadChecklist = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [{ data: settings }, tasksResult, { data: currentRun }] = await Promise.all([
        (supabase as any)
          .from('restaurant_checklist_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
        (supabase as any)
          .from('restaurant_checklist_tasks')
          .select('*')
          .eq('user_id', user.id)
          .eq('active', true)
          .order('sort_order', { ascending: true }),
        (supabase as any)
          .from('restaurant_checklist_runs')
          .select('*')
          .eq('user_id', user.id)
          .eq('business_date', todayKey())
          .maybeSingle(),
      ]);

      let loadedSettings = settings;
      if (!loadedSettings) {
        const { data: insertedSettings, error: insertSettingsError } = await (supabase as any)
          .from('restaurant_checklist_settings')
          .insert({ user_id: user.id, enabled: false, public_token: createPublicToken() })
          .select('*')
          .single();
        if (insertSettingsError) throw insertSettingsError;
        loadedSettings = insertedSettings;
      } else if (!loadedSettings.public_token) {
        const token = createPublicToken();
        const { data: updatedSettings, error: updateSettingsError } = await (supabase as any)
          .from('restaurant_checklist_settings')
          .update({ public_token: token, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .select('*')
          .single();
        if (updateSettingsError) throw updateSettingsError;
        loadedSettings = updatedSettings;
      }

      let loadedTasks = tasksResult.data || [];
      if (loadedTasks.length === 0) {
        loadedTasks = await seedDefaultTasks();
      }

      const ids = Array.isArray(currentRun?.checked_task_ids) ? currentRun.checked_task_ids : [];
      setEnabled(Boolean(loadedSettings?.enabled));
      setPublicToken(String(loadedSettings?.public_token || ''));
      setTasks(loadedTasks);
      setRun(currentRun || null);
      setCheckedIds(new Set(ids));
      setNotes(String(currentRun?.notes || ''));
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar checklist',
        description: error?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void loadChecklist();
  }, [open, user?.id]);

  const handleToggleEnabled = async (next: boolean) => {
    if (!user?.id) return;
    setEnabled(next);
    const { error } = await (supabase as any)
      .from('restaurant_checklist_settings')
      .upsert({ user_id: user.id, enabled: next, require_daily: true, public_token: publicToken || createPublicToken(), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) {
      setEnabled(!next);
      toast({
        title: 'Não foi possível atualizar a regra',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    onUpdated?.();
  };

  const toggleTask = (taskId: string) => {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const addTask = async () => {
    if (!user?.id) return;
    const title = newTaskTitle.trim();
    if (!title) {
      toast({
        title: 'Digite o item do checklist',
        description: 'Ex.: Conferir estoque de bebidas.',
        variant: 'destructive',
      });
      return;
    }

    const { data, error } = await (supabase as any)
      .from('restaurant_checklist_tasks')
      .insert({
        user_id: user.id,
        title,
        area: 'operacao',
        shift: 'abertura',
        sort_order: tasks.length + 1,
        required: true,
        active: true,
      })
      .select('*')
      .single();

    if (error) {
      toast({ title: 'Erro ao criar item', description: error.message, variant: 'destructive' });
      return;
    }

    setTasks((current) => [...current, data]);
    setNewTaskTitle('');
    toast({ title: 'Item adicionado', description: 'O funcionário verá esse item pelo QR Code.' });
    onUpdated?.();
  };

  const updateTask = async (taskId: string, patch: Partial<Pick<ChecklistTask, 'title' | 'required'>>) => {
    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, ...patch } : task)));
    const { error } = await (supabase as any)
      .from('restaurant_checklist_tasks')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .eq('user_id', user?.id);
    if (error) {
      toast({ title: 'Erro ao atualizar item', description: error.message, variant: 'destructive' });
      void loadChecklist();
    }
  };

  const removeTask = async (taskId: string) => {
    const previous = tasks;
    setTasks((current) => current.filter((task) => task.id !== taskId));
    setCheckedIds((current) => {
      const next = new Set(current);
      next.delete(taskId);
      return next;
    });

    const { error } = await (supabase as any)
      .from('restaurant_checklist_tasks')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .eq('user_id', user?.id);
    if (error) {
      setTasks(previous);
      toast({ title: 'Erro ao remover item', description: error.message, variant: 'destructive' });
    }
  };

  const copyChecklistUrl = async () => {
    if (!checklistUrl) return;
    await navigator.clipboard.writeText(checklistUrl);
    toast({ title: 'Link copiado', description: 'Envie para o funcionário ou imprima o QR Code.' });
  };

  const saveChecklist = async () => {
    if (!user?.id) return;
    if (enabled && pendingRequired.length > 0) {
      toast({
        title: 'Checklist incompleto',
        description: 'Conclua todos os itens obrigatórios antes de liberar o turno.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const checked_task_ids = Array.from(checkedIds);
      const payload = {
        user_id: user.id,
        business_date: todayKey(),
        checked_task_ids,
        notes: notes.trim() || null,
        status: pendingRequired.length === 0 ? 'completed' : 'pending',
        completed_by: user.email || 'Operador',
        completed_at: pendingRequired.length === 0 ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await (supabase as any)
        .from('restaurant_checklist_runs')
        .upsert(payload, { onConflict: 'user_id,business_date' })
        .select('*')
        .single();
      if (error) throw error;

      setRun(data);
      toast({
        title: 'Checklist salvo',
        description: payload.status === 'completed' ? 'Turno conferido e registrado.' : 'Progresso salvo.',
      });
      onUpdated?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar checklist',
        description: error?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (locked && !nextOpen) return;
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent hideClose={locked} className="max-h-[92vh] overflow-y-auto rounded-[28px] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl text-[#003223]">
            <ClipboardCheck className="h-6 w-6 text-[#FF6400]" />
            Checklist operacional
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Carregando checklist...
          </div>
        ) : (
          <div className="space-y-5">
            {locked && (
              <div className="rounded-2xl border border-[#FF6400]/25 bg-[#FFF4EC] p-4 text-sm text-[#7a3200]">
                <div className="font-bold text-[#003223]">Checklist obrigatório para liberar a operação</div>
                <p className="mt-1">
                  Confira os itens do turno antes de continuar usando o sistema. Isso ajuda a evitar falta de papel,
                  caixa sem troco, pedidos sem som e produtos indisponíveis no atendimento.
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-[#8CC850]/25 bg-[#F5FBED] p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-[#003223]">
                    <ShieldCheck className="h-4 w-4" />
                    Checklist obrigatório do turno
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Quando ligado, o funcionário deve registrar a conferência diária antes de considerar o turno liberado.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-700">{enabled ? 'Ativo' : 'Inativo'}</span>
                  <Switch checked={enabled} onCheckedChange={handleToggleEnabled} />
                </div>
              </div>
            </div>

            {!locked && (
              <div className="rounded-2xl border border-[#FF6400]/20 bg-[#FFF9F4] p-4">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-[#003223]">
                      <QrCode className="h-4 w-4 text-[#FF6400]" />
                      QR Code para funcionário
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      Fixe esse QR no caixa, cozinha ou área da equipe. O funcionário escaneia e faz o checklist pelo celular.
                    </p>
                    {checklistUrl && (
                      <div className="mt-3 break-all rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                        {checklistUrl}
                      </div>
                    )}
                  </div>
                  {checklistUrl && (
                    <div className="flex shrink-0 flex-col items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
                      <QRCodeSVG value={checklistUrl} size={132} />
                      <Button type="button" variant="outline" size="sm" onClick={copyChecklistUrl} className="gap-2 rounded-xl">
                        <Copy className="h-4 w-4" />
                        Copiar link
                      </Button>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <Label htmlFor="new-checklist-task">Criar item personalizado</Label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="new-checklist-task"
                      value={newTaskTitle}
                      onChange={(event) => setNewTaskTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void addTask();
                        }
                      }}
                      placeholder="Ex.: Conferir estoque de bebidas"
                      className="rounded-xl"
                    />
                    <Button type="button" onClick={addTask} className="gap-2 rounded-xl bg-[#003223] hover:bg-[#064632]">
                      <Plus className="h-4 w-4" />
                      Adicionar
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-900">Progresso de hoje</div>
                  <div className="text-xs text-slate-500">
                    {run?.status === 'completed' ? `Concluído por ${run.completed_by || 'operador'}` : `${checkedIds.size}/${tasks.length} itens marcados`}
                  </div>
                </div>
                <div className="text-2xl font-black text-[#003223]">{progress}%</div>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
                    checkedIds.has(task.id)
                      ? 'border-[#8CC850]/40 bg-[#F5FBED]'
                      : 'border-slate-200 bg-white hover:border-[#FF6400]/30'
                  }`}
                >
                  <Checkbox
                    checked={checkedIds.has(task.id)}
                    onClick={(event) => event.stopPropagation()}
                    onCheckedChange={() => toggleTask(task.id)}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    {locked ? (
                      <>
                        <div className="font-semibold text-slate-900">{task.title}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                          {task.area} • {task.shift} {task.required ? '• obrigatório' : ''}
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2" onClick={(event) => event.stopPropagation()}>
                        <Input
                          value={task.title}
                          onChange={(event) => updateTask(task.id, { title: event.target.value })}
                          className="h-10 rounded-xl font-semibold text-slate-900"
                        />
                        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
                          <label className="flex items-center gap-2">
                            <Checkbox
                              checked={task.required}
                              onCheckedChange={(checked) => updateTask(task.id, { required: checked === true })}
                            />
                            Obrigatório
                          </label>
                          <span>{task.area} • {task.shift}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {checkedIds.has(task.id) && <CheckCircle2 className="h-5 w-5 text-[#8CC850]" />}
                  {!locked && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={(event) => {
                        event.stopPropagation();
                        void removeTask(task.id);
                      }}
                      className="h-9 w-9 shrink-0 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="checklist-notes">Observações do turno</Label>
              <Textarea
                id="checklist-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Ex.: faltou embalagem P, impressora conferida, estoque de refrigerante baixo..."
                className="min-h-24 rounded-2xl"
              />
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              {!locked && (
                <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-2xl">
                  Fechar
                </Button>
              )}
              <Button onClick={saveChecklist} disabled={saving} className="rounded-2xl bg-[#FF6400] hover:bg-[#e65a00]">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar checklist
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OperationalChecklistDialog;
