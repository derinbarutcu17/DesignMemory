export function SupplierRiskNote({ note, owner }: { note: string; owner: string }) {
  return (
    <aside className="p-[7px]">
      <p className="text-[#334155]">{note}</p>
      <p className="mt-1 text-xs text-text-muted">Risk owner: {owner}</p>
    </aside>
  );
}
