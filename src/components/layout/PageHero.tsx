import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface PageHeroProps {
  title: string;
  description: string;
  icon: LucideIcon;
  eyebrow?: string;
  actions?: ReactNode;
}

export function PageHero({ title, description, icon: Icon, eyebrow, actions }: PageHeroProps) {
  return (
    <section className="overflow-hidden rounded-[28px] border-0 bg-gradient-to-br from-[#003223] via-[#07573d] to-[#087A55] text-white shadow-[0_26px_60px_-34px_rgba(0,50,35,0.55)]">
      <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/15 shadow-sm backdrop-blur">
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">{eyebrow}</p>}
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-white/85 sm:text-base">{description}</p>
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </section>
  );
}
