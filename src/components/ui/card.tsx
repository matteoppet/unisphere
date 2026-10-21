import * as React from 'react';
import { cn } from '../../lib/utils';

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { hoverable?: boolean }
>(({ className, hoverable = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-md border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/95 text-zinc-900 dark:text-zinc-100 shadow-2xs overflow-hidden transition-all duration-200',
      hoverable && 'hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-xs hover:-translate-y-[1px]',
      className
    )}
    {...props}
  />
));
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'bg-slate-50/70 dark:bg-zinc-900/80 border-b border-zinc-200/80 dark:border-zinc-800 px-3 py-2 sm:px-3.5 sm:py-2.5 flex items-center justify-between',
      className
    )}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'font-bold text-xs sm:text-[13px] text-zinc-900 dark:text-zinc-100 tracking-tight leading-tight flex items-center gap-1.5',
      className
    )}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-[10.5px] text-zinc-500 dark:text-zinc-400 font-sans leading-normal', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('p-3 sm:p-3.5 text-xs text-zinc-800 dark:text-zinc-200', className)}
    {...props}
  />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex items-center justify-between px-3 py-2 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-600 dark:text-zinc-400',
      className
    )}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
};
