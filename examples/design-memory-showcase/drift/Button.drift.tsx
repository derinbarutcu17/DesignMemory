export function Button({ children }: { children: React.ReactNode }) {
  return (
    <button
      className="bg-primary px-4 py-2 rounded-[14px]"
      style={{ color: '#ff0000' }}
    >
      {children}
    </button>
  );
}
