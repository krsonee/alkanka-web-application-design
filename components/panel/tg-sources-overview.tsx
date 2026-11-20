'use client'

import { useState } from 'react'
import { ArrowRight, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSiblingTabs } from '@/components/panel/telegram-tabs'
import { Card, btnGhost, input } from '@/components/panel/tg-hub-ui'

export type SourceRow = {
  key: string
  /** Tab of the bot that reads this source. */
  tab: string
  bot: string
  name: string
  chat: string
  active: boolean
  buttons: number
  problem: string | null
  detail: string
}

/**
 * Every chat a bot reads posts from, in one list. Sources are set on their bot's own page;
 * this is where to see them side by side and jump to the right one.
 */
export function SourcesOverview({ rows }: { rows: SourceRow[] }) {
  const tabs = useSiblingTabs()
  const [query, setQuery] = useState('')
  const [bot, setBot] = useState('')
  const bots = Array.from(new Set(rows.map((r) => r.bot)))
  const needle = query.trim().toLocaleLowerCase('tr')
  const shown = rows.filter((r) => (!bot || r.bot === bot) && (!needle || `${r.name} ${r.chat}`.toLocaleLowerCase('tr').includes(needle)))

  return (
    <Card title="Kaynaklar" hint="Botların post okuduğu bütün kanal ve gruplar. Bir kaynağı eklemek ya da kurallarını değiştirmek için botunun sayfasını aç.">
      {rows.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Henüz kaynak eklenmemiş. Kaynaklar botların kendi sayfasından eklenir: kanal aktarımı için Botlar → Bağlantı &amp; Cron, özel oranlar için Botlar → Özel
          Oran Botu, sponsor grupları için Botlar → Post Paylaşım.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Kaynaklarda ara</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input className={cn(input, 'pl-9')} value={query} placeholder="Marka ya da kanal ara" onChange={(e) => setQuery(e.target.value)} />
            </label>
            {bots.length > 1 && (
              <label className="sm:w-56">
                <span className="sr-only">Bota göre süz</span>
                <select className={input} value={bot} onChange={(e) => setBot(e.target.value)}>
                  <option value="">Bütün botlar ({rows.length})</option>
                  {bots.map((b) => (
                    <option key={b} value={b}>
                      {b} ({rows.filter((r) => r.bot === b).length})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aramana uyan kaynak yok.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {shown.map((r) => (
                <li key={r.key} data-find={`${r.name} ${r.chat}`} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{r.name || r.chat}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', r.problem ? 'bg-destructive/15 text-destructive' : r.active ? 'bg-emerald/15 text-emerald' : 'bg-secondary text-muted-foreground')}>
                        {r.problem ? 'Hata var' : r.active ? 'Açık' : 'Kapalı'}
                      </span>
                    </div>
                    <p className="break-all text-xs text-muted-foreground">
                      {r.bot} · {r.chat}
                      {r.detail ? ` · ${r.detail}` : ''}
                      {r.buttons ? ` · ${r.buttons} buton` : ''}
                    </p>
                    {r.problem && <p className="text-xs leading-relaxed text-destructive">{r.problem}</p>}
                  </div>
                  {tabs?.tabs.some((t) => t.id === r.tab) && (
                    <button type="button" className={cn(btnGhost, 'shrink-0 gap-1.5')} onClick={() => tabs.open(r.tab)}>
                      Botun sayfasını aç
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}
