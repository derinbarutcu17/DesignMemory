export function Button({ children }: { children: React.ReactNode }) {
  return (
    <button className="bg-primary px-4 py-2 rounded-lg hover:bg-primary disabled:opacity-50">
      {children}
    </button>
  );
}
