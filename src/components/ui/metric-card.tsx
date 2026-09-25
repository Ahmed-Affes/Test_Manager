import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from './card';

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  description?: string;
  icon?: React.ElementType | React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info';
  className?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  description,
  icon,
  trend,
  variant = 'default',
  className,
}: MetricCardProps) {
  const variantStyles = {
    default: 'text-zinc-900 dark:text-zinc-100',
    success: 'text-emerald-600 dark:text-emerald-400',
    danger: 'text-rose-600 dark:text-rose-400',
    warning: 'text-amber-600 dark:text-amber-400',
    info: 'text-blue-600 dark:text-blue-400',
  };

  const subText = subtitle || description;

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      return (
        <div className="flex h-7 w-7 items-center justify-center rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
          {icon}
        </div>
      );
    }
    const IconComponent = icon as React.ElementType;
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
        <IconComponent className="h-3.5 w-3.5" />
      </div>
    );
  };

  return (
    <Card className={cn('overflow-hidden relative', className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {title}
          </span>
          {renderIcon()}
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <span
            className={cn(
              'text-2xl font-bold tracking-tight font-mono',
              variantStyles[variant]
            )}
          >
            {value}
          </span>
          {trend && (
            <span
              className={cn(
                'text-[11px] font-medium',
                trend.isPositive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              )}
            >
              {trend.value}
            </span>
          )}
        </div>

        {subText && (
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1">
            {subText}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
