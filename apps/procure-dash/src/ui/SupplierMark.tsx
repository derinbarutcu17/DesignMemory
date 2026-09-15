import { initials } from '../data/format';

const VENDOR_TINTS: Record<string, string> = {
  steel: 'bg-[#475569] text-[#f8fafc]',
  logistics: 'bg-[#0f766e] text-[#ecfeff]',
  electronics: 'bg-[#4338ca] text-[#eef2ff]',
  mro: 'bg-[#92400e] text-[#fffbeb]',
  packaging: 'bg-[#3f6212] text-[#f7fee7]',
  energy: 'bg-[#9f1239] text-[#fff1f2]',
};

export function SupplierMark({ name, category }: { name: string; category: string }) {
  const key = category.split(' ')[0].toLowerCase();
  const tint = VENDOR_TINTS[key] ?? 'bg-surface-raised text-text-muted';
  return (
    <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${tint}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
