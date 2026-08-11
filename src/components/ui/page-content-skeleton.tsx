type PageContentSkeletonProps = { compact?: boolean };

export default function PageContentSkeleton({ compact = false }: PageContentSkeletonProps) {
  return (
    <div className="animate-pulse space-y-4" role="status" aria-label="Carregando conteúdo">
      <div className={`${compact ? 'h-20' : 'h-28'} rounded-3xl bg-emerald-950/8`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 rounded-2xl bg-slate-200/70" />)}
      </div>
      <div className={`${compact ? 'h-48' : 'h-72'} rounded-3xl bg-slate-200/60`} />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
