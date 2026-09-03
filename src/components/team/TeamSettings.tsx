import { useEffect, useState } from 'react';
import { Save, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { AttendanceRules } from '@/lib/team/types';

export function TeamSettings({ rules, saving, onSave }: { rules: AttendanceRules; saving:boolean; onSave:(rules:AttendanceRules)=>Promise<void> }) {
  const [draft,setDraft]=useState(rules);
  useEffect(()=>setDraft(rules),[rules]);
  return <div className="grid gap-5 lg:grid-cols-[1fr_.7fr]"><Card><CardHeader><CardTitle>Regras de apuração</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 sm:grid-cols-3"><Field label="Tolerância de extra (min)"><Input type="number" min={0} value={draft.overtimeToleranceMinutes} onChange={(e)=>setDraft({...draft,overtimeToleranceMinutes:Number(e.target.value)})} /></Field><Field label="Tolerância de atraso (min)"><Input type="number" min={0} value={draft.lateToleranceMinutes} onChange={(e)=>setDraft({...draft,lateToleranceMinutes:Number(e.target.value)})} /></Field><Field label="Multiplicador hora extra"><Input type="number" min={0} step="0.1" value={draft.overtimeHourMultiplier} onChange={(e)=>setDraft({...draft,overtimeHourMultiplier:Number(e.target.value)})} /></Field></div><Toggle label="Descontar minutos de atraso na prévia" checked={draft.deductLateMinutes} onChange={(value)=>setDraft({...draft,deductLateMinutes:value})} /><Toggle label="Descontar faltas não justificadas na prévia" checked={draft.deductUnjustifiedAbsences} onChange={(value)=>setDraft({...draft,deductUnjustifiedAbsences:value})} /><Button onClick={()=>onSave(draft)} disabled={saving} className="bg-emerald-700 hover:bg-emerald-800"><Save className="mr-2 h-4 w-4" />Salvar parâmetros</Button></CardContent></Card><Card className="border-amber-200 bg-amber-50"><CardHeader><CardTitle className="flex items-center gap-2 text-amber-950"><ShieldAlert className="h-5 w-5" />Limite do módulo</CardTitle></CardHeader><CardContent className="text-sm leading-6 text-amber-900">INSS, IRRF, FGTS, DSR, adicional noturno, férias, 13º e rescisão não são calculados automaticamente. Esta área é uma prévia gerencial parametrizável até homologação contábil.</CardContent></Card></div>;
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="space-y-1.5"><Label>{label}</Label>{children}</label>}
function Toggle({label,checked,onChange}:{label:string;checked:boolean;onChange:(value:boolean)=>void}){return <label className="flex items-center justify-between rounded-xl border p-3 text-sm"><span>{label}</span><Switch checked={checked} onCheckedChange={onChange} /></label>}
