import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md border font-semibold tracking-tight transition-all duration-150 select-none focus:outline-none focus:ring-1 focus:ring-indigo-500',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-indigo-600 text-white shadow-2xs hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500',
        secondary:
          'border-zinc-200/90 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-750',
        destructive:
          'border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 shadow-2xs',
        outline:
          'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900/90 shadow-2xs',
        active:
          'border-blue-300/80 dark:border-blue-800/80 bg-blue-50/90 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 shadow-2xs ring-1 ring-blue-500/20',
        passed:
          'border-emerald-300/80 dark:border-emerald-800/80 bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 shadow-2xs ring-1 ring-emerald-500/20',
        planned:
          'border-amber-300/80 dark:border-amber-800/80 bg-amber-50/90 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 shadow-2xs ring-1 ring-amber-500/20',
        matte:
          'border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200',
        shimmer:
          'relative border-indigo-400/50 dark:border-indigo-500/50 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 shadow-xs animate-pulse',
      },
      size: {
        default: 'px-2 py-0.5 text-[10.5px]',
        sm: 'px-1.5 py-0.5 text-[9.5px]',
        lg: 'px-2.5 py-1 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
