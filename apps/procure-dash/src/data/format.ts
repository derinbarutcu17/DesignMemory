const eur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const compact = new Intl.NumberFormat('de-DE', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatEur(value: number) {
  return eur.format(value);
}

export function formatEurCompact(value: number) {
  return `${compact.format(value)} €`;
}

export function formatPct(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
