'use client'

import { useState } from 'react'
import { Check, Copy, ExternalLink, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PARTNER_SITES } from '../data'
import { REFERRAL_LINK, TASKS, VISIT_TARGET } from '../details'
import { formatAC } from '../points-context'
import { useTask } from '../use-entries'

const VISIT_SITES = PARTNER_SITES.slice(0, 5)

const primaryBtn =
  'flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90 disabled:bg-secondary disabled:text-muted-foreground'

export function TaskAction({ slug }: { slug: string }) {
  const task = TASKS.find((t) => t.slug === slug) ?? TASKS[0]
  const { done, complete, canComplete, visited, visit, isVisited } = useTask(task)
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(REFERRAL_LINK)
    } catch {}
    setCopied(true)
  }

  return (
    <div className="panel-gold flex flex-col gap-4 rounded-2xl p-5">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Görev ödülü</span>
        <span className="font-display text-4xl font-bold text-primary tabular-nums">+{formatAC(task.reward)} <span className="text-lg">AC</span></span>
      </div>

      {task.kind === 'visit' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">İlerleme</span>
            <span className="font-semibold text-foreground tabular-nums">
              {Math.min(visited, VISIT_TARGET)} / {VISIT_TARGET}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-background" aria-hidden="true">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(Math.min(visited, VISIT_TARGET) / VISIT_TARGET) * 100}%` }} />
          </div>
          <ul className="flex flex-col gap-1.5">
            {VISIT_SITES.map((s) => {
              const v = isVisited(s.id)
              return (
                <li key={s.id} className="flex items-center gap-3 rounded-lg bg-background px-3 py-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/15 font-display text-xs font-bold text-primary">
                    {s.initials}
                  </span>
                  <span className="flex-1 truncate text-sm font-medium text-foreground">{s.name}</span>
                  <button
                    type="button"
                    onClick={() => visit(s.id)}
                    disabled={v || done}
                    className={cn(
                      'flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-bold',
                      v ? 'text-live' : 'border border-primary/40 text-primary hover:bg-primary/10',
                    )}
                  >
                    {v ? <Check className="size-3.5" aria-hidden="true" /> : <ExternalLink className="size-3.5" aria-hidden="true" />}
                    {v ? 'Ziyaret edildi' : 'Ziyaret et'}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {task.kind === 'invite' && (
        <div className="flex flex-col gap-2">
          <label htmlFor="ref-link" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Davet linkin
          </label>
          <div className="flex gap-2">
            <input
              id="ref-link"
              readOnly
              value={REFERRAL_LINK}
              className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            />
            <button
              type="button"
              onClick={copy}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-primary/40 px-3 text-xs font-bold text-primary hover:bg-primary/10"
            >
              {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
              {copied ? 'Kopyalandı' : 'Kopyala'}
            </button>
          </div>
        </div>
      )}

      {done ? (
        <div className="flex h-12 items-center justify-center gap-2 rounded-xl bg-live/15 text-sm font-bold text-live">
          <Check className="size-4" aria-hidden="true" />
          Tamamlandı · +{formatAC(task.reward)} AC eklendi
        </div>
      ) : task.kind === 'link' && task.href ? (
        <a href={task.href} target="_blank" rel="noopener noreferrer" onClick={complete} className={cn(primaryBtn, 'bg-accent text-accent-foreground')}>
          <Send className="size-4" aria-hidden="true" />
          Kanala katıl
        </a>
      ) : (
        <button
          type="button"
          onClick={complete}
          disabled={!canComplete || (task.kind === 'invite' && !copied)}
          className={primaryBtn}
        >
          {task.kind === 'verify' ? 'Doğrulamayı başlat' : 'Ödülü al'}
        </button>
      )}

      {!done && task.kind === 'visit' && !canComplete && (
        <p className="text-center text-xs text-muted-foreground">{VISIT_TARGET - visited} ziyaret daha yap, ödül açılsın.</p>
      )}
      {!done && task.kind === 'invite' && !copied && (
        <p className="text-center text-xs text-muted-foreground">Önce davet linkini kopyala.</p>
      )}

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border text-center">
        <div className="bg-background px-3 py-2">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Tekrar</dt>
          <dd className="text-sm font-semibold text-foreground">{task.frequency}</dd>
        </div>
        <div className="bg-background px-3 py-2">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Süre</dt>
          <dd className="text-sm font-semibold text-foreground">~{task.duration}</dd>
        </div>
      </dl>
    </div>
  )
}
