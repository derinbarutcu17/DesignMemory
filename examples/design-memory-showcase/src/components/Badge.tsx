export function Badge({ children, variant = 'primary' }: { children: React.ReactNode; variant?: 'primary' | 'neutral' }) {
  const classes = variant === 'primary' ? 'bg-primary text-surface' : 'bg-surface text-text border';
  return <span className={`${classes} rounded-full text-sm px-3 py-1`}>{children}</span>;
}
