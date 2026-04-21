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
    <Card className="rounded-[24px] border border-[#DDE7D9] bg-white shadow-sm">
      <CardContent className="flex flex-col items-center justify-center gap-4 px-5 py-10 text-center sm:px-6 sm:py-14">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EDF4E8] text-[#0B4A36] sm:h-16 sm:w-16">
          {icon}
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-[#082F23] sm:text-xl">{title}</h3>
          <p className="max-w-xl text-sm leading-6 text-slate-500">{description}</p>
        </div>
        {action ? <div>{action}</div> : null}
      </CardContent>
    </Card>
  );
}
