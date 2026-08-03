export function Button({ children }: { children: React.ReactNode }) {
  return (
    <button
      className="bg-[#ff0000] rounded-[20px]"
      style={{ color: '#ff0000' }}
    >
      {children}
    </button>
  );
}
