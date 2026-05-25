import { useEffect, useMemo, useState } from 'react';
import { Clock3, Copy, Mail, MapPin, RefreshCw, Send, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type TimeClockSettings = {
  enabled: boolean;
  require_location: boolean;
  require_face_liveness: boolean;
  require_device_binding: boolean;
  allow_outside_radius: boolean;
  restaurant_latitude: number | null;
  restaurant_longitude: number | null;
  allowed_radius_meters: number;
  face_provider: string;
  policy_notice: string | null;
};

type AutomationSettings = {
  hr_email: string;
  accounting_email: string;
  send_time_clock_monthly: boolean;
  send_nfce_xml_monthly: boolean;
  report_day: number;
};

type TimeClockEvent = {
  id: string;
  waiter_id: string;
  event_type: string;
  status: string;
  occurred_at: string;
  distance_meters: number | null;
  within_geofence: boolean | null;
  face_status: string;
  review_reason: string | null;
  waiter?: { name?: string | null; role?: string | null } | null;
};

type WaiterRow = {
  id: string;
  name?: string | null;
  role?: string | null;
};

const defaultSettings: TimeClockSettings = {
  enabled: true,
  require_location: true,
  require_face_liveness: true,
  require_device_binding: true,
  allow_outside_radius: false,
  restaurant_latitude: null,
  restaurant_longitude: null,
  allowed_radius_meters: 120,
  face_provider: 'manual_review',
  policy_notice: 'O ponto registra horário, localização, aparelho e verificação facial/liveness somente para controle de jornada.',
};

const defaultAutomationSettings: AutomationSettings = {
  hr_email: '',
  accounting_email: '',
  send_time_clock_monthly: true,
  send_nfce_xml_monthly: true,
  report_day: 1,
};

const eventLabels: Record<string, string> = {
  clock_in: 'Entrada',
  break_start: 'Intervalo',
  break_end: 'Retorno',
  clock_out: 'Saída',
};

const statusTone: Record<string, string> = {
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending_review: 'bg-amber-50 text-amber-700 border-amber-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

export default function ControlePonto() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<TimeClockSettings>(defaultSettings);
  const [automationSettings, setAutomationSettings] = useState<AutomationSettings>(defaultAutomationSettings);
  const [events, setEvents] = useState<TimeClockEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [sendingXml, setSendingXml] = useState(false);
  const [reviewingEventId, setReviewingEventId] = useState<string | null>(null);
  const employeeAppUrl = `${window.location.origin}/funcionario-login`;

  const todayEvents = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return events.filter((event) => new Date(event.occurred_at).getTime() >= start.getTime());
  }, [events]);

  const presentCount = useMemo(() => {
    const lastByWaiter = new Map<string, TimeClockEvent>();
    todayEvents
      .slice()
      .sort((left, right) => new Date(left.occurred_at).getTime() - new Date(right.occurred_at).getTime())
      .forEach((event) => lastByWaiter.set(event.waiter_id, event));
    return Array.from(lastByWaiter.values()).filter((event) => event.event_type !== 'clock_out' && event.status !== 'rejected').length;
  }, [todayEvents]);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [settingsResult, eventsResult] = await Promise.all([
        supabase
          .from('employee_time_clock_settings' as any)
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('employee_time_clock_events' as any)
          .select('*')
          .eq('user_id', user.id)
          .order('occurred_at', { ascending: false })
          .limit(80),
      ]);

      if (settingsResult.error) throw settingsResult.error;
      if (eventsResult.error) throw eventsResult.error;

      const waiterIds = Array.from(new Set(((eventsResult.data || []) as any[]).map((event) => event.waiter_id).filter(Boolean)));
      let waitersById = new Map<string, WaiterRow>();
      if (waiterIds.length > 0) {
        const { data: waiterRows, error: waiterError } = await supabase
          .from('waiters' as any)
          .select('id, name, role')
          .eq('user_id', user.id)
          .in('id', waiterIds);
        if (waiterError) throw waiterError;
        waitersById = new Map(((waiterRows || []) as WaiterRow[]).map((waiter) => [waiter.id, waiter]));
      }

      const { data: automationData, error: automationError } = await supabase
        .from('business_email_automation_settings' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (automationError) throw automationError;

      setSettings({ ...defaultSettings, ...(settingsResult.data || {}) } as TimeClockSettings);
      setAutomationSettings({ ...defaultAutomationSettings, ...(automationData || {}) } as AutomationSettings);
      setEvents(((eventsResult.data || []) as TimeClockEvent[]).map((event) => ({
        ...event,
        waiter: waitersById.get(event.waiter_id) || null,
      })));
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar ponto',
        description: error?.message || 'Nao foi possivel carregar o controle de ponto.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [user?.id]);

  const saveSettings = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const payload = {
        ...settings,
        user_id: user.id,
        allowed_radius_meters: Math.max(20, Number(settings.allowed_radius_meters || 120)),
        restaurant_latitude: settings.restaurant_latitude === null ? null : Number(settings.restaurant_latitude),
        restaurant_longitude: settings.restaurant_longitude === null ? null : Number(settings.restaurant_longitude),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('employee_time_clock_settings' as any)
        .upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;

      const automationPayload = {
        ...automationSettings,
        user_id: user.id,
        report_day: Math.max(1, Math.min(28, Number(automationSettings.report_day || 1))),
        updated_at: new Date().toISOString(),
      };
      const { error: automationSaveError } = await supabase
        .from('business_email_automation_settings' as any)
        .upsert(automationPayload, { onConflict: 'user_id' });
      if (automationSaveError) throw automationSaveError;

      toast({ title: 'Controle de ponto salvo', description: 'As regras e automacoes ja valem para a equipe.' });
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error?.message || 'Nao foi possivel salvar as regras.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const copyEmployeeLink = async () => {
    await navigator.clipboard.writeText(employeeAppUrl);
    toast({ title: 'Link copiado', description: 'Envie este link para os funcionarios baterem ponto pelo celular.' });
  };

  const formatEventDate = (value: string) => new Date(value).toLocaleDateString('pt-BR');
  const formatEventTime = (value: string) => new Date(value).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const reviewEvent = async (eventId: string, nextStatus: 'approved' | 'rejected') => {
    setReviewingEventId(eventId);
    try {
      const { error } = await supabase
        .from('employee_time_clock_events' as any)
        .update({
          status: nextStatus,
          reviewed_at: new Date().toISOString(),
          review_reason: nextStatus === 'approved'
            ? 'Registro aprovado manualmente pelo responsavel.'
            : 'Registro rejeitado manualmente pelo responsavel.',
        })
        .eq('id', eventId)
        .eq('user_id', user?.id);
      if (error) throw error;

      toast({
        title: nextStatus === 'approved' ? 'Ponto aprovado' : 'Ponto rejeitado',
        description: 'A revisão foi salva no histórico do controle de ponto.',
      });
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Erro na revisão',
        description: error?.message || 'Nao foi possivel revisar este ponto.',
        variant: 'destructive',
      });
    } finally {
      setReviewingEventId(null);
    }
  };

  const persistAutomationSettings = async () => {
    if (!user?.id) throw new Error('Usuario nao autenticado.');
    const automationPayload = {
      ...automationSettings,
      user_id: user.id,
      hr_email: automationSettings.hr_email.trim(),
      accounting_email: automationSettings.accounting_email.trim(),
      report_day: Math.max(1, Math.min(28, Number(automationSettings.report_day || 1))),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from('business_email_automation_settings' as any)
      .upsert(automationPayload, { onConflict: 'user_id' });
    if (error) throw error;
  };

  const sendAutomationNow = async (operation: 'send_time_clock_monthly_report' | 'send_nfce_xml_monthly') => {
    const isTimeClock = operation === 'send_time_clock_monthly_report';
    if (isTimeClock) setSendingReport(true);
    else setSendingXml(true);

    try {
      await persistAutomationSettings();
      const { data, error } = await supabase.functions.invoke('business-automations', {
        body: { operation, mode: 'manual' },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error(String((data as any).error));
      toast({
        title: isTimeClock ? 'Relatório enviado' : 'XML enviado',
        description: (data as any)?.message || 'Automação executada com sucesso.',
      });
    } catch (error: any) {
      toast({
        title: isTimeClock ? 'Erro ao enviar relatório' : 'Erro ao enviar XML',
        description: error?.message || 'Confira o email configurado e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      if (isTimeClock) setSendingReport(false);
      else setSendingXml(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-[28px] bg-[#063B2A] p-6 text-white shadow-[0_20px_60px_-40px_rgba(0,50,35,0.65)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#D9FF9B]">
                <Clock3 className="h-4 w-4" />
                Ponto inteligente
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight">Controle de ponto da equipe</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/72">
                Estrutura preparada para GPS, aparelho autorizado, auditoria e API facial/liveness. A biometria deve ser processada por provedor seguro; o PopSystem guarda resultado, score e evidências mínimas.
              </p>
            </div>
            <Button className="rounded-2xl bg-[#FF6400] hover:bg-[#E25A00]" onClick={() => void loadData()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        <Card className="rounded-[24px] border-[#E6E0D5]">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-bold text-[#063B2A]">Link do app de ponto do funcionário</div>
              <div className="mt-1 break-all text-sm text-slate-500">{employeeAppUrl}</div>
            </div>
            <Button variant="outline" className="rounded-2xl" onClick={() => void copyEmployeeLink()}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar link
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-[22px] border-[#E6E0D5]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-slate-600"><Users className="h-4 w-4" /> Presentes agora</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold text-[#063B2A]">{presentCount}</CardContent>
          </Card>
          <Card className="rounded-[22px] border-[#E6E0D5]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-slate-600"><ShieldCheck className="h-4 w-4" /> Revisão pendente</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold text-amber-600">{events.filter((event) => event.status === 'pending_review').length}</CardContent>
          </Card>
          <Card className="rounded-[22px] border-[#E6E0D5]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-slate-600"><MapPin className="h-4 w-4" /> Raio permitido</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold text-[#063B2A]">{settings.allowed_radius_meters}m</CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.4fr]">
          <Card className="rounded-[26px] border-[#E6E0D5]">
            <CardHeader>
              <CardTitle>Regras do ponto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {[
                ['enabled', 'Ativar controle de ponto'],
                ['require_location', 'Exigir localização no ponto'],
                ['require_face_liveness', 'Exigir biometria facial/liveness'],
                ['require_device_binding', 'Vincular aparelho do funcionário'],
                ['allow_outside_radius', 'Permitir ponto fora do raio com revisão'],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
                  <Label className="text-sm font-semibold text-[#063B2A]">{label}</Label>
                  <Switch
                    checked={Boolean((settings as any)[key])}
                    onCheckedChange={(checked) => setSettings((current) => ({ ...current, [key]: checked }))}
                  />
                </div>
              ))}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Latitude do restaurante</Label>
                  <Input
                    value={settings.restaurant_latitude ?? ''}
                    onChange={(event) => setSettings((current) => ({ ...current, restaurant_latitude: event.target.value ? Number(event.target.value) : null }))}
                    placeholder="-3.7319"
                    className="h-11 rounded-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Longitude do restaurante</Label>
                  <Input
                    value={settings.restaurant_longitude ?? ''}
                    onChange={(event) => setSettings((current) => ({ ...current, restaurant_longitude: event.target.value ? Number(event.target.value) : null }))}
                    placeholder="-38.5267"
                    className="h-11 rounded-2xl"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Raio permitido em metros</Label>
                  <Input
                    type="number"
                    min={20}
                    value={settings.allowed_radius_meters}
                    onChange={(event) => setSettings((current) => ({ ...current, allowed_radius_meters: Number(event.target.value || 120) }))}
                    className="h-11 rounded-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Provedor facial</Label>
                  <Input
                    value={settings.face_provider}
                    onChange={(event) => setSettings((current) => ({ ...current, face_provider: event.target.value || 'manual_review' }))}
                    placeholder="manual_review, unico, caf, idwall..."
                    className="h-11 rounded-2xl"
                  />
                </div>
              </div>

              <Button className="w-full rounded-2xl bg-[#063B2A] hover:bg-[#04291D]" onClick={() => void saveSettings()} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar regras'}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-[#E6E0D5]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-[#FF6400]" />
                Automação RH e contabilidade
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Email do RH</Label>
                  <Input
                    type="email"
                    value={automationSettings.hr_email}
                    onChange={(event) => setAutomationSettings((current) => ({ ...current, hr_email: event.target.value }))}
                    placeholder="rh@empresa.com"
                    className="h-11 rounded-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email da contabilidade</Label>
                  <Input
                    type="email"
                    value={automationSettings.accounting_email}
                    onChange={(event) => setAutomationSettings((current) => ({ ...current, accounting_email: event.target.value }))}
                    placeholder="contador@contabilidade.com"
                    className="h-11 rounded-2xl"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="font-semibold text-[#063B2A]">Envio mensal automático</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    O sistema fica preparado para enviar no dia configurado. O disparo usa a Edge Function de automações.
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Dia do mês</Label>
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={automationSettings.report_day}
                    onChange={(event) => setAutomationSettings((current) => ({ ...current, report_day: Number(event.target.value || 1) }))}
                    className="h-11 rounded-2xl"
                  />
                </div>
              </div>

              {[
                ['send_time_clock_monthly', 'Enviar relatório mensal de ponto para RH'],
                ['send_nfce_xml_monthly', 'Enviar XML mensal NFC-e para contabilidade'],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
                  <Label className="text-sm font-semibold text-[#063B2A]">{label}</Label>
                  <Switch
                    checked={Boolean((automationSettings as any)[key])}
                    onCheckedChange={(checked) => setAutomationSettings((current) => ({ ...current, [key]: checked }))}
                  />
                </div>
              ))}

              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => void sendAutomationNow('send_time_clock_monthly_report')}
                  disabled={sendingReport}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {sendingReport ? 'Enviando...' : 'Enviar ponto agora'}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => void sendAutomationNow('send_nfce_xml_monthly')}
                  disabled={sendingXml}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {sendingXml ? 'Enviando...' : 'Enviar XML agora'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr]">
          <Card className="rounded-[26px] border-[#E6E0D5]">
            <CardHeader>
              <CardTitle>Últimos pontos</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>GPS</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead className="text-right">Revisão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">{event.waiter?.name || 'Funcionário'}</TableCell>
                      <TableCell>{eventLabels[event.event_type] || event.event_type}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="outline" className={statusTone[event.status] || 'bg-slate-50 text-slate-700'}>
                            {event.status === 'approved' ? 'Aprovado' : event.status === 'rejected' ? 'Rejeitado' : 'Revisão'}
                          </Badge>
                          {event.review_reason && (
                            <div className="max-w-[260px] text-xs leading-4 text-slate-500">{event.review_reason}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{event.distance_meters != null ? `${Math.round(Number(event.distance_meters))}m` : '-'}</TableCell>
                      <TableCell>{formatEventDate(event.occurred_at)}</TableCell>
                      <TableCell>{formatEventTime(event.occurred_at)}</TableCell>
                      <TableCell className="text-right">
                        {event.status === 'pending_review' ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 rounded-xl border-red-200 text-red-700 hover:bg-red-50"
                              onClick={() => void reviewEvent(event.id, 'rejected')}
                              disabled={reviewingEventId === event.id}
                            >
                              Rejeitar
                            </Button>
                            <Button
                              size="sm"
                              className="h-9 rounded-xl bg-[#063B2A] hover:bg-[#04291D]"
                              onClick={() => void reviewEvent(event.id, 'approved')}
                              disabled={reviewingEventId === event.id}
                            >
                              Aprovar
                            </Button>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">Concluída</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {events.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-slate-500">
                        Nenhum ponto registrado ainda.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
