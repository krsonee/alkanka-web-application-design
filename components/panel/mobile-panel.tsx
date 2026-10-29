'use client'

import { useState, useTransition } from 'react'
import useSWR from 'swr'
import { BellOff, BellRing, Send, Smartphone } from 'lucide-react'
import { loadMobileMembers, sendSegmentPush } from '@/app/panel/mobile-actions'
import type { MobileSegment } from '@/lib/mobile'
import { cn } from '@/lib/utils'

type Counts = { total: number; installed: number; push: number; both: number; none: number; opensToday: number; turnedOff: number }
type Option = { value: MobileSegment; label: string }

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—')

export function MobilePanel({ counts, segments, topicLabels }: { counts: Counts; segments: Option[]; topicLabels: Record<string, string> }) {
  const [segment, setSegment] = useState<MobileSegment>('yukleyen')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { data, isLoading } = useSWR(['mobile-members', segment, from, to], () => loadMobileMembers(segment, from || null, to || null))

  const segCount: Record<MobileSegment, number> = {
    hepsi: counts.total,
    yukleyen: counts.installed,
    bildirim: counts.push,
    ikisi: counts.both,
    hicbiri: counts.none,
  }

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Uygulamayı yükleyen" value={counts.installed} icon={Smartphone} />
        <Stat label="Bildirimi açık üye" value={counts.push} icon={BellRing} />
        <Stat label="Bugün uygulamadan giren" value={counts.opensToday} icon={Smartphone} />
        <Stat label="Bildirimi kapatan" value={counts.turnedOff} icon={BellOff} />
      </dl>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Segment">
          {segments.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={segment === s.value}
              onClick={() => setSegment(s.value)}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold',
                segment === s.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {s.label}
              <span className="tabular-nums opacity-70">{segCount[s.value]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Başlangıç
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Bitiş
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground" />
          </label>
          <p className="pb-2 text-xs text-muted-foreground">
            {segment === 'yukleyen' || segment === 'ikisi' ? 'Tarih: yükleme tarihi' : 'Tarih: üyelik tarihi'}
          </p>
        </div>
      </div>

      <SegmentSender segment={segment} from={from} to={to} />

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">Üye</th>
              <th className="px-3 py-2 font-semibold">Yükleme</th>
              <th className="px-3 py-2 font-semibold">Platform</th>
              <th className="px-3 py-2 font-semibold">Son açılış</th>
              <th className="px-3 py-2 font-semibold">Açılış günü</th>
              <th className="px-3 py-2 font-semibold">Bildirim</th>
              <th className="px-3 py-2 font-semibold">Kapattığı konular</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Yükleniyor…</td></tr>
            )}
            {!isLoading && !data?.length && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Bu segmentte üye yok.</td></tr>
            )}
            {data?.map((m) => (
              <tr key={m.userId}>
                <td className="px-3 py-2 font-medium text-foreground">{m.name}</td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{fmt(m.installedAt)}</td>
                <td className="px-3 py-2 text-muted-foreground">{m.platform ?? '—'}</td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{fmt(m.lastOpen)}</td>
                <td className="px-3 py-2 tabular-nums text-foreground">{m.openDays}</td>
                <td className="px-3 py-2">
                  {m.push ? (
                    <span className="text-xs font-semibold text-primary">Açık</span>
                  ) : m.pushOffAt ? (
                    <span className="text-xs text-destructive">Kapattı · {fmt(m.pushOffAt)}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Yok</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{m.muted.map((t) => topicLabels[t] ?? t).join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && data.length >= 200 && <p className="text-xs text-muted-foreground">İlk 200 üye gösteriliyor. Gönderim tüm segmenti kapsar.</p>}
    </div>
  )
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Smartphone }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <Icon className="size-5 shrink-0 text-primary" aria-hidden />
      <div className="flex min-w-0 flex-col">
        <dt className="truncate text-xs text-muted-foreground">{label}</dt>
        <dd className="text-lg font-bold tabular-nums text-foreground">{value.toLocaleString('tr-TR')}</dd>
      </div>
    </div>
  )
}

function SegmentSender({ segment, from, to }: { segment: MobileSegment; from: string; to: string }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('/')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const r = await sendSegmentPush({ segment, from: from || null, to: to || null, title, body, url })
          setMsg({ ok: r.ok, text: r.message })
          if (r.ok) {
            setTitle('')
            setBody('')
          }
        })
      }}
    >
      <p className="text-sm font-bold text-foreground">Bu segmente bildirim gönder</p>
      <div className="grid gap-3 md:grid-cols-[1fr_2fr_1fr]">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Başlık" aria-label="Başlık" className="h-9 rounded-lg border border-border bg-background px-3 text-sm" />
        <input value={body} onChange={(e) => setBody(e.target.value)} maxLength={180} placeholder="Mesaj" aria-label="Mesaj" className="h-9 rounded-lg border border-border bg-background px-3 text-sm" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} maxLength={200} placeholder="/oyunlar" aria-label="Link" className="h-9 rounded-lg border border-border bg-background px-3 text-sm" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60">
          <Send className="size-4" aria-hidden /> {pending ? 'Gönderiliyor…' : 'Gönder'}
        </button>
        {msg && <p role="status" className={cn('text-xs', msg.ok ? 'text-primary' : 'text-destructive')}>{msg.text}</p>}
      </div>
    </form>
  )
}
