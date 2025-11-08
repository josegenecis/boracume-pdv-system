
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
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
}) => {
  return (
    <Card className="w-full min-w-0">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground truncate pr-2">
          {title}
        </CardTitle>
        <div className="h-8 w-8 bg-boracume-orange/10 rounded-md flex items-center justify-center flex-shrink-0">
          {React.cloneElement(icon as React.ReactElement, { 
            size: 20,
            className: 'text-boracume-orange'
          })}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-2xl font-bold truncate">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{description}</p>
        )}
        {trend && (
          <div className="flex items-center mt-2">
            <span className={`text-xs ${trend.positive ? 'text-boracume-green' : 'text-red-500'}`}>
              {trend.positive ? '+' : ''}{trend.value}%
            </span>
            <span className="text-xs text-muted-foreground ml-1">do que ontem</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StatsCard;
