import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { TeamEmployee, WorkSchedule } from '@/lib/team/types';
import { WEEKDAYS } from './teamOptions';

const today = new Date().toISOString().slice(0, 10);

export function TeamSchedules({ employees, schedules, saving, onSave }: {
  employees: TeamEmployee[];
  schedules: WorkSchedule[];
  saving: boolean;
  onSave: (items: WorkSchedule[]) => Promise<void>;
}) {
  const [employeeId, setEmployeeId] = useState('');
  const [draft, setDraft] = useState<WorkSchedule[]>([]);
  useEffect(() => { if (!employeeId && employees[0]) setEmployeeId(employees[0].id); }, [employeeId, employees]);
  const employee = employees.find((item) => item.id === employeeId);
  const selectedSchedules = useMemo(() => schedules.filter((item) => item.employee_id === employeeId), [employeeId, schedules]);
  useEffect(() => {
    if (!employeeId) return;
    setDraft(WEEKDAYS.map((_, weekday) => selectedSchedules.find((item) => item.weekday === weekday) || {
      employee_id: employeeId, weekday, first_start: '08:00', first_end: '12:00', second_start: '13:00', second_end: '17:00',
      is_day_off: employee?.default_day_off === weekday, schedule_type: 'fixed', effective_from: today, effective_until: null,
    }));
  }, [employeeId, employee?.default_day_off, selectedSchedules]);
  const patch = (weekday: number, value: Partial<WorkSchedule>) => setDraft((current) => current.map((item) => item.weekday === weekday ? { ...item, ...value } : item));
  return <div className="space-y-4">
    <Card><CardContent className="grid gap-3 p-4 lg:grid-cols-[1fr_260px_180px_180px_180px] lg:items-end"><div><p className="font-semibold text-emerald-950">Escala semanal</p><p className="text-sm text-slate-500">Defina jornada fixa ou variável, turnos, vigência e folgas sem alterar o ponto.</p></div><label className="space-y-1"><Label>Colaborador</Label><Select value={employeeId} onValueChange={setEmployeeId}><SelectTrigger><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger><SelectContent>{employees.filter((item) => item.employment_status !== 'terminated').map((item) => <SelectItem key={item.id} value={item.id}>{item.full_name}</SelectItem>)}</SelectContent></Select></label><label className="space-y-1"><Label>Tipo</Label><Select value={draft[0]?.schedule_type||'fixed'} onValueChange={(value)=>setDraft((current)=>current.map((item)=>({...item,schedule_type:value as WorkSchedule['schedule_type']})))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">Jornada fixa</SelectItem><SelectItem value="variable">Escala variável</SelectItem></SelectContent></Select></label><label className="space-y-1"><Label>Vigência inicial</Label><Input type="date" value={draft[0]?.effective_from||today} onChange={(e)=>setDraft((current)=>current.map((item)=>({...item,effective_from:e.target.value})))} /></label><label className="space-y-1"><Label>Vigência final</Label><Input type="date" value={draft[0]?.effective_until||''} onChange={(e)=>setDraft((current)=>current.map((item)=>({...item,effective_until:e.target.value||null})))} /></label></CardContent></Card>
    <div className="grid gap-3">{draft.map((schedule) => <Card key={schedule.weekday} className={schedule.is_day_off ? 'border-violet-200 bg-violet-50/40' : ''}><CardContent className="grid items-center gap-3 p-4 md:grid-cols-[150px_100px_1fr_1fr_1fr_1fr]"> <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-emerald-700" /><strong>{WEEKDAYS[schedule.weekday]}</strong></div><label className="flex items-center gap-2 text-sm"><Switch checked={schedule.is_day_off} onCheckedChange={(checked) => patch(schedule.weekday, { is_day_off: checked })} />Folga</label>{schedule.is_day_off ? <div className="md:col-span-4"><Badge variant="secondary">Sem jornada prevista</Badge></div> : <><Input type="time" value={schedule.first_start || ''} onChange={(e) => patch(schedule.weekday,{first_start:e.target.value})} aria-label={`Início ${WEEKDAYS[schedule.weekday]}`} /><Input type="time" value={schedule.first_end || ''} onChange={(e) => patch(schedule.weekday,{first_end:e.target.value})} aria-label={`Fim do primeiro turno ${WEEKDAYS[schedule.weekday]}`} /><Input type="time" value={schedule.second_start || ''} onChange={(e) => patch(schedule.weekday,{second_start:e.target.value || null})} aria-label={`Retorno ${WEEKDAYS[schedule.weekday]}`} /><Input type="time" value={schedule.second_end || ''} onChange={(e) => patch(schedule.weekday,{second_end:e.target.value || null})} aria-label={`Saída ${WEEKDAYS[schedule.weekday]}`} /></>}</CardContent></Card>)}</div>
    <div className="flex justify-end"><Button disabled={!employeeId || saving} onClick={() => onSave(draft)} className="bg-emerald-700 hover:bg-emerald-800"><Save className="mr-2 h-4 w-4" />{saving ? 'Salvando...' : 'Salvar escala'}</Button></div>
  </div>;
}
