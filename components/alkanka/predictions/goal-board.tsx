'use client'

import { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Link2, ShieldAlert } from 'lucide-react'
import { linkGoalAccountAction } from '@/app/actions/community'
import { useAddressChoice } from '@/components/alkanka/use-address-choice'
import {
  GOAL_CATEGORIES,
  GOAL_KC_UNIT,
  GOAL_NAME,
  goalAmount,
  goalRuleLines,
  oddsText,
  type GoalCategory,
  type GoalEventView,
  type GoalMatch,
  type GoalMe,
} from '@/lib/goal-rewards-shared'
import { TR_ZONE_NOTE } from '@/lib/tr-time'
import { cn } from '@/lib/utils'
import { StatusLine, useAction } from '../community/use-action'
import { CouponMatchCard, TeamMatchCard } from './goal-match'
import { segmentCount, segmentItem, segmentTray } from './ui'

/** What the two event kinds are called in the page's address. */
const CATEGORY_WORD: Record<GoalCategory, string> = { alkanka: 'alkanka', sponsor: 'sponsor' }

const STEPS: Record<GoalCategory, { title: string; line: string }[]> = {
  alkanka: [
    { title: 'Takımını seç', line: 'Maç başlamadan iki takımdan birini seç.' },
    { title: 'Maçı bekle', line: 'Takımın ne kadar çok gol atarsa ödülün o kadar büyür.' },
    { title: 'Ödülünü al', line: 'Maç sonuçlanınca KC kendiliğinden hesabına yatar.' },
  ],
  sponsor: [
    { title: 'Hesabını bağla', line: 'Sponsordaki kullanıcı adını bir kez yaz.' },
    { title: 'Bahsini al', line: 'Listedeki maça, sponsorda ve maç başlamadan.' },
    { title: 'Kuponu gir', line: 'Kupon numaranı maçın kartına yaz, kaydet.' },
    { title: 'Ödülünü al', line: 'Kuponun geçerliyse maçtaki her gol ödül kazandırır.' },
  ],
}

const ACCOUNT_STATE = { pending: 'onay bekliyor', approved: 'onaylı', rejected: 'onaylanmadı' } as const

/** Open matches first, the nearest on top; finished ones follow, the latest first. */
function ordered(matches: GoalMatch[], now: number) {
  const rank = (m: GoalMatch) => (m.status !== 'open' ? 2 : Date.parse(m.kickoff) > now ? 0 : 1)
  return [...matches].sort((a, b) => rank(a) - rank(b) || (rank(a) === 2 ? b.kickoff.localeCompare(a.kickoff) : a.kickoff.localeCompare(b.kickoff)))
}

function Fact({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-background px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('font-display text-sm font-bold tabular-nums', strong ? 'text-primary' : 'text-foreground')}>{value}</dd>
    </div>
  )
}

/** The event's rules, always on the page: closed by the visitor, never hidden by default. */
function RuleBox({ event }: { event: GoalEventView }) {
  const lines = goalRuleLines(event)
  return (
    <details open className="group rounded-lg border border-border bg-background">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-bold text-foreground [&::-webkit-details-marker]:hidden">
        Kurallar
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <ul className="flex list-disc flex-col gap-1.5 px-3 pb-3 pl-7 text-xs leading-relaxed text-muted-foreground marker:text-primary">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </details>
  )
}

/** Sponsor events ask for the member's account at the sponsor; it is linked once and written onto every request. */
function AccountBox({ event, account }: { event: GoalEventView; account: GoalMe['accounts'][string] | null }) {
  const { pending, status, run } = useAction()
  const [username, setUsername] = useState('')
  const fieldId = useId()
  const site = event.siteName ?? 'Sponsor'
  const slug = event.siteSlug

  if (account && account.status !== 'rejected') {
    return (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-background px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        <Link2 className="size-3.5 shrink-0 text-success" aria-hidden="true" />
        <span>
          Bağlı {site} hesabın: <b className="text-foreground">{account.username}</b> ({ACCOUNT_STATE[account.status]}). Taleplerine bu kullanıcı adı eklenir.
        </span>
        <Link href="/profil" className="font-semibold text-primary underline-offset-2 hover:underline">
          Değiştir
        </Link>
      </p>
    )
  }
  if (!slug) return <p className="rounded-lg border border-border bg-background px-3 py-2.5 text-xs text-muted-foreground">Bu sponsor için hesap bağlama şu an kapalı.</p>

  return (
    <form
      className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => linkGoalAccountAction(slug, username), () => setUsername(''))
      }}
    >
      <label htmlFor={fieldId} className="flex items-center gap-1.5 text-xs font-bold text-foreground">
        <Link2 className="size-3.5 text-primary" aria-hidden="true" />
        Önce {site} hesabını bağla
      </label>
      {account?.status === 'rejected' && <span className="text-xs font-medium text-destructive">Daha önce bağladığın &quot;{account.username}&quot; hesabı onaylanmadı. Doğru kullanıcı adını yaz.</span>}
      <div className="flex flex-wrap gap-2">
        <input
          id={fieldId}
          value={username}
          maxLength={40}
          autoComplete="off"
          spellCheck={false}
          placeholder={`${site} kullanıcı adın`}
          onChange={(e) => setUsername(e.target.value)}
          className="h-11 min-w-0 flex-1 basis-44 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
        />
        <button type="submit" disabled={pending || username.trim().length < 3} className="h-11 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40">
          {pending ? 'Bağlanıyor...' : 'Hesabı bağla'}
        </button>
      </div>
      <span className="text-xs leading-relaxed text-muted-foreground">Bir kez bağlarsın; kupon girdiğinde kullanıcı adın talebine kendiliğinden eklenir. Ödül bu hesaba tanımlanır, yanlış yazılan hesaba ödül gönderilemez.</span>
      <StatusLine status={status} />
    </form>
  )
}

function EventBlock({ event, now, me }: { event: GoalEventView; now: number; me: GoalMe | null }) {
  const sponsor = event.category === 'sponsor'
  const account = sponsor && event.siteSlug ? (me?.accounts[event.siteSlug] ?? null) : null
  const usable = account && account.status !== 'rejected' ? account.username : null
  const blocked = me?.flag?.state === 'blocked'
  return (
    <section aria-label={event.title} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
            <h3 className="font-display text-lg font-bold text-foreground text-balance">{event.title}</h3>
            <p className="text-xs text-muted-foreground">{sponsor ? `${event.siteName ?? 'Sponsor'} etkinliği · ödülü sponsor verir` : 'Alkanka etkinliği · ödül KC olarak yatar'}</p>
          </div>
          <dl className="flex flex-wrap gap-2">
            <Fact label="Gol başı" value={goalAmount(event.perGoal, event.unit)} strong />
            {!sponsor && <Fact label="Katılım" value={event.entryFee > 0 ? goalAmount(event.entryFee, GOAL_KC_UNIT) : 'Ücretsiz'} />}
            {!sponsor && event.rules.length > 0 && <Fact label="Ödül şartı" value={`${event.rules.length} şart`} />}
            {sponsor && event.minOdds > 0 && <Fact label="En düşük oran" value={oddsText(event.minOdds)} />}
            {sponsor && event.minBet && <Fact label="En az bahis" value={event.minBet} />}
          </dl>
        </div>
        <RuleBox event={event} />
        {sponsor && me && !blocked && <AccountBox event={event} account={account} />}
      </div>
      <div className="grid items-start gap-3 @4xl:grid-cols-2">
        {ordered(event.matches, now).map((m) =>
          sponsor ? <CouponMatchCard key={m.id} event={event} m={m} now={now} account={usable} blocked={blocked} /> : <TeamMatchCard key={m.id} event={event} m={m} now={now} />,
        )}
      </div>
    </section>
  )
}

export function GoalBoard({
  events,
  serverNow,
  sponsorNote,
  me,
}: {
  events: GoalEventView[]
  serverNow: number
  /** Why sponsor events are not shown to this visitor, when they are held back. */
  sponsorNote: string | null
  /** Null for a guest. */
  me: GoalMe | null
}) {
  const [now, setNow] = useState(serverNow)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const has = (c: GoalCategory) => events.some((e) => e.category === c)
  const shown = GOAL_CATEGORIES.filter((c) => has(c.id) || (c.id === 'sponsor' && sponsorNote))
  const [chosen, setChosen] = useAddressChoice('etkinlik', CATEGORY_WORD, 'alkanka')
  if (shown.length === 0) return null
  const category = shown.some((c) => c.id === chosen) ? chosen : shown[0].id
  const list = events.filter((e) => e.category === category)
  const openIn = (c: GoalCategory) => events.filter((e) => e.category === c).reduce((n, e) => n + e.matches.filter((m) => m.status === 'open' && Date.parse(m.kickoff) > now).length, 0)
  const flag = category === 'sponsor' ? (me?.flag ?? null) : null

  return (
    <section aria-labelledby="gol-yagmuru" className="@container flex flex-col gap-5">
      <header className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
            <h2 id="gol-yagmuru" className="font-display text-xl font-bold text-foreground text-balance">
              {GOAL_NAME}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{GOAL_CATEGORIES.find((c) => c.id === category)?.hint} Skoru bilmen gerekmez; gol oldukça kazanırsın.</p>
          </div>
          {shown.length > 1 && (
            <div role="tablist" aria-label="Etkinlik türü" className={cn(segmentTray, 'grid w-full grid-cols-2 gap-1 @2xl:w-auto')}>
              {shown.map((c) => {
                const on = category === c.id
                const open = openIn(c.id)
                return (
                  <button key={c.id} type="button" role="tab" aria-selected={on} onClick={() => setChosen(c.id)} className={cn(segmentItem(on), 'h-11 px-3 text-sm @2xl:px-5')}>
                    <span className="truncate">{c.label}</span>
                    {open > 0 && (
                      <span className={segmentCount(on)}>
                        {open}
                        <span className="sr-only"> maç katılıma açık</span>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <ol className={cn('grid gap-2', category === 'sponsor' ? '@2xl:grid-cols-4' : '@2xl:grid-cols-3')}>
          {STEPS[category].map((s, i) => (
            <li key={s.title} className="flex items-start gap-2.5 rounded-lg bg-background px-3 py-2.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-xs font-bold text-primary" aria-hidden="true">
                {i + 1}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-bold text-foreground">{s.title}</span>
                <span className="text-xs leading-relaxed text-muted-foreground">{s.line}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">Maç saatleri ve gün hesabı: {TR_ZONE_NOTE}.</p>
      </header>

      {flag && (
        <p role="alert" className={cn('flex items-start gap-2 rounded-xl border px-4 py-3 text-sm leading-relaxed text-foreground', flag.state === 'blocked' ? 'border-destructive/50 bg-destructive/10' : 'border-primary/50 bg-primary/10')}>
          <ShieldAlert className={cn('mt-0.5 size-4 shrink-0', flag.state === 'blocked' ? 'text-destructive' : 'text-primary')} aria-hidden="true" />
          <span>
            <b>{flag.state === 'blocked' ? 'Sponsor etkinliklerine katılımın kapatıldı.' : 'Geçersiz talep uyarısı aldın.'}</b> {flag.note}{' '}
            {flag.state === 'blocked' ? 'Bir hata olduğunu düşünüyorsan destekle iletişime geç.' : 'Kurallara uymayan talep göndermeye devam edersen sponsor etkinliklerine katılımın kapatılır.'}
          </span>
        </p>
      )}

      {category === 'sponsor' && sponsorNote ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">{sponsorNote}</p>
      ) : (
        <div className="flex flex-col gap-8">
          {list.map((e) => (
            <EventBlock key={e.id} event={e} now={now} me={me} />
          ))}
        </div>
      )}
    </section>
  )
}
