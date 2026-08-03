export function Button({ children }: { children: React.ReactNode }) {
  return (
    <button className="bg-primary px-4 py-2 rounded-[8px] p-[16px] hover:bg-primary">
      {children}
    </button>
  );
}
