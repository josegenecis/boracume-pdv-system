import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type WaiterMetricCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  className?: string;
};

export function WaiterMetricCard({ label, value, hint, icon, className }: WaiterMetricCardProps) {
  return (
    <Card className={cn('rounded-[28px] border border-white/10 bg-white/[0.06] text-white shadow-none', className)}>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">{label}</span>
          {icon ? <span className="text-[#A4D65E]">{icon}</span> : null}
        </div>
        <div className="text-3xl font-semibold tracking-tight text-white">{value}</div>
        {hint ? <p className="text-sm leading-5 text-white/60">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
