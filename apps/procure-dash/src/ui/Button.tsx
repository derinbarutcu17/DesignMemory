import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  children: ReactNode;
};

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-primary text-surface hover:bg-primary-hover',
  secondary: 'border border-border bg-surface text-text hover:bg-surface-raised',
  ghost: 'text-text-muted hover:bg-surface-raised hover:text-text',
  danger: 'bg-danger text-surface hover:opacity-90',
};

const SIZES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
};

export function Button({ variant = 'primary', size = 'md', className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
