'use client'

import { useState } from 'react'
import { Check, Star, Trash2, X } from 'lucide-react'
import { answerComplaint, createLeagueMatch, finishLeagueMatch, moderateReview, removeLeagueMatch } from '@/app/panel/community-actions'
import type { Complaint, LeagueMatch, Review } from '@/lib/community'
import { COMPLAINT_STATUS } from '@/components/alkanka/community/labels'
import { StatusLine, useAction } from '@/components/alkanka/community/use-action'
import { cn } from '@/lib/utils'
import { CommunityGuide, CommunityHint, type CommunityTab } from './community-guide'
import { FixturePicker } from './fixture-picker'

const field =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring'

type Props = {
  reviews: Review[]
  complaints: Complaint[]
  matches: LeagueMatch[]
  siteNames: Record<string, string>
}

export function CommunityManager({ reviews, complaints, matches, siteNames }: Props) {
  const [tab, setTab] = useState<CommunityTab>('reviews')
  const openComplaints = complaints.filter((c) => c.status === 'open' || c.status === 'forwarded').length
  return (
    <div className="flex flex-col gap-5">
      <CommunityGuide />
      <div role="tablist" className="flex w-fit gap-1 rounded-lg border border-border bg-card p-1">
        {(
          [
            ['reviews', `Yorum onayı (${reviews.length})`],
            ['complaints', `Şikâyetler (${openComplaints})`],
            ['league', `Tahmin ligi (${matches.filter((m) => !m.settled).length})`],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('h-9 rounded-md px-3 text-xs font-bold', tab === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {label}
          </button>
        ))}
      </div>
      <CommunityHint tab={tab} />
      {tab === 'reviews' && <Reviews reviews={reviews} siteNames={siteNames} />}
      {tab === 'complaints' && <Complaints complaints={complaints} siteNames={siteNames} />}
      {tab === 'league' && <LeagueAdmin matches={matches} />}
    </div>
  )
}

function Reviews({ reviews, siteNames }: { reviews: Review[]; siteNames: Record<string, string> }) {
  const { pending, status, run } = useAction()
  if (!reviews.length) return <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Onay bekleyen yorum yok.</p>
  return (
    <div className="flex flex-col gap-3">
      <StatusLine status={status} />
      <ul className="grid gap-3 lg:grid-cols-2">
        {reviews.map((r) => (
          <li key={r.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-foreground">{siteNames[r.siteId] ?? r.siteId} · {r.userName}</span>
              <span className="flex items-center gap-0.5 font-bold text-primary"><Star className="size-4 fill-current" aria-hidden />{r.rating}</span>
            </div>
            <p className="text-sm leading-relaxed text-foreground">{r.body}</p>
            <div className="flex gap-2">
              <button disabled={pending} onClick={() => run(() => moderateReview(r.id, 'approved'))} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-xs font-bold text-primary-foreground disabled:opacity-50">
                <Check className="size-4" aria-hidden /> Yayınla
              </button>
              <button disabled={pending} onClick={() => run(() => moderateReview(r.id, 'rejected'))} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-secondary text-xs font-bold text-secondary-foreground disabled:opacity-50">
                <X className="size-4" aria-hidden /> Reddet
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ComplaintRow({ c, site }: { c: Complaint; site: string }) {
  const { pending, status, run } = useAction()
  const [state, setState] = useState<Complaint['status']>(c.status)
  const [reply, setReply] = useState(c.reply ?? '')
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold text-foreground">{c.title}</span>
          <span className="text-xs text-muted-foreground">{site} · {c.userName} · {new Date(c.createdAt).toLocaleDateString('tr-TR')}</span>
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', COMPLAINT_STATUS[c.status].className)}>{COMPLAINT_STATUS[c.status].label}</span>
      </div>
      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{c.body}</p>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
        Herkese açık yanıt
        <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} maxLength={1000} placeholder="Örn. Site ile görüştük, ödeme 24 saat içinde yapılacak." className={field} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`st-${c.id}`}>Durum</label>
        <select id={`st-${c.id}`} value={state} onChange={(e) => setState(e.target.value as Complaint['status'])} className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground">
          {Object.entries(COMPLAINT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button disabled={pending} onClick={() => run(() => answerComplaint(c.id, state, reply))} className="h-9 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-50">
          {pending ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
        <StatusLine status={status} />
      </div>
    </li>
  )
}

function Complaints({ complaints, siteNames }: { complaints: Complaint[]; siteNames: Record<string, string> }) {
  if (!complaints.length) return <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Henüz şikâyet yok.</p>
  return (
    <ul className="grid gap-3 xl:grid-cols-2">
      {complaints.map((c) => <ComplaintRow key={c.id} c={c} site={siteNames[c.siteId] ?? c.siteId} />)}
    </ul>
  )
}

function FinishRow({ m }: { m: LeagueMatch }) {
  const { pending, status, run } = useAction()
  const [h, setH] = useState('')
  const [a, setA] = useState('')
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-semibold text-foreground">{m.home} - {m.away}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{m.league} · {new Date(m.kickoff).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {m.picks} tahmin</span>
      </div>
      {m.settled ? (
        <p className="text-sm text-muted-foreground">Sonuç: <b className="text-foreground">{m.homeGoals} - {m.awayGoals}</b> (puanlandı)</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input aria-label="Ev sahibi gol" inputMode="numeric" value={h} onChange={(e) => setH(e.target.value.replace(/\D/g, ''))} placeholder="0" className="h-9 w-14 rounded-lg border border-border bg-background text-center text-sm text-foreground" />
          <span className="text-muted-foreground">-</span>
          <input aria-label="Deplasman gol" inputMode="numeric" value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, ''))} placeholder="0" className="h-9 w-14 rounded-lg border border-border bg-background text-center text-sm text-foreground" />
          <button disabled={pending || h === '' || a === ''} onClick={() => run(() => finishLeagueMatch(m.id, Number(h), Number(a)))} className="h-9 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-40">
            Sonucu gir ve puanla
          </button>
          <button disabled={pending} onClick={() => confirm('Maç ve tahminleri silinsin mi?') && run(() => removeLeagueMatch(m.id))} aria-label="Maçı sil" className="flex size-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      )}
      <StatusLine status={status} />
    </li>
  )
}

function LeagueAdmin({ matches }: { matches: LeagueMatch[] }) {
  const { pending, status, run } = useAction()
  const [form, setForm] = useState({ league: 'Süper Lig', home: '', away: '', kickoff: '' })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })
  return (
    <div className="flex flex-col gap-5">
    <FixturePicker />
    <div className="grid gap-5 xl:grid-cols-[22rem_1fr]">
      <form
        className="flex flex-col gap-3 self-start rounded-xl border border-border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => createLeagueMatch({ ...form, kickoff: new Date(form.kickoff).toISOString() }), () => setForm({ ...form, home: '', away: '', kickoff: '' }))
        }}
      >
        <h3 className="font-display text-base font-bold text-foreground">Elle maç ekle</h3>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Lig<input value={form.league} onChange={set('league')} className={field} /></label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Ev sahibi<input value={form.home} onChange={set('home')} placeholder="Galatasaray" className={field} /></label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Deplasman<input value={form.away} onChange={set('away')} placeholder="Fenerbahçe" className={field} /></label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Başlama saati<input type="datetime-local" value={form.kickoff} onChange={set('kickoff')} className={field} /></label>
        <button disabled={pending || !form.home || !form.away || !form.kickoff} className="h-10 rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-40">Maçı ekle</button>
        <StatusLine status={status} />
        <p className="text-xs leading-relaxed text-muted-foreground">Tahminler başlama saatinde otomatik kilitlenir. Maç bitince sonucu girin; puanlar ve KC ödülleri anında dağıtılır.</p>
      </form>
      {matches.length ? (
        <ul className="flex flex-col gap-2">{matches.map((m) => <FinishRow key={m.id} m={m} />)}</ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Henüz maç eklenmedi.</p>
      )}
    </div>
    </div>
  )
}
