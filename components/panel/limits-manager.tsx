'use client'

import { useState, useTransition } from 'react'
import { Pencil, Search, Trash2 } from 'lucide-react'
import { deleteMemberLimit, saveMemberLimit, searchMembersForLimit } from '@/app/panel/limits-actions'
import type { MemberLimit } from '@/lib/member-limits'
import { cn } from '@/lib/utils'

const field = 'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-primary'

type Target = { id: string; name: string; email: string }
type Draft = { dailyWinLimit: string; dailyGameLimit: string; marketBan: boolean; marketSpendLimit: string; note: string }

const toDraft = (l?: MemberLimit): Draft => ({
  dailyWinLimit: l?.dailyWinLimit == null ? '' : String(l.dailyWinLimit),
  dailyGameLimit: l?.dailyGameLimit == null ? '' : String(l.dailyGameLimit),
  marketBan: l?.marketBan ?? false,
  marketSpendLimit: l?.marketSpendLimit == null ? '' : String(l.marketSpendLimit),
  note: l?.note ?? '',
})

const num = (v: string) => (v.trim() === '' ? null : Math.max(0, Math.floor(Number(v) || 0)))

function summary(l: MemberLimit) {
  const parts: string[] = []
  if (l.dailyWinLimit !== null) parts.push(`Günlük kazanç ≤ ${l.dailyWinLimit.toLocaleString('tr-TR')}`)
  if (l.dailyGameLimit !== null) parts.push(`Günde ${l.dailyGameLimit} oyun`)
  if (l.marketBan) parts.push('Market yasak')
  else if (l.marketSpendLimit !== null) parts.push(`Market ≤ ${l.marketSpendLimit.toLocaleString('tr-TR')}/gün`)
  return parts.join(' · ')
}

export function LimitsManager({ limits }: { limits: MemberLimit[] }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Target[]>([])
  const [target, setTarget] = useState<Target | null>(null)
  const [draft, setDraft] = useState<Draft>(toDraft())
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  function search() {
    start(async () => {
      const r = await searchMembersForLimit(query)
      setResults(r)
      if (!r.length) setMsg({ ok: false, text: 'Üye bulunamadı.' })
      else setMsg(null)
    })
  }

  function pick(t: Target) {
    setTarget(t)
    setDraft(toDraft(limits.find((l) => l.userId === t.id)))
    setResults([])
  }

  function save() {
    if (!target) return
    start(async () => {
      const res = await saveMemberLimit(target.id, {
        dailyWinLimit: num(draft.dailyWinLimit),
        dailyGameLimit: num(draft.dailyGameLimit),
        marketBan: draft.marketBan,
        marketSpendLimit: num(draft.marketSpendLimit),
        note: draft.note,
      })
      setMsg(res.ok ? { ok: true, text: res.message ?? 'Kaydedildi.' } : { ok: false, text: res.error })
      if (res.ok) setTarget(null)
    })
  }

  function remove(userId: string) {
    if (!confirm('Bu üyenin kısıtlaması kaldırılsın mı?')) return
    start(async () => {
      const res = await deleteMemberLimit(userId)
      setMsg(res.ok ? { ok: true, text: res.message ?? 'Kaldırıldı.' } : { ok: false, text: res.error })
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
        Üyeye gizli sınır koy. Üye kısıtlandığını görmez; sınıra gelince sadece &quot;şu an yapılamıyor&quot; gibi genel bir mesaj alır.
        Günler Türkiye saatiyle gece yarısı sıfırlanır. Boş bırakılan alan sınırsızdır.
      </p>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          search()
        }}
      >
        <label className="sr-only" htmlFor="limit-search">Üye ara</label>
        <input
          id="limit-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="İsim veya e-posta"
          className={cn(field, 'max-w-sm flex-1')}
        />
        <button
          type="submit"
          disabled={pending || query.trim().length < 2}
          className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Search className="size-4" aria-hidden="true" />
          Ara
        </button>
        {msg && (
          <p className={cn('self-center text-sm', msg.ok ? 'text-success' : 'text-destructive')} aria-live="polite">
            {msg.text}
          </p>
        )}
      </form>

      {results.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {results.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => pick(r)} className="flex w-full flex-col p-3 text-left text-sm hover:bg-secondary">
                <span className="font-medium text-foreground">{r.name || 'İsimsiz'}</span>
                <span className="text-xs text-muted-foreground">{r.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {target && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-card p-4">
          <p className="text-sm font-semibold text-foreground">
            {target.name || 'İsimsiz'} <span className="font-normal text-muted-foreground">{target.email}</span>
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Günlük max net kazanç (KC)
              <input type="number" min={0} inputMode="numeric" value={draft.dailyWinLimit} onChange={(e) => setDraft({ ...draft, dailyWinLimit: e.target.value })} className={field} placeholder="Sınırsız" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Günlük max oyun sayısı
              <input type="number" min={0} inputMode="numeric" value={draft.dailyGameLimit} onChange={(e) => setDraft({ ...draft, dailyGameLimit: e.target.value })} className={field} placeholder="Sınırsız" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Günlük max market harcaması (KC)
              <input type="number" min={0} inputMode="numeric" disabled={draft.marketBan} value={draft.marketSpendLimit} onChange={(e) => setDraft({ ...draft, marketSpendLimit: e.target.value })} className={cn(field, 'disabled:opacity-50')} placeholder="Sınırsız" />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={draft.marketBan} onChange={(e) => setDraft({ ...draft, marketBan: e.target.checked })} className="size-4 accent-primary" />
            Marketten hiç alışveriş yapamasın
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Not (sadece panelde görünür)
            <input value={draft.note} maxLength={300} onChange={(e) => setDraft({ ...draft, note: e.target.value })} className={field} />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={pending} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              Kaydet
            </button>
            <button type="button" onClick={() => setTarget(null)} className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-foreground">
              Vazgeç
            </button>
          </div>
        </div>
      )}

      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
        {limits.length === 0 && <li className="p-4 text-sm text-muted-foreground">Kısıtlanmış üye yok.</li>}
        {limits.map((l) => (
          <li key={l.userId} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium text-foreground">
                {l.userName || 'İsimsiz'} <span className="font-normal text-muted-foreground">{l.userEmail}</span>
              </span>
              <span className="text-xs text-muted-foreground">{summary(l)}</span>
              {l.note && <span className="text-xs text-muted-foreground">Not: {l.note}</span>}
            </div>
            <button type="button" aria-label="Düzenle" onClick={() => pick({ id: l.userId, name: l.userName, email: l.userEmail })} className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
              <Pencil className="size-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Kaldır" disabled={pending} onClick={() => remove(l.userId)} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
