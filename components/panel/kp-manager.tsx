'use client'

import { useState, useTransition } from 'react'
import { Minus, Plus, Search, Trash2, Undo2 } from 'lucide-react'
import {
  changePoints,
  findMembers,
  giveBadge,
  giveContestBadge,
  previewContest,
  removeBadge,
  takeBackAward,
  updateLevels,
  updateRules,
  upsertBadge,
} from '@/app/panel/kp-actions'
import type { AutoKind, AwardRow, ContestRow, LeaderRow, SpecialBadge } from '@/lib/kanka-puan'
import { BADGE_ICONS, BADGE_TIERS, DEFAULT_LEVELS, RULE_FIELDS, type BadgeTier, type LevelDef, type PointRules } from '@/lib/kanka-puan-shared'
import { StatusLine, useAction } from '@/components/alkanka/community/use-action'
import { ICONS, LevelEmblem, SpecialEmblem } from '@/components/alkanka/kp/emblem'
import { cn } from '@/lib/utils'

const field =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring'

type Tab = 'levels' | 'rules' | 'badges' | 'award' | 'board'

type Props = {
  levels: LevelDef[]
  rules: PointRules
  badges: SpecialBadge[]
  awards: AwardRow[]
  board: LeaderRow[]
  autoLabels: Record<AutoKind, string>
}

export function KpManager({ levels, rules, badges, awards, board, autoLabels }: Props) {
  const [tab, setTab] = useState<Tab>('levels')
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-bold text-foreground">Kanka Puan ve rozet sistemi</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Üyeler sitede vakit geçirerek, oyun oynayarak, görev yaparak ve sohbette yazarak Kanka Puan (KP) toplar. Puan arttıkça seviye atlar ve her seviyenin kendi rozeti açılır. Değerli rozetleri sen verirsin ya da yarışma kazananına tek tıkla verilir. Turnuva şampiyonları rozetini otomatik alır.
        </p>
      </div>
      <div role="tablist" className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1 sm:w-fit">
        {(
          [
            ['levels', `Seviyeler (${levels.length})`],
            ['rules', 'Puan kuralları'],
            ['badges', `Değerli rozetler (${badges.length})`],
            ['award', 'Rozet ver'],
            ['board', 'KP sıralaması'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('h-9 shrink-0 whitespace-nowrap rounded-md px-3 text-xs font-bold', tab === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'levels' && <LevelsEditor initial={levels} />}
      {tab === 'rules' && <RulesEditor initial={rules} />}
      {tab === 'badges' && <BadgesEditor badges={badges} autoLabels={autoLabels} />}
      {tab === 'award' && <AwardDesk badges={badges} awards={awards} autoLabels={autoLabels} />}
      {tab === 'board' && <Board board={board} />}
    </div>
  )
}

function LevelsEditor({ initial }: { initial: LevelDef[] }) {
  const [levels, setLevels] = useState(initial)
  const { pending, status, run } = useAction()
  const set = (i: number, patch: Partial<LevelDef>) => setLevels((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Her satır bir seviye. Puan, o seviyeye ulaşmak için gereken toplam KP. İlk seviye 0 olmalı.</p>
      <ol className="flex flex-col gap-2">
        {levels.map((l, i) => (
          <li key={i} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border border-border bg-card p-2 sm:grid-cols-[auto_1fr_1fr_8rem_auto]">
            <LevelEmblem level={i + 1} size="sm" />
            <input aria-label={`${i + 1}. seviye adı`} value={l.name} onChange={(e) => set(i, { name: e.target.value })} className={field} placeholder="Seviye adı" />
            <input aria-label={`${i + 1}. seviye rozeti`} value={l.badge} onChange={(e) => set(i, { badge: e.target.value })} className={cn(field, 'col-span-2 sm:col-span-1')} placeholder="Rozet adı" />
            <input aria-label={`${i + 1}. seviye puanı`} type="number" min={0} value={l.min} onChange={(e) => set(i, { min: Number(e.target.value) })} className={cn(field, 'tabular-nums')} />
            <button onClick={() => setLevels((x) => x.filter((_, j) => j !== i))} disabled={levels.length <= 2} aria-label="Seviyeyi sil" className="rounded-md p-2 text-muted-foreground hover:text-destructive disabled:opacity-30">
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setLevels((l) => [...l, { name: 'Yeni seviye', badge: 'Yeni rozet', min: (l.at(-1)?.min ?? 0) + 5000 }])} className="flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold text-foreground hover:bg-secondary">
          <Plus className="size-4" aria-hidden /> Seviye ekle
        </button>
        <button onClick={() => setLevels(DEFAULT_LEVELS)} className="h-10 rounded-lg border border-border px-3 text-sm font-semibold text-muted-foreground hover:text-foreground">
          Varsayılan 20 seviye
        </button>
        <button disabled={pending} onClick={() => run(() => updateLevels(levels))} className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
          Kaydet
        </button>
        <StatusLine status={status} />
      </div>
    </div>
  )
}

function RulesEditor({ initial }: { initial: PointRules }) {
  const [rules, setRules] = useState(initial)
  const { pending, status, run } = useAction()
  return (
    <div className="flex flex-col gap-3">
      <ul className="grid gap-2 md:grid-cols-2">
        {RULE_FIELDS.map((f) => (
          <li key={f.key} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <label htmlFor={`rule-${f.key}`} className="text-sm font-semibold text-foreground">{f.label}</label>
              <span className="text-xs leading-relaxed text-muted-foreground">{f.hint}</span>
            </div>
            <div className="flex w-36 shrink-0 items-center gap-2">
              <input id={`rule-${f.key}`} type="number" min={0} value={rules[f.key]} onChange={(e) => setRules((r) => ({ ...r, [f.key]: Number(e.target.value) }))} className={cn(field, 'w-20 tabular-nums')} />
              <span className="text-[11px] leading-tight text-muted-foreground">{f.unit}</span>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={() => run(() => updateRules(rules))} className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
          Kuralları kaydet
        </button>
        <StatusLine status={status} />
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">Değişiklikler geçmiş aktiviteye de uygulanır: oyun, görev ve mesaj puanları her seferinde aktivite kayıtlarından yeniden hesaplanır.</p>
    </div>
  )
}

type Draft = { id?: string; name: string; description: string; icon: string; tier: BadgeTier; bonus: number; auto: AutoKind | null; active: boolean }
const EMPTY: Draft = { name: '', description: '', icon: 'award', tier: 'altin', bonus: 250, auto: null, active: true }

function BadgesEditor({ badges, autoLabels }: { badges: SpecialBadge[]; autoLabels: Record<AutoKind, string> }) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const { pending, status, run } = useAction()
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setDraft(EMPTY)} className="flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">
          <Plus className="size-4" aria-hidden /> Yeni değerli rozet
        </button>
        <StatusLine status={status} />
      </div>
      {draft && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            run(() => upsertBadge(draft), () => setDraft(null))
          }}
          className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-card p-4"
        >
          <div className="flex items-center gap-3">
            <SpecialEmblem icon={draft.icon} tier={draft.tier} />
            <span className="font-display text-base font-bold text-foreground">{draft.id ? 'Rozeti düzenle' : 'Yeni rozet'}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Rozet adı (örn. Tahmin Kralı)" className={field} aria-label="Rozet adı" />
            <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Kime verilir?" className={field} aria-label="Açıklama" />
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
              Değeri
              <select value={draft.tier} onChange={(e) => setDraft({ ...draft, tier: e.target.value as BadgeTier })} className={field}>
                {BADGE_TIERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
              Kazanana bonus KP
              <input type="number" min={0} value={draft.bonus} onChange={(e) => setDraft({ ...draft, bonus: Number(e.target.value) })} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground sm:col-span-2">
              Otomatik yarışma
              <select value={draft.auto ?? ''} onChange={(e) => setDraft({ ...draft, auto: (e.target.value || null) as AutoKind | null })} className={field}>
                <option value="">Yok, elle veririm</option>
                {(Object.keys(autoLabels) as AutoKind[]).map((k) => <option key={k} value={k}>{autoLabels[k]}</option>)}
              </select>
            </label>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs font-semibold text-muted-foreground">Simge</legend>
            <div className="flex flex-wrap gap-1.5">
              {BADGE_ICONS.map((ic) => {
                const Icon = ICONS[ic]
                return (
                  <button type="button" key={ic} onClick={() => setDraft({ ...draft, icon: ic })} aria-label={ic} aria-pressed={draft.icon === ic} className={cn('flex size-9 items-center justify-center rounded-lg border', draft.icon === ic ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                    <Icon className="size-4" />
                  </button>
                )
              })}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="size-4 accent-primary" />
            Sitede göster
          </label>
          <div className="flex gap-2">
            <button disabled={pending} className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">Kaydet</button>
            <button type="button" onClick={() => setDraft(null)} className="h-10 rounded-lg border border-border px-4 text-sm font-semibold text-foreground">Vazgeç</button>
          </div>
        </form>
      )}
      <ul className="grid gap-3 md:grid-cols-2">
        {badges.map((b) => (
          <li key={b.id} className={cn('flex items-start gap-3 rounded-xl border border-border bg-card p-4', !b.active && 'opacity-60')}>
            <SpecialEmblem icon={b.icon} tier={b.tier} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-sm font-bold text-foreground">{b.name}</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-secondary-foreground">{BADGE_TIERS.find((t) => t.id === b.tier)?.label}</span>
                {!b.active && <span className="text-[10px] font-bold uppercase text-muted-foreground">Gizli</span>}
              </div>
              <span className="text-xs leading-relaxed text-muted-foreground">{b.description}</span>
              <span className="text-xs text-muted-foreground">
                {b.auto ? autoLabels[b.auto] : 'Elle verilir'} · +{b.bonus} KP · {b.holders} sahibi
              </span>
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              <button onClick={() => setDraft({ id: b.id, name: b.name, description: b.description, icon: b.icon, tier: b.tier, bonus: b.bonus, auto: b.auto, active: b.active })} className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-foreground hover:bg-secondary">
                Düzenle
              </button>
              <button
                disabled={pending}
                onClick={() => confirm(`${b.name} rozeti ve tüm verilişleri silinsin mi?`) && run(() => removeBadge(b.id))}
                className="rounded-md px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10"
              >
                Sil
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AwardDesk({ badges, awards, autoLabels }: { badges: SpecialBadge[]; awards: AwardRow[]; autoLabels: Record<AutoKind, string> }) {
  const contests = badges.filter((b) => b.auto && b.auto !== 'turnuva')
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="font-display text-base font-bold text-foreground">Yarışma rozetleri</h3>
        <p className="text-sm text-muted-foreground">Güncel sıralamaya bak, dönem bitince birinciye tek tıkla ver. Aynı dönem için rozet ikinci kez verilemez.</p>
        {contests.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {contests.map((b) => <ContestCard key={b.id} badge={b} label={autoLabels[b.auto!]} />)}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Otomatik yarışması olan rozet yok. Değerli rozetler sekmesinden ekleyebilirsin.</p>
        )}
      </section>
      <ManualAward badges={badges} />
      <section className="flex flex-col gap-3">
        <h3 className="font-display text-base font-bold text-foreground">Son verilen rozetler</h3>
        <AwardList awards={awards} />
      </section>
    </div>
  )
}

function ContestCard({ badge, label }: { badge: SpecialBadge; label: string }) {
  const [data, setData] = useState<{ period: string; rows: ContestRow[] } | null>(null)
  const [loading, start] = useTransition()
  const { pending, status, run } = useAction()
  const load = () => start(async () => setData(await previewContest(badge.auto as Exclude<AutoKind, 'turnuva'>)))
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <SpecialEmblem icon={badge.icon} tier={badge.tier} size="sm" />
        <div className="flex min-w-0 flex-col">
          <span className="font-display text-sm font-bold text-foreground">{badge.name}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      </div>
      {data ? (
        data.rows.length ? (
          <ol className="flex flex-col gap-1 text-sm">
            {data.rows.slice(0, 5).map((r, i) => (
              <li key={r.userId} className={cn('flex items-center justify-between gap-2 rounded-md px-2 py-1.5', i === 0 ? 'bg-primary/15' : 'bg-background')}>
                <span className="truncate font-semibold text-foreground">{i + 1}. {r.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{r.detail}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">Bu dönem ({data.period}) henüz aday yok.</p>
        )
      ) : (
        <button onClick={load} disabled={loading} className="h-9 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50">
          {loading ? 'Yükleniyor...' : 'Güncel sıralamayı göster'}
        </button>
      )}
      {data && data.rows.length > 0 && (
        <button disabled={pending} onClick={() => run(() => giveContestBadge(badge.id))} className="h-9 rounded-lg bg-primary text-xs font-bold text-primary-foreground disabled:opacity-50">
          Birinciye ver ({data.period})
        </button>
      )}
      <StatusLine status={status} />
    </div>
  )
}

type Member = { id: string; name: string; email: string }

function MemberPicker({ value, onChange }: { value: Member | null; onChange: (m: Member | null) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Member[]>([])
  const [loading, start] = useTransition()
  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
        <span className="truncate"><b className="text-foreground">{value.name}</b> <span className="text-muted-foreground">{value.email}</span></span>
        <button type="button" onClick={() => onChange(null)} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Değiştir</button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
              e.preventDefault()
              start(async () => setResults(await findMembers(q)))
            }
          }}
          placeholder="Üye adı ya da e-posta"
          className={field}
          aria-label="Üye ara"
        />
        <button type="button" onClick={() => start(async () => setResults(await findMembers(q)))} disabled={loading} className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold text-foreground hover:bg-secondary">
          <Search className="size-4" aria-hidden /> Ara
        </button>
      </div>
      {results.length > 0 && (
        <ul className="flex flex-col gap-1">
          {results.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => onChange(m)} className="flex w-full items-center justify-between gap-2 rounded-md bg-background px-3 py-2 text-left text-sm hover:bg-secondary">
                <span className="font-semibold text-foreground">{m.name}</span>
                <span className="truncate text-xs text-muted-foreground">{m.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ManualAward({ badges }: { badges: SpecialBadge[] }) {
  const [member, setMember] = useState<Member | null>(null)
  const [badgeId, setBadgeId] = useState(badges[0]?.id ?? '')
  const [note, setNote] = useState('')
  const [points, setPoints] = useState(100)
  const { pending, status, run } = useAction()
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <h3 className="font-display text-base font-bold text-foreground">Üye seç</h3>
        <MemberPicker value={member} onChange={setMember} />
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <h3 className="font-display text-base font-bold text-foreground">Rozet ya da puan ver</h3>
        <select value={badgeId} onChange={(e) => setBadgeId(e.target.value)} className={field} aria-label="Rozet">
          {badges.map((b) => <option key={b.id} value={b.id}>{b.name} (+{b.bonus} KP)</option>)}
        </select>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Not (örn. Ekim yazı yarışması birincisi)" className={field} aria-label="Not" />
        <button disabled={pending || !member || !badgeId} onClick={() => member && run(() => giveBadge(badgeId, member.id, note))} className="h-10 rounded-lg bg-primary text-sm font-bold text-primary-foreground disabled:opacity-40">
          Rozeti ver
        </button>
        <div className="flex items-center gap-2 border-t border-border pt-3">
          <input type="number" value={points} onChange={(e) => setPoints(Number(e.target.value))} className={cn(field, 'w-28 tabular-nums')} aria-label="KP miktarı" />
          <button disabled={pending || !member} onClick={() => member && run(() => changePoints(member.id, Math.abs(points), note || 'Yönetici ödülü'))} className="flex h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-secondary text-xs font-bold text-secondary-foreground disabled:opacity-40">
            <Plus className="size-4" aria-hidden /> KP ekle
          </button>
          <button disabled={pending || !member} onClick={() => member && run(() => changePoints(member.id, -Math.abs(points), note || 'Yönetici düzeltmesi'))} className="flex h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-secondary text-xs font-bold text-secondary-foreground disabled:opacity-40">
            <Minus className="size-4" aria-hidden /> KP düş
          </button>
        </div>
        <StatusLine status={status} />
      </div>
    </section>
  )
}

function AwardList({ awards }: { awards: AwardRow[] }) {
  const { pending, status, run } = useAction()
  if (!awards.length) return <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Henüz rozet verilmedi.</p>
  return (
    <div className="flex flex-col gap-2">
      <StatusLine status={status} />
      <ul className="grid gap-2 md:grid-cols-2">
        {awards.map((a) => (
          <li key={a.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <SpecialEmblem icon={a.icon} tier={a.tier} size="sm" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold text-foreground">{a.userName} · {a.badgeName}</span>
              <span className="truncate text-xs text-muted-foreground">
                {new Date(a.awardedAt).toLocaleDateString('tr-TR')}{a.note ? ` · ${a.note}` : ''}
              </span>
            </div>
            <button disabled={pending} onClick={() => confirm('Rozet ve bonus KP geri alınsın mı?') && run(() => takeBackAward(a.id))} aria-label="Geri al" className="rounded-md p-2 text-muted-foreground hover:text-destructive">
              <Undo2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Board({ board }: { board: LeaderRow[] }) {
  if (!board.length) return <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Henüz puan toplayan üye yok.</p>
  return (
    <ol className="flex flex-col gap-2">
      {board.map((r, i) => (
        <li key={r.userId} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
          <span className="w-6 text-right font-display text-sm font-bold tabular-nums text-muted-foreground">{i + 1}</span>
          <LevelEmblem level={r.level} size="sm" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold text-foreground">{r.name}</span>
            <span className="truncate text-xs text-muted-foreground">{r.levelName} · {r.badge}{r.specials ? ` · ${r.specials} değerli rozet` : ''}</span>
          </div>
          <span className="font-display text-sm font-bold tabular-nums text-primary">{r.kp.toLocaleString('tr-TR')} KP</span>
        </li>
      ))}
    </ol>
  )
}
