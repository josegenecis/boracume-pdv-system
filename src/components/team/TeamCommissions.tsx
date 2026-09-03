/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { BadgePercent, Banknote, Plus, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CommissionRule, CommissionRuleType, TeamEmployee, TeamProductOption } from '@/lib/team/types';

const today = new Date().toISOString().slice(0, 10);
const ruleLabels: Record<CommissionRuleType, string> = {
  sale_percentage: 'Percentual por venda',
  fixed_per_sale: 'Valor fixo por venda',
  product_percentage: 'Percentual por produto',
  product_fixed: 'Valor fixo por unidade vendida',
};

export function TeamCommissions({ employees, accounts, rules, products, busy, onCommission, onAdvance, onRule }: { employees: TeamEmployee[]; accounts: any[]; rules: CommissionRule[]; products: TeamProductOption[]; busy: boolean; onCommission: (value: { employeeId: string; amount: number; description: string; date: string; type: 'manual' | 'bonus' }) => Promise<void>; onAdvance: (value: { employeeId: string; amount: number; date: string; method: string; accountId: string; note: string }) => Promise<void>; onRule: (value: { ruleId?: string; employeeId: string; ruleType: CommissionRuleType; percentage: number | null; fixedAmount: number | null; productId: string | null; active: boolean; startsAt: string; endsAt: string | null }) => Promise<void> }) {
  const firstEmployee = employees.find((item) => item.employment_status === 'active')?.id || '';
  const [commission, setCommission] = useState({
    employeeId: '',
    amount: 0,
    description: 'Bonificação manual',
    date: today,
    type: 'bonus' as 'manual' | 'bonus',
  });
  const [advance, setAdvance] = useState({
    employeeId: '',
    amount: 0,
    date: today,
    method: 'PIX',
    accountId: '',
    note: '',
  });
  const [rule, setRule] = useState({
    employeeId: '',
    ruleType: 'sale_percentage' as CommissionRuleType,
    value: 0,
    productId: '',
    startsAt: today,
    endsAt: '',
  });
  useEffect(() => {
    if (!commission.employeeId && firstEmployee) {
      setCommission((v) => ({ ...v, employeeId: firstEmployee }));
      setAdvance((v) => ({ ...v, employeeId: firstEmployee }));
      setRule((v) => ({ ...v, employeeId: firstEmployee }));
    }
  }, [commission.employeeId, firstEmployee]);
  useEffect(() => {
    if (!advance.accountId && accounts[0]) setAdvance((v) => ({ ...v, accountId: accounts[0].id }));
  }, [accounts, advance.accountId]);
  const employeeNames = useMemo(() => new Map(employees.map((item) => [item.id, item.full_name])), [employees]);
  const productNames = useMemo(() => new Map(products.map((item) => [item.id, item.name])), [products]);
  const isPercentage = rule.ruleType.endsWith('percentage');
  const needsProduct = rule.ruleType.startsWith('product_');
  const submitRule = () =>
    onRule({
      employeeId: rule.employeeId,
      ruleType: rule.ruleType,
      percentage: isPercentage ? rule.value : null,
      fixedAmount: isPercentage ? null : rule.value,
      productId: needsProduct ? rule.productId : null,
      active: true,
      startsAt: rule.startsAt,
      endsAt: rule.endsAt || null,
    });
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings2 className="h-5 w-5 text-orange-500" />
              Regras automáticas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <EmployeeSelect employees={employees} value={rule.employeeId} onChange={(value) => setRule({ ...rule, employeeId: value })} />
            <Field label="Cálculo">
              <Select value={rule.ruleType} onValueChange={(value) => setRule({ ...rule, ruleType: value as CommissionRuleType })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ruleLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {needsProduct && (
              <Field label="Produto">
                <Select value={rule.productId} onValueChange={(value) => setRule({ ...rule, productId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={isPercentage ? 'Percentual (%)' : 'Valor'}>{isPercentage ? <Input type="number" min={0} max={100} step="0.01" value={rule.value} onChange={(e) => setRule({ ...rule, value: Number(e.target.value) })} /> : <CurrencyInput value={rule.value} onValueChange={(value) => setRule({ ...rule, value })} />}</Field>
              <Field label="Início">
                <Input type="date" value={rule.startsAt} onChange={(e) => setRule({ ...rule, startsAt: e.target.value })} />
              </Field>
              <Field label="Fim (opcional)">
                <Input type="date" value={rule.endsAt} onChange={(e) => setRule({ ...rule, endsAt: e.target.value })} />
              </Field>
            </div>
            <Button className="w-full bg-orange-500 hover:bg-orange-600" disabled={busy || !rule.employeeId || rule.value < 0 || (needsProduct && !rule.productId)} onClick={submitRule}>
              <Plus className="mr-2 h-4 w-4" />
              Criar regra
            </Button>
            <p className="text-xs text-slate-500">Vendas concluídas entram automaticamente na prévia. Taxas de serviço das mesas continuam sendo importadas pelo valor líquido apurado.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BadgePercent className="h-5 w-5 text-orange-500" />
              Crédito manual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <EmployeeSelect employees={employees} value={commission.employeeId} onChange={(value) => setCommission({ ...commission, employeeId: value })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tipo">
                <Select
                  value={commission.type}
                  onValueChange={(value) =>
                    setCommission({
                      ...commission,
                      type: value as 'manual' | 'bonus',
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bonus">Bonificação</SelectItem>
                    <SelectItem value="manual">Comissão manual</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Valor">
                <CurrencyInput value={commission.amount} onValueChange={(value) => setCommission({ ...commission, amount: value })} />
              </Field>
            </div>
            <Field label="Competência">
              <Input type="date" value={commission.date} onChange={(e) => setCommission({ ...commission, date: e.target.value })} />
            </Field>
            <Field label="Descrição">
              <Input value={commission.description} onChange={(e) => setCommission({ ...commission, description: e.target.value })} />
            </Field>
            <Button className="w-full" disabled={busy || !commission.employeeId || commission.amount <= 0} onClick={() => onCommission(commission)}>
              <Plus className="mr-2 h-4 w-4" />
              Registrar crédito
            </Button>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Regras cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rules.map((item) => (
              <div key={item.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <strong className="block">{employeeNames.get(item.employee_id) || 'Colaborador'}</strong>
                    <span className="text-sm text-slate-500">{ruleLabels[item.rule_type]}</span>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>{item.active ? 'Ativa' : 'Inativa'}</span>
                </div>
                <p className="mt-3 text-lg font-bold text-emerald-800">
                  {item.percentage !== null
                    ? `${item.percentage}%`
                    : `R$ ${Number(item.fixed_amount || 0)
                        .toFixed(2)
                        .replace('.', ',')}`}
                </p>
                {item.product_id && <p className="text-xs text-slate-500">Produto: {productNames.get(item.product_id) || item.product_id}</p>}
                <Button
                  className="mt-3"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    onRule({
                      ruleId: item.id,
                      employeeId: item.employee_id,
                      ruleType: item.rule_type,
                      percentage: item.percentage,
                      fixedAmount: item.fixed_amount,
                      productId: item.product_id,
                      active: !item.active,
                      startsAt: item.starts_at,
                      endsAt: item.ends_at,
                    })
                  }
                >
                  {item.active ? 'Desativar' : 'Reativar'}
                </Button>
              </div>
            ))}
            {!rules.length && <p className="text-sm text-slate-500">Nenhuma regra automática cadastrada.</p>}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Banknote className="h-5 w-5 text-emerald-700" />
            Registrar adiantamento
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <EmployeeSelect employees={employees} value={advance.employeeId} onChange={(value) => setAdvance({ ...advance, employeeId: value })} />
          <Field label="Valor">
            <CurrencyInput value={advance.amount} onValueChange={(value) => setAdvance({ ...advance, amount: value })} />
          </Field>
          <Field label="Data">
            <Input type="date" value={advance.date} onChange={(e) => setAdvance({ ...advance, date: e.target.value })} />
          </Field>
          <Field label="Conta financeira">
            <Select value={advance.accountId} onValueChange={(value) => setAdvance({ ...advance, accountId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Banco / Caixa" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button className="self-end bg-emerald-700 hover:bg-emerald-800" disabled={busy || !advance.employeeId || !advance.accountId || advance.amount <= 0} onClick={() => onAdvance(advance)}>
            Registrar saída
          </Button>
          <div className="lg:col-span-5 grid gap-3 sm:grid-cols-2">
            <Field label="Forma">
              <Select value={advance.method} onValueChange={(value) => setAdvance({ ...advance, method: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['PIX', 'Dinheiro', 'Transferência', 'Outro'].map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Observação">
              <Input value={advance.note} onChange={(e) => setAdvance({ ...advance, note: e.target.value })} />
            </Field>
          </div>
          <p className="text-xs text-slate-500 lg:col-span-5">O adiantamento gera movimentação financeira real e entra como desconto na prévia. Não vira venda em Contas a Receber.</p>
        </CardContent>
      </Card>
    </div>
  );
}
function EmployeeSelect({ employees, value, onChange }: { employees: TeamEmployee[]; value: string; onChange: (value: string) => void }) {
  return (
    <Field label="Colaborador">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {employees
            .filter((item) => item.employment_status === 'active')
            .map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.full_name}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}
