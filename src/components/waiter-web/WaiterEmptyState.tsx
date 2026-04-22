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
    <Card className="rounded-[22px] border border-[#DDE7D9] bg-white shadow-sm">
      <CardContent className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center sm:px-6 sm:py-14">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EDF4E8] text-[#0B4A36] sm:h-16 sm:w-16">
          {icon}
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-[#082F23] sm:text-xl">{title}</h3>
          <p className="max-w-xl text-[13px] leading-5 text-slate-500 sm:text-sm sm:leading-6">{description}</p>
        </div>
        {action ? <div>{action}</div> : null}
      </CardContent>
    </Card>
  );
}
