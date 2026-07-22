import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import CompactLoader from '@/components/ui/compact-loader';

interface PublicChecklistTask {
  id: string;
  title: string;
  area: string;
  shift: string;
  sort_order: number;
  required: boolean;
}

interface PublicChecklistData {
  restaurant_name: string;
  title: string;
  enabled: boolean;
  business_date: string;
  tasks: PublicChecklistTask[];
  run?: {
    status?: string;
    checked_task_ids?: string[];
    notes?: string | null;
    completed_by?: string | null;
    completed_at?: string | null;
  } | null;
}

const formatDate = (date?: string) => {
  if (!date) return '';
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
};

export const ChecklistPublic: React.FC = () => {
  const { token } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<PublicChecklistData | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [completedBy, setCompletedBy] = useState('');
  const [notes, setNotes] = useState('');

  const tasks = data?.tasks || [];
  const progress = useMemo(() => {
    if (tasks.length === 0) return 0;
    return Math.round((checkedIds.size / tasks.length) * 100);
  }, [checkedIds.size, tasks.length]);
  const pendingRequired = tasks.filter((task) => task.required && !checkedIds.has(task.id));
  const completed = data?.run?.status === 'completed';

  const loadChecklist = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data: result, error } = await Promise.race([
        (supabase as any).rpc('get_checklist_by_token', { p_token: token }),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Tempo limite ao carregar o checklist.')), 8000)),
      ]);
      if (error) throw error;
      const payload = result as PublicChecklistData;
      setData(payload);
      const ids = Array.isArray(payload?.run?.checked_task_ids) ? payload.run.checked_task_ids : [];
      setCheckedIds(new Set(ids));
      setCompletedBy(String(payload?.run?.completed_by || ''));
      setNotes(String(payload?.run?.notes || ''));
    } catch (error: any) {
      toast({
        title: 'Checklist não encontrado',
        description: error?.message || 'Confira se o QR Code está correto.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadChecklist();
  }, [token]);

  const toggleTask = (taskId: string) => {
    if (completed) return;
    setCheckedIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const submitChecklist = async () => {
    if (!token || !data) return;
    if (!completedBy.trim()) {
      toast({
        title: 'Informe o nome do funcionário',
        description: 'Esse nome fica salvo como responsável pela conferência.',
        variant: 'destructive',
      });
      return;
    }
    if (pendingRequired.length > 0) {
      toast({
        title: 'Ainda tem item obrigatório pendente',
        description: 'Marque todos os itens obrigatórios antes de finalizar.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await (supabase as any).rpc('submit_checklist_by_token', {
        p_token: token,
        p_checked_task_ids: Array.from(checkedIds),
        p_notes: notes,
        p_completed_by: completedBy.trim(),
      });
      if (error) throw error;
      toast({
        title: 'Checklist concluído',
        description: 'Turno conferido e registrado com sucesso.',
      });
      await loadChecklist();
    } catch (error: any) {
      toast({
        title: 'Não foi possível finalizar',
        description: error?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FBF5] px-4 py-5 text-[#003223]">
      <div className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-md flex-col">
        <div className="rounded-[28px] bg-[#003223] p-5 text-white shadow-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF6400]">
              <ClipboardCheck className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-lg font-black">{data?.restaurant_name || 'PopSystem'}</div>
              <div className="text-sm text-white/70">{formatDate(data?.business_date)}</div>
            </div>
          </div>
          <div className="mt-6">
            <div className="text-3xl font-black leading-tight">{data?.title || 'Checklist operacional'}</div>
            <p className="mt-2 text-sm text-white/75">
              Confira os itens do turno antes de liberar a operação.
            </p>
          </div>
        </div>

        <div className="mt-4 flex-1 rounded-[28px] border border-[#8CC850]/20 bg-white p-4 shadow-sm">
          {loading ? (
            <div className="flex min-h-80 items-center justify-center text-slate-500">
              <CompactLoader label="Carregando checklist..." />
            </div>
          ) : !data ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
              Não foi possível carregar este checklist.
            </div>
          ) : !data.enabled ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
              Este checklist ainda não está ativo. Peça para o responsável ativar no painel inicial.
            </div>
          ) : (
            <div className="space-y-4">
              {completed && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="h-5 w-5" />
                    Checklist de hoje já foi concluído
                  </div>
                  <p className="mt-1">Responsável: {data.run?.completed_by || 'Funcionário'}</p>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <ShieldCheck className="h-4 w-4 text-[#8CC850]" />
                      Progresso
                    </div>
                    <div className="text-xs text-slate-500">{checkedIds.size}/{tasks.length} itens marcados</div>
                  </div>
                  <div className="text-2xl font-black">{progress}%</div>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              <div className="space-y-3">
                {tasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    disabled={completed}
                    onClick={() => toggleTask(task.id)}
                    className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
                      checkedIds.has(task.id)
                        ? 'border-[#8CC850]/40 bg-[#F5FBED]'
                        : 'border-slate-200 bg-white'
                    } ${completed ? 'opacity-80' : 'active:scale-[0.99]'}`}
                  >
                    <Checkbox checked={checkedIds.has(task.id)} disabled={completed} className="mt-1" />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900">{task.title}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                        {task.required ? 'Obrigatório' : 'Opcional'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {!completed && (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <Input
                    value={completedBy}
                    onChange={(event) => setCompletedBy(event.target.value)}
                    placeholder="Nome do funcionário"
                    className="h-12 rounded-xl bg-white"
                  />
                  <Textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Observações, se tiver..."
                    className="min-h-24 rounded-xl bg-white"
                  />
                  <Button
                    onClick={submitChecklist}
                    disabled={submitting || pendingRequired.length > 0}
                    className="h-12 w-full rounded-2xl bg-[#FF6400] text-base font-black hover:bg-[#e65a00]"
                  >
                    {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                    Finalizar checklist
                  </Button>
                  {pendingRequired.length > 0 && (
                    <p className="text-center text-xs font-semibold text-amber-700">
                      Marque todos os itens obrigatórios para finalizar.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChecklistPublic;
