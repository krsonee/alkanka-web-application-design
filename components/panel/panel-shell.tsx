'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { logout } from '@/app/panel/actions'

export type PanelSection = {
  id: string
  group: string
  label: string
  badge?: number
  body: ReactNode
}

type SiteRow = { active?: boolean; clicks?: number }

export function PanelShell({ sections }: { sections: PanelSection[] }) {
  const router = useRouter()
  const [active, setActive] = useState(sections[0]?.id ?? '')
  const [stats, setStats] = useState({ total: 0, live: 0, clicks: 0 })
  const current = sections.find((section) => section.id === active) ?? sections[0]

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/sites')
      .then((res) => res.json())
      .then((rows: SiteRow[]) => {
        if (cancelled || !Array.isArray(rows)) return
        setStats({
          total: rows.length,
          live: rows.filter((row) => row.active).length,
          clicks: rows.reduce((sum, row) => sum + Number(row.clicks ?? 0), 0),
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  async function onLogout() {
    await logout()
    router.refresh()
  }

  let group = ''

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[120rem] items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logos/fist.png" alt="" className="h-10 w-auto" />
            <span className="text-sm font-black tracking-widest text-primary sm:text-base">AL KANKA PANEL</span>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" target="_blank" className="rounded-lg border border-primary/40 px-3 py-2 text-xs font-bold text-primary">
              Siteyi Gör
            </a>
            <button onClick={onLogout} className="rounded-lg bg-[#1a2338] px-3 py-2 text-xs font-bold text-white">
              Çıkış
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[120rem] px-4 py-6">
        <div className="grid grid-cols-3 gap-3">
          {[
            ['Toplam Site', stats.total],
            ['Aktif Site', stats.live],
            ['Toplam Tıklama', stats.clicks],
          ].map(([label, value]) => (
            <div key={String(label)} className="panel-gold rounded-2xl p-4 text-center">
              <div className="text-2xl font-black text-primary">{value}</div>
              <div className="text-[10px] uppercase tracking-wider text-[#7e879c]">{label}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
          <nav aria-label="Panel bölümleri" className="lg:sticky lg:top-20 lg:w-56 lg:shrink-0">
            <div className="flex flex-col gap-2">
              {sections.map((section) => {
                const showGroup = section.group !== group
                group = section.group
                const selected = section.id === current?.id
                return (
                  <div key={section.id} className="flex flex-col gap-2">
                    {showGroup ? (
                      <p className="px-2 pt-2 text-[10px] font-bold uppercase tracking-widest text-[#7e879c]">{section.group}</p>
                    ) : null}
                    <button
                      type="button"
                      aria-current={selected ? 'page' : undefined}
                      onClick={() => setActive(section.id)}
                      className={`rounded-xl px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide sm:text-sm ${
                        selected
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
                      }`}
                    >
                      {section.label}
                      {section.badge ? ` (${section.badge})` : ''}
                    </button>
                  </div>
                )
              })}
            </div>
          </nav>

          <div className="min-w-0 flex-1">
            <div key={current?.id}>{current?.body}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
