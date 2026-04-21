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
    <Card className={cn('rounded-[22px] border border-white/10 bg-white/[0.08] text-white shadow-none', className)}>
      <CardContent className="space-y-2 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">{label}</span>
          {icon ? <span className="text-[#A4D65E]">{icon}</span> : null}
        </div>
        <div className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{value}</div>
        {hint ? <p className="text-[11px] leading-4 text-white/60 sm:text-sm sm:leading-5">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
