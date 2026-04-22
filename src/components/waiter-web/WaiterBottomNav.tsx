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
        'fixed inset-x-2 bottom-2 z-40 rounded-[20px] border border-[#E4E9E0] bg-[#FFFDF7]/95 p-1 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.55)] backdrop-blur md:hidden',
        className,
      )}
    >
      <div className="grid grid-cols-4 gap-1">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            className={cn(
              'flex min-h-[50px] flex-col items-center justify-center gap-0.5 rounded-[16px] px-1.5 py-1 text-center transition',
              item.active ? 'bg-[#FFF1E6] text-[#FF6400]' : 'text-[#0B4A36]',
            )}
          >
            <span className="flex h-4 items-center justify-center [&_svg]:h-4 [&_svg]:w-4">{item.icon}</span>
            <span className="text-[9px] font-medium leading-[0.875rem]">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
