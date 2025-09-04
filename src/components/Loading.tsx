export default function Loading({ className }: { className?: string }) {
  return (
    <div className={`flex justify-center items-center ${className}`}>
      <div className="w-10 h-10 border-4 border-primary-focus border-b-transparent border-r-transparent border-l-transparent rounded-full animate-spin"></div>
    </div>
  );
}
