import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

type WaiterEmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
};

export function WaiterEmptyState({ icon, title, description, action }: WaiterEmptyStateProps) {
  return (
    <Card className="rounded-[28px] border border-[#DDE7D9] bg-white shadow-sm">
      <CardContent className="flex flex-col items-center justify-center gap-4 px-6 py-14 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EDF4E8] text-[#0B4A36]">
          {icon}
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-[#082F23]">{title}</h3>
          <p className="max-w-xl text-sm leading-6 text-slate-500">{description}</p>
        </div>
        {action ? <div>{action}</div> : null}
      </CardContent>
    </Card>
  );
}
