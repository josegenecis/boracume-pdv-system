/* eslint-disable @typescript-eslint/no-explicit-any */
import { AlertTriangle, Banknote, CalendarClock, CircleDollarSign, Clock3, UserCheck, UserRoundCheck, UsersRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AttendanceSummary, TeamEmployee } from '@/lib/team/types';

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

export function TeamOverview({ employees, attendance, commissions, pendingClosings, alerts, loading }: {
  employees: TeamEmployee[];
  attendance: AttendanceSummary[];
  commissions: number;
  pendingClosings: number;
  alerts: any[];
  loading: boolean;
}) {
  const active = employees.filter((item) => item.employment_status === 'active');
  const workingNow = attendance.filter((item) => item.days.at(-1)?.incomplete && item.days.at(-1)?.workedMinutes > 0).length;
  const overtime = attendance.reduce((total, item) => total + item.overtimeMinutes, 0);
  const absences = attendance.reduce((total, item) => total + item.absenceDays, 0);
  const estimatedCost = active.reduce((total, item) => total + item.compensation.salary_base + item.compensation.default_bonus, 0) + commissions;
  const metrics = [
    { label: 'Funcionários ativos', value: active.length, detail: `${employees.length} cadastrados`, icon: UsersRound, color: 'text-emerald-700 bg-emerald-50' },
    { label: 'Trabalhando agora', value: workingNow, detail: 'ponto em andamento', icon: UserRoundCheck, color: 'text-blue-700 bg-blue-50' },
    { label: 'Faltas no período', value: absences, detail: 'conforme jornada', icon: AlertTriangle, color: 'text-red-700 bg-red-50' },
    { label: 'Horas extras', value: `${Math.floor(overtime / 60)}h${String(overtime % 60).padStart(2, '0')}`, detail: 'mês atual', icon: Clock3, color: 'text-violet-700 bg-violet-50' },
    { label: 'Custo estimado', value: money(estimatedCost), detail: 'base + bônus + comissões', icon: Banknote, color: 'text-orange-700 bg-orange-50' },
    { label: 'Comissões', value: money(commissions), detail: 'acumuladas no mês', icon: CircleDollarSign, color: 'text-cyan-700 bg-cyan-50' },
    { label: 'Fechamentos pendentes', value: pendingClosings, detail: 'em apuração ou revisão', icon: CalendarClock, color: 'text-amber-700 bg-amber-50' },
    { label: 'Cadastros completos', value: employees.filter((item) => item.cpf && item.hire_date && item.job_title).length, detail: 'com CPF, cargo e admissão', icon: UserCheck, color: 'text-lime-700 bg-lime-50' },
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <Card key={metric.label} className="border-slate-200 shadow-sm"><CardContent className="flex items-start justify-between p-5"><div><p className="text-sm font-medium text-slate-500">{metric.label}</p><p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{loading ? '—' : metric.value}</p><p className="mt-1 text-xs text-slate-500">{metric.detail}</p></div><span className={`rounded-xl p-2.5 ${metric.color}`}><metric.icon className="h-5 w-5" /></span></CardContent></Card>)}</div>
      <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
        <Card><CardHeader><CardTitle className="text-lg">Situação da equipe</CardTitle></CardHeader><CardContent className="space-y-2">{active.slice(0, 8).map((employee) => { const summary = attendance.find((item) => item.employeeId === employee.id); const today = summary?.days.at(-1); return <div key={employee.id} className="flex items-center justify-between rounded-xl border px-4 py-3"><div><strong className="block text-sm text-emerald-950">{employee.display_name || employee.full_name}</strong><small className="text-slate-500">{employee.job_title || 'Cargo não informado'}</small></div><Badge variant="outline" className={today?.incomplete ? 'border-blue-200 bg-blue-50 text-blue-700' : today?.isDayOff ? 'border-violet-200 bg-violet-50 text-violet-700' : today?.isAbsence ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200'}>{today?.incomplete ? 'Em expediente' : today?.isDayOff ? 'Folga' : today?.isAbsence ? 'Ausente' : 'Sem ponto aberto'}</Badge></div>; })}{!active.length && <p className="py-8 text-center text-sm text-slate-500">Cadastre o primeiro colaborador para começar.</p>}</CardContent></Card>
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-950 to-emerald-800 text-white"><CardHeader><CardTitle className="text-lg">Fechamento inteligente</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-emerald-50">O PopSystem cruza jornada, ponto, ocorrências, comissões, bônus e adiantamentos. Os cálculos legais continuam parametrizáveis e a prévia não substitui a folha contábil oficial.</p><div className="mt-5 rounded-xl border border-white/15 bg-white/10 p-4 text-sm"><strong>Próximo passo</strong><p className="mt-1 text-emerald-100">Revise a jornada e abra “Fechamento Mensal”.</p></div></CardContent></Card>
      </div>
      {alerts.length > 0 && <Card className="border-amber-200"><CardHeader><CardTitle className="flex items-center gap-2 text-lg text-amber-950"><AlertTriangle className="h-5 w-5" />Alertas da equipe</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-2">{alerts.map((alert) => <div key={alert.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3"><div className="flex items-center justify-between gap-2"><strong className="text-sm text-amber-950">{alert.title}</strong><Badge variant="outline" className="border-amber-300 text-amber-800">{alert.severity}</Badge></div><p className="mt-1 text-xs leading-5 text-amber-900">{alert.description}</p></div>)}</CardContent></Card>}
    </div>
  );
}
