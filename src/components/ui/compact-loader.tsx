import React from 'react';

type CompactLoaderProps = {
  label?: string;
  className?: string;
};

export function CompactLoader({ label, className = '' }: CompactLoaderProps) {
  return (
    <div className={`flex items-center justify-center gap-2.5 text-sm text-slate-500 ${className}`} role="status" aria-live="polite">
      <span className="inline-flex h-6 items-center gap-1 rounded-full border border-emerald-900/10 bg-white px-2 shadow-sm">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#087A55] [animation-delay:-0.24s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8CC850] [animation-delay:-0.12s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#FF6400]" />
      </span>
      {label ? <span>{label}</span> : <span className="sr-only">Carregando</span>}
    </div>
  );
}

export default CompactLoader;
