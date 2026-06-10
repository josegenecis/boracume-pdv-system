import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type WaiterBottomNavItem = {
  key: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
  onClick: () => void;
};

type WaiterBottomNavProps = {
  items: WaiterBottomNavItem[];
  className?: string;
};

export function WaiterBottomNav({ items, className }: WaiterBottomNavProps) {
  return (
    <div
      className={cn(
        'fixed inset-x-2 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-40 max-w-[430px] rounded-[20px] border border-[#E4E9E0] bg-[#FFFDF7]/95 p-1 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.55)] backdrop-blur md:hidden min-[446px]:left-1/2 min-[446px]:right-auto min-[446px]:w-[430px] min-[446px]:-translate-x-1/2',
        className,
      )}
    >
      <div className="grid min-w-0 grid-cols-4 gap-1">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            className={cn(
              'flex min-h-[50px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[16px] px-1 py-1 text-center transition',
              item.active ? 'bg-[#FFF1E6] text-[#FF6400]' : 'text-[#0B4A36]',
            )}
          >
            <span className="flex h-4 items-center justify-center [&_svg]:h-4 [&_svg]:w-4">{item.icon}</span>
            <span className="max-w-full truncate text-[9px] font-medium leading-[0.875rem]">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
