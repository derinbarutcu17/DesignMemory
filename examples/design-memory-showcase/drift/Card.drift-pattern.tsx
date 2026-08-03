export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-lg p-4" style={{ border: '1px solid #dc2626' }}>
      <h3 className="text-lg text-text">{title}</h3>
      {children}
    </div>
  );
}
