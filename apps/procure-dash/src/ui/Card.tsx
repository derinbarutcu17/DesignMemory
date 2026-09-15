import type { ReactNode } from 'react';
import { cn } from './cn';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('rounded-lg border border-border bg-surface p-4 shadow-card transition-shadow hover:shadow-raised', className)}>{children}</section>;
}
