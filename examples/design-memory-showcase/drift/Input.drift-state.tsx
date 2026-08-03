export function Input({ label }: { label: string }) {
  // Drift: no focus/disabled state handling at all.
  return (
    <label className="block">
      <span className="text-sm text-text">{label}</span>
      <input className="mt-1 w-full bg-surface rounded-lg border px-3 py-2" />
    </label>
  );
}
