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
        'fixed inset-x-3 bottom-3 z-40 rounded-[28px] border border-[#E4E9E0] bg-[#FFFDF7]/95 p-2 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.55)] backdrop-blur md:hidden',
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
              'flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-[20px] px-2 py-2 text-center transition',
              item.active ? 'bg-[#FFF1E6] text-[#FF6400]' : 'text-[#0B4A36]',
            )}
          >
            <span className="flex h-5 items-center justify-center">{item.icon}</span>
            <span className="text-[11px] font-medium leading-4">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
