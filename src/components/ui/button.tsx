import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-indigo-600 text-white shadow-2xs hover:bg-indigo-700 active:bg-indigo-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 border border-indigo-700/30 dark:border-indigo-400/30 shadow-indigo-500/10 hover:shadow-indigo-500/25',
        destructive:
          'bg-rose-600 text-white shadow-2xs hover:bg-rose-700 active:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500 border border-rose-700/30',
        outline:
          'border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 text-zinc-700 dark:text-zinc-200 shadow-2xs hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100',
        secondary:
          'bg-zinc-100 text-zinc-800 hover:bg-zinc-200 active:bg-zinc-300 dark:bg-zinc-800/90 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 border border-transparent dark:border-zinc-700/50',
        ghost:
          'text-zinc-700 hover:bg-zinc-100/80 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
        link:
          'text-indigo-600 underline-offset-4 hover:underline dark:text-indigo-400',
        compact:
          'border border-zinc-200/90 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 text-zinc-700 dark:text-zinc-200 shadow-2xs hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 active:bg-zinc-100 dark:active:bg-zinc-800',
        matte:
          'border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 shadow-2xs',
        accent:
          'bg-zinc-800 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-900 shadow-2xs hover:bg-zinc-700 dark:hover:bg-zinc-300 border border-zinc-700 dark:border-zinc-300 transition-colors',
      },
      size: {
        default: 'h-8 px-3 py-1.5 text-xs',
        sm: 'h-7 px-2.5 py-1 text-[11px] rounded-md',
        lg: 'h-9 px-4 py-2 text-xs',
        icon: 'h-7 w-7 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
