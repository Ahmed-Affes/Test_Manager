import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium tracking-tight border transition-colors select-none',
  {
    variants: {
      variant: {
        default:
          'border-zinc-200 bg-zinc-100 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-100',
        secondary:
          'border-transparent bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100',
        destructive:
          'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400 dark:border-rose-500/30',
        outline:
          'border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300',
        success:
          'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 dark:border-emerald-500/30',
        warning:
          'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:border-amber-500/30',
        info:
          'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400 dark:border-blue-500/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  dotColor?: string;
}

function Badge({ className, variant, dot, dotColor, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            'mr-1.5 inline-block h-1.5 w-1.5 rounded-full',
            dotColor || 'bg-current'
          )}
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
