import { BookOpen, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

export type GuideStep = { title: string; body: ReactNode }

export const guideCode = 'rounded bg-background px-1.5 py-0.5 font-mono text-xs text-foreground'

export function FeatureGuide({ title, subtitle, steps }: { title: string; subtitle: string; steps: GuideStep[] }) {
  return (
    <details className="group rounded-2xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <BookOpen className="size-5 text-primary" aria-hidden />
          <span className="flex flex-col">
            <span className="font-display text-lg font-bold uppercase text-foreground">{title}</span>
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          </span>
        </span>
        <ChevronDown className="size-5 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ol className="flex flex-col gap-2 px-5 pb-5">
        {steps.map((step, i) => (
          <li key={step.title}>
            <details className="group/step rounded-xl bg-secondary">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                <span className="flex-1 text-sm font-semibold text-foreground">{step.title}</span>
                <ChevronDown className="size-4 text-muted-foreground transition-transform group-open/step:rotate-180" aria-hidden />
              </summary>
              <div className="px-3 pb-4 pl-13 text-sm leading-relaxed text-foreground">{step.body}</div>
            </details>
          </li>
        ))}
      </ol>
    </details>
  )
}
