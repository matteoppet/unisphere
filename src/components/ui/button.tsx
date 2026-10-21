import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-xs border-0 font-medium',
        destructive:
          'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-xs border-0',
        outline:
          'border border-[#ecedef] dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[#2d2f34] dark:text-zinc-200 hover:bg-[#f9efe4] dark:hover:bg-zinc-800 hover:text-[#2d2f34] dark:hover:text-zinc-100',
        secondary:
          'bg-[#f9efe4] dark:bg-zinc-800 text-[#2d2f34] dark:text-zinc-200 hover:bg-[#ebdccf] dark:hover:bg-zinc-700 border-0',
        ghost:
          'text-[#3f434a] hover:bg-[#f9efe4]/80 hover:text-[#2d2f34] dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
        link:
          'text-indigo-600 dark:text-indigo-400 underline-offset-4 hover:underline',
        compact:
          'border border-[#ecedef] dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[#2d2f34] dark:text-zinc-200 hover:bg-[#f9efe4] dark:hover:bg-zinc-800',
        matte:
          'border border-[#ecedef] dark:border-zinc-700 bg-[#fdf9f4] dark:bg-zinc-900 text-[#2d2f34] dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800',
        accent:
          'bg-[#2d2f34] text-white hover:bg-[#3f434a] dark:bg-zinc-200 dark:text-zinc-900 transition-colors',
      },
      size: {
        default: 'h-8 px-3.5 py-1.5 text-xs rounded-md',
        sm: 'h-7 px-2.5 py-1 text-[11px] rounded-md',
        lg: 'h-9 px-4.5 py-2 text-xs rounded-md',
        icon: 'h-7 w-7 p-0 rounded-md',
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
