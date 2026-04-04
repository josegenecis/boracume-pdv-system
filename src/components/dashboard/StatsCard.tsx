
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  className?: string;
  trend?: {
    value: number;
    positive: boolean;
  };
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  description,
  icon,
  trend,
  className,
}) => {
  return (
    <Card className={`w-full min-w-0 overflow-hidden rounded-[26px] border border-white/70 bg-white/90 shadow-[0_24px_60px_-36px_rgba(0,50,35,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_30px_70px_-34px_rgba(0,50,35,0.34)] dark:border-white/10 dark:bg-[#101a16]/95 dark:shadow-[0_26px_60px_-36px_rgba(0,0,0,0.8)] border-t-4 ${className || 'border-t-boracume-orange'}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="truncate pr-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          {title}
        </CardTitle>
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-[#FFF1E6] text-boracume-orange dark:bg-[#FF6400]/12">
          {React.cloneElement(icon as React.ReactElement, { 
            size: 20,
            className: 'text-boracume-orange'
          })}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="truncate text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</div>
        {description && (
          <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        )}
        {trend && (
          <div className="mt-3 flex items-center">
            <span className={`text-xs ${trend.positive ? 'text-boracume-green' : 'text-red-500'}`}>
              {trend.positive ? '+' : ''}{trend.value}%
            </span>
            <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">do que ontem</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StatsCard;
