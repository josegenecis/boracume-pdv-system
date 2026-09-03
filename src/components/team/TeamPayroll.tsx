/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileDown, FileSpreadsheet, Landmark, Plus, RotateCcw, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { PayrollPreviewRow } from '@/lib/team/types';
import { exportPayrollPdf, exportPayrollXlsx, exportTimeSheetPdf } from '@/lib/team/teamReports';
import { STATUS_LABELS } from './teamOptions';

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const hours = (minutes: number) => `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`;

export function TeamPayroll(props: { rows: PayrollPreviewRow[]; competence: string; restaurantName: string; responsible: string; closing: any | null; busy: boolean; canApprove: boolean; canReopen: boolean; onCompetenceChange: (value: string) => void; onSavePreview: () => Promise<void>; onApprove: () => Promise<void>; onReopen: (reason: string) => Promise<void>; onGeneratePayables: (dueDate: string) => Promise<void>; onAdjustment: (value: { employeeId: string; type: 'earning' | 'deduction'; category: string; amount: number; description: string }) => Promise<void> }) {
  const [selected, setSelected] = useState<PayrollPreviewRow | null>(null);
  const [dueDate, setDueDate] = useState(`${props.competence}-05`);
  const [filters, setFilters] = useState({
    employee: 'all',
    unit: 'all',
    department: 'all',
  });
  const [adjustment, setAdjustment] = useState({
    type: 'earning' as 'earning' | 'deduction',
    category: 'Ajuste autorizado',
    amount: 0,
    description: '',
  });
  useEffect(() => setDueDate(`${props.competence}-05`), [props.competence]);
  const units = useMemo(() => [...new Set(props.rows.map((row) => row.employee.unit_name).filter(Boolean) as string[])].sort(), [props.rows]);
  const departments = useMemo(() => [...new Set(props.rows.map((row) => row.employee.department).filter(Boolean) as string[])].sort(), [props.rows]);
  const visibleRows = useMemo(() => props.rows.filter((row) => (filters.employee === 'all' || row.employeeId === filters.employee) && (filters.unit === 'all' || row.employee.unit_name === filters.unit) && (filters.department === 'all' || row.employee.department === filters.department)), [filters, props.rows]);
  const total = visibleRows.reduce((sum, row) => sum + row.netAmount, 0);
  const approved = ['approved', 'generated_financial', 'paid'].includes(props.closing?.status);
  const addAdjustment = async () => {
    if (!selected) return;
    await props.onAdjustment({
      employeeId: selected.employeeId,
      ...adjustment,
    });
    setAdjustment((value) => ({ ...value, amount: 0, description: '' }));
  };
  return (
    <div className="space-y-4">
      <Card className="border-emerald-200 bg-gradient-to-r from-emerald-950 to-emerald-800 text-white">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-emerald-100">Fechamento de Equipe / Prévia de Pagamento</p>
            <p className="mt-1 text-3xl font-black">{money(total)}</p>
            <p className="mt-1 text-xs text-emerald-100">Não substitui a folha contábil oficial.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1 text-xs">
              <span>Competência</span>
              <Input type="month" className="bg-white text-slate-900" value={props.competence} onChange={(e) => props.onCompetenceChange(e.target.value)} />
            </label>
            <Button variant="secondary" onClick={props.onSavePreview} disabled={props.busy || approved}>
              {props.closing ? 'Recalcular prévia' : 'Fechar mês'}
            </Button>
            <Button variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => exportPayrollXlsx(visibleRows, props.competence)}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Excel
            </Button>
            <Button variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => exportPayrollPdf(visibleRows, props.competence, props.restaurantName, props.responsible)}>
              <FileDown className="mr-2 h-4 w-4" />
              PDF
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-3">
          <Filter
            label="Funcionário"
            value={filters.employee}
            onChange={(value) => setFilters({ ...filters, employee: value })}
            options={props.rows.map((row) => ({
              value: row.employeeId,
              label: row.employee.full_name,
            }))}
          />
          <Filter label="Unidade" value={filters.unit} onChange={(value) => setFilters({ ...filters, unit: value })} options={units.map((value) => ({ value, label: value }))} />
          <Filter label="Setor" value={filters.department} onChange={(value) => setFilters({ ...filters, department: value })} options={departments.map((value) => ({ value, label: value }))} />
        </CardContent>
      </Card>
      {props.closing && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">{STATUS_LABELS[props.closing.status] || props.closing.status}</Badge>
              <span className="text-sm text-slate-500">Aprovado não recalcula silenciosamente.</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {props.closing.status === 'review' && props.canApprove && (
                <Button onClick={props.onApprove} disabled={props.busy}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Aprovar
                </Button>
              )}
              {props.closing.status === 'approved' && (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    Vencimento <Input type="date" className="w-40" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  </label>
                  <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => props.onGeneratePayables(dueDate)} disabled={props.busy}>
                    <Landmark className="mr-2 h-4 w-4" />
                    Gerar Contas a Pagar
                  </Button>
                </>
              )}
              {props.closing.status === 'approved' && props.canReopen && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const reason = window.prompt('Motivo da reabertura:');
                    if (reason) props.onReopen(reason);
                  }}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reabrir
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Base</TableHead>
                  <TableHead>Trabalhado</TableHead>
                  <TableHead>Extras</TableHead>
                  <TableHead>Faltas</TableHead>
                  <TableHead>Comissões</TableHead>
                  <TableHead>Adiantamentos</TableHead>
                  <TableHead>Descontos</TableHead>
                  <TableHead className="text-right">Saldo previsto</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((row) => (
                  <TableRow key={row.employeeId}>
                    <TableCell>
                      <strong>{row.employee.full_name}</strong>
                      <small className="block text-slate-500">{row.employee.job_title || 'Sem cargo'}</small>
                    </TableCell>
                    <TableCell>{money(row.baseSalary)}</TableCell>
                    <TableCell>{hours(row.workedMinutes)}</TableCell>
                    <TableCell>{hours(row.overtimeMinutes)}</TableCell>
                    <TableCell>{row.absenceDays}</TableCell>
                    <TableCell>{money(row.commissions)}</TableCell>
                    <TableCell>{money(row.advances)}</TableCell>
                    <TableCell>{money(row.totalDeductions)}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-800">{money(row.netAmount)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setSelected(row)}>
                        <Search className="mr-2 h-4 w-4" />
                        Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!visibleRows.length && (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-slate-500">
                      Nenhum colaborador corresponde aos filtros.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl bg-white">
          <DialogHeader>
            <DialogTitle>Detalhes do fechamento — {selected?.employee.full_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="max-h-[75vh] space-y-5 overflow-y-auto pr-1">
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  ['Dias trabalhados', selected.workedDays],
                  ['Faltas', selected.absenceDays],
                  ['Horas extras', hours(selected.overtimeMinutes)],
                  ['Atrasos', hours(selected.lateMinutes)],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl border p-3">
                    <small className="text-slate-500">{label}</small>
                    <strong className="block text-lg">{value}</strong>
                  </div>
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Summary
                  title="Proventos"
                  rows={[
                    ['Salário', selected.baseSalary],
                    ['Horas extras', selected.overtimeAmount],
                    ['Comissões', selected.commissions],
                    ['Bonificações', selected.bonuses],
                    ['Outros', selected.otherEarnings],
                  ]}
                  total={selected.totalEarnings}
                />
                <Summary
                  title="Descontos"
                  rows={[
                    ['Faltas', selected.absenceDeductions],
                    ['Atrasos', selected.lateDeductions],
                    ['Adiantamentos', selected.advances],
                    ['Outros', selected.otherDeductions],
                  ]}
                  total={selected.totalDeductions}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl bg-emerald-950 p-4 text-white">
                <strong>Saldo previsto</strong>
                <strong className="text-2xl">{money(selected.netAmount)}</strong>
              </div>
              {props.closing?.status === 'review' && (
                <Card className="border-orange-200 bg-orange-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Adicionar provento ou desconto autorizado</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    <Filter
                      label="Tipo"
                      value={adjustment.type}
                      onChange={(value) =>
                        setAdjustment({
                          ...adjustment,
                          type: value as 'earning' | 'deduction',
                        })
                      }
                      includeAll={false}
                      options={[
                        { value: 'earning', label: 'Provento' },
                        { value: 'deduction', label: 'Desconto' },
                      ]}
                    />
                    <label className="space-y-1">
                      <Label>Categoria</Label>
                      <Input
                        value={adjustment.category}
                        onChange={(e) =>
                          setAdjustment({
                            ...adjustment,
                            category: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="space-y-1">
                      <Label>Valor</Label>
                      <CurrencyInput value={adjustment.amount} onValueChange={(value) => setAdjustment({ ...adjustment, amount: value })} />
                    </label>
                    <label className="space-y-1">
                      <Label>Motivo / descrição</Label>
                      <Input
                        value={adjustment.description}
                        onChange={(e) =>
                          setAdjustment({
                            ...adjustment,
                            description: e.target.value,
                          })
                        }
                      />
                    </label>
                    <Button className="sm:col-span-2" disabled={props.busy || adjustment.amount <= 0 || adjustment.description.trim().length < 3} onClick={addAdjustment}>
                      <Plus className="mr-2 h-4 w-4" />
                      Registrar ajuste com auditoria
                    </Button>
                  </CardContent>
                </Card>
              )}
              <Button variant="outline" onClick={() => exportTimeSheetPdf(selected, props.competence, props.restaurantName)}>
                <FileDown className="mr-2 h-4 w-4" />
                Gerar espelho de ponto
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Filter({ label, value, onChange, options, includeAll = true }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; includeAll?: boolean }) {
  return (
    <label className="space-y-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {includeAll && <SelectItem value="all">Todos</SelectItem>}
          {options.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
function Summary({ title, rows, total }: { title: string; rows: Array<[string, number]>; total: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-slate-500">{label}</span>
            <span>{money(value)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t pt-2 font-bold">
          <span>Total</span>
          <span>{money(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
