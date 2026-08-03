export function Button({ children }: { children: React.ReactNode }) {
  return (
    <button className="bg-primary rounded-lg p-[16px] text-[14px]">
      {children}
    </button>
  );
}
