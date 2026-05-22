import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock, MessageCircle, Pause, Play, RefreshCw, Send, ShieldCheck, Square, Users } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Campaign = {
  id: string;
  title: string;
  message: string;
  status: string;
  target_count: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  daily_limit: number;
  min_delay_seconds: number;
  max_delay_seconds: number;
  scheduled_at: string;
  created_at: string;
};

type AudiencePreview = {
  count: number;
  activeWindowDays: number;
  cooldownDays: number;
  sample?: Array<{ name: string; phone: string; lastActivity: string }>;
};

const statusLabels: Record<string, string> = {
  draft: 'Rascunho',
  scheduled: 'Agendada',
  running: 'Rodando',
  paused: 'Pausada',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

const statusClass: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  running: 'bg-amber-50 text-amber-700 border-amber-200',
  paused: 'bg-zinc-50 text-zinc-700 border-zinc-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

const defaultMessage = 'Oi {nome}! Hoje temos uma oferta especial para você. Confira no cardápio: {cardapio}';

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function progressOf(campaign: Campaign) {
  const total = Number(campaign.target_count || 0);
  if (!total) return 0;
  return Math.min(100, Math.round(((Number(campaign.sent_count || 0) + Number(campaign.failed_count || 0) + Number(campaign.skipped_count || 0)) / total) * 100));
}

export default function WhatsAppCampaignManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState(defaultMessage);
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(40);
  const [minDelayMinutes, setMinDelayMinutes] = useState(3);
  const [maxDelayMinutes, setMaxDelayMinutes] = useState(12);
  const [scheduledAt, setScheduledAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [audience, setAudience] = useState<AudiencePreview | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  const minDelaySeconds = useMemo(() => Math.max(1, minDelayMinutes) * 60, [minDelayMinutes]);
  const maxDelaySeconds = useMemo(() => Math.max(minDelayMinutes, maxDelayMinutes) * 60, [maxDelayMinutes, minDelayMinutes]);

  useEffect(() => {
    if (!user?.id) return;
    fetchCampaigns();
    previewAudience();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const timer = window.setInterval(() => {
      processQueue(true);
    }, 60000);

    return () => window.clearInterval(timer);
  }, [user?.id]);

  const fetchCampaigns = async () => {
    if (!user?.id) return;
    const { data, error } = await (supabase as any)
      .from('whatsapp_marketing_campaigns')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error(error);
      return;
    }

    setCampaigns(data || []);
  };

  const previewAudience = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-campaigns', {
        body: { action: 'preview-audience' },
      });

      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAudience((data as any).audience);
    } catch (error: any) {
      console.error('Erro ao pré-visualizar público:', error);
    }
  };

  const createCampaign = async () => {
    if (!riskAccepted) {
      toast({
        title: 'Confirme o risco antes de enviar',
        description: 'O WhatsApp pode limitar ou bloquear número que dispara mensagem sem cuidado.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-campaigns', {
        body: {
          action: 'create',
          title,
          message,
          riskAcknowledged: riskAccepted,
          activeConversationsOnly: true,
          dailyLimit,
          minDelaySeconds,
          maxDelaySeconds,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString(),
          quietHoursStart: '21:00',
          quietHoursEnd: '09:00',
          timezone: 'America/Fortaleza',
          optOutText: 'Responder SAIR para não receber novas ofertas.',
        },
      });

      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast({
        title: 'Campanha criada',
        description: `${(data as any)?.targetCount || 0} conversas ativas entraram na fila segura.`,
      });
      setTitle('');
      setRiskAccepted(false);
      await Promise.all([fetchCampaigns(), previewAudience()]);
    } catch (error: any) {
      toast({
        title: 'Não foi possível criar a campanha',
        description: String(error?.message || error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const processQueue = async (silent = false) => {
    if (processing) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-campaigns', {
        body: { action: 'process', batchSize: 5 },
      });

      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const processed = (data as any)?.processed || [];
      if (!silent) {
        toast({
          title: 'Fila processada',
          description: processed.length ? `${processed.length} mensagem(ns) avaliadas agora.` : 'Nenhuma mensagem estava pronta para envio.',
        });
      }
      await Promise.all([fetchCampaigns(), previewAudience()]);
    } catch (error: any) {
      if (!silent) {
        toast({
          title: 'Erro ao processar fila',
          description: String(error?.message || error),
          variant: 'destructive',
        });
      }
    } finally {
      setProcessing(false);
    }
  };

  const changeStatus = async (campaignId: string, action: 'pause' | 'resume' | 'cancel') => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-campaigns', {
        body: { action, campaignId },
      });

      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      await fetchCampaigns();
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar campanha',
        description: String(error?.message || error),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-5">
      <Alert className="border-amber-200 bg-amber-50 text-amber-950">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Envio com risco controlado, não disparo em massa</AlertTitle>
        <AlertDescription>
          O WhatsApp pode bloquear ou limitar o número se perceber comportamento de spam. Esta ferramenta só envia para conversas ativas já existentes, inclui saída por SAIR, respeita pausa noturna, aplica intervalo aleatório e evita reenviar oferta para o mesmo telefone por 7 dias.
        </AlertDescription>
      </Alert>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <MessageCircle className="h-5 w-5 text-emerald-700" />
              Ofertas automáticas via WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wa-campaign-title">Nome da campanha</Label>
                <Input
                  id="wa-campaign-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Ex.: Oferta de sexta"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wa-schedule">Iniciar em</Label>
                <Input
                  id="wa-schedule"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wa-message">Mensagem</Label>
              <Textarea
                id="wa-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={5}
                className="resize-none"
              />
              <div className="text-xs text-muted-foreground">
                Variáveis disponíveis: {'{nome}'} e {'{cardapio}'}. O texto “Responder SAIR...” entra automaticamente no final.
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="wa-limit">Limite diário</Label>
                <Input
                  id="wa-limit"
                  type="number"
                  min={1}
                  max={200}
                  value={dailyLimit}
                  onChange={(event) => setDailyLimit(Number(event.target.value || 1))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wa-min-delay">Intervalo mínimo</Label>
                <Input
                  id="wa-min-delay"
                  type="number"
                  min={1}
                  value={minDelayMinutes}
                  onChange={(event) => setMinDelayMinutes(Number(event.target.value || 1))}
                />
                <div className="text-xs text-muted-foreground">minutos entre mensagens</div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wa-max-delay">Intervalo máximo</Label>
                <Input
                  id="wa-max-delay"
                  type="number"
                  min={minDelayMinutes}
                  value={maxDelayMinutes}
                  onChange={(event) => setMaxDelayMinutes(Number(event.target.value || minDelayMinutes))}
                />
                <div className="text-xs text-muted-foreground">com sorteio aleatório</div>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="wa-risk"
                  checked={riskAccepted}
                  onCheckedChange={(checked) => setRiskAccepted(Boolean(checked))}
                  className="mt-0.5"
                />
                <Label htmlFor="wa-risk" className="cursor-pointer leading-relaxed">
                  Confirmo que entendi o risco de bloqueio do número e que as ofertas serão enviadas somente para clientes com conversa ativa no WhatsApp.
                </Label>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={createCampaign} disabled={loading} className="gap-2 bg-orange-600 hover:bg-orange-700">
                <Send className="h-4 w-4" />
                Criar campanha segura
              </Button>
              <Button type="button" variant="outline" onClick={() => processQueue(false)} disabled={processing} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${processing ? 'animate-spin' : ''}`} />
                Processar fila agora
              </Button>
              <Button type="button" variant="ghost" onClick={previewAudience} className="gap-2">
                <Users className="h-4 w-4" />
                Atualizar público
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-emerald-700" />
              Público permitido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-emerald-50 p-4">
              <div className="text-sm text-emerald-800">Conversas ativas elegíveis</div>
              <div className="mt-1 text-4xl font-bold text-emerald-950">{audience?.count ?? '-'}</div>
              <div className="mt-2 text-xs text-emerald-800">
                Com mensagem recebida do cliente, atividade nos últimos {audience?.activeWindowDays || 30} dias, sem opt-out e sem oferta nos últimos {audience?.cooldownDays || 7} dias.
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Pausa automática das 21:00 às 09:00.
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                Lista fria/importada não é aceita nesta versão.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campanhas recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progresso</TableHead>
                <TableHead>Agendada</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Nenhuma campanha criada ainda.
                  </TableCell>
                </TableRow>
              ) : campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell>
                    <div className="font-semibold">{campaign.title}</div>
                    <div className="line-clamp-1 text-xs text-muted-foreground">{campaign.message}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusClass[campaign.status] || ''}>
                      {statusLabels[campaign.status] || campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="min-w-[220px]">
                    <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                      <span>{campaign.sent_count}/{campaign.target_count} enviados</span>
                      <span>{progressOf(campaign)}%</span>
                    </div>
                    <Progress value={progressOf(campaign)} />
                    {(campaign.failed_count > 0 || campaign.skipped_count > 0) && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {campaign.failed_count} falha(s), {campaign.skipped_count} ignorado(s)
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{formatDateTime(campaign.scheduled_at)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {campaign.status === 'paused' ? (
                        <Button size="icon" variant="outline" onClick={() => changeStatus(campaign.id, 'resume')} title="Retomar">
                          <Play className="h-4 w-4" />
                        </Button>
                      ) : campaign.status === 'scheduled' ? (
                        <Button size="icon" variant="outline" onClick={() => changeStatus(campaign.id, 'pause')} title="Pausar">
                          <Pause className="h-4 w-4" />
                        </Button>
                      ) : null}
                      {['scheduled', 'paused'].includes(campaign.status) && (
                        <Button size="icon" variant="outline" onClick={() => changeStatus(campaign.id, 'cancel')} title="Cancelar">
                          <Square className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
