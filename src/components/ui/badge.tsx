import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md border font-medium tracking-tight transition-all duration-150 select-none focus:outline-none focus:ring-1 focus:ring-[#6366F1]',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[#6366F1] text-white hover:bg-[#4F46E5]',
        secondary:
          'border-[#ecedef] dark:border-zinc-800 bg-[#f9efe4] dark:bg-zinc-800 text-[#2d2f34] dark:text-zinc-200',
        destructive:
          'border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300',
        outline:
          'border-[#ecedef] dark:border-zinc-800 text-[#2d2f34] dark:text-zinc-300 bg-white dark:bg-zinc-900',
        active:
          'border-[#ecedef] dark:border-zinc-700 bg-[#f9efe4] dark:bg-zinc-800 text-[#2d2f34] dark:text-zinc-200',
        passed:
          'border-[#ecedef] dark:border-zinc-700 bg-[#f9efe4] dark:bg-zinc-800 text-[#2d2f34] dark:text-zinc-200',
        planned:
          'border-[#ecedef] dark:border-zinc-700 bg-[#f9efe4] dark:bg-zinc-800 text-[#2d2f34] dark:text-zinc-200',
        matte:
          'border-[#ecedef] dark:border-zinc-700 bg-[#f9efe4] dark:bg-zinc-800 text-[#2d2f34] dark:text-zinc-200',
        shimmer:
          'relative border-[#6366F1]/40 bg-[#f9efe4] text-[#6366F1] animate-pulse',
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
