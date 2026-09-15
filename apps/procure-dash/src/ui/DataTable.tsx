import type { ReactNode, ThHTMLAttributes } from 'react';
import { cn } from './cn';

export type TableColumn = {
  id: string;
  label: string;
  align?: 'left' | 'right';
};

export function DataToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-3', className)}>{children}</div>;
}

export function DataTable({ columns, children, className }: { columns: TableColumn[]; children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-md border border-border bg-surface', className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={cn(
                  'px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted',
                  column.align === 'right' && 'text-right',
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export function DataRow({
  children,
  onClick,
  selected,
}: {
  children: ReactNode;
  onClick?: () => void;
  selected?: boolean;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'transition-colors hover:bg-surface-raised',
        onClick && 'cursor-pointer',
        selected && 'bg-surface-raised',
      )}
    >
      {children}
    </tr>
  );
}

export function DataCell({ children, align = 'left', className, ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' }) {
  return (
    <td className={cn('px-4 py-3 text-text', align === 'right' && 'text-right tabular-nums', className)} {...rest}>
      {children}
    </td>
  );
}

export function DataCellMuted({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) {
  return <td className={cn('px-4 py-3 text-text-muted', align === 'right' && 'text-right tabular-nums')}>{children}</td>;
}
