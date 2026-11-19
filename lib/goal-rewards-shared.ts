/**
 * "Gol başı ödül" events: a member backs one team and earns a fixed reward for every goal that team scores.
 * Kept apart from the prediction league: its own tables, its own rules, nothing shared but the page.
 */

export type GoalCategory = 'alkanka' | 'sponsor'
export type GoalSide = 'home' | 'away'
export type GoalStatus = 'open' | 'settled' | 'void'
/** Sponsor events only: whether staff confirmed that the member met the sponsor's condition. */
export type GoalApproval = 'pending' | 'approved' | 'rejected'

export const GOAL_CATEGORIES: { id: GoalCategory; label: string; hint: string }[] = [
  { id: 'alkanka', label: 'Alkanka etkinlikleri', hint: 'Ödül KC olarak kendiliğinden hesabına yatar.' },
  { id: 'sponsor', label: 'Sponsor etkinlikleri', hint: 'Ödülü sponsor verir, katılım şartı kartta yazar.' },
]

export const GOAL_MAX_PER_GOAL = 10_000
export const GOAL_MAX_GOALS = 30
export const GOAL_KC_UNIT = 'KC'

export type GoalEventInput = {
  id?: number | null
  title: string
  category: GoalCategory
  perGoal: number
  /** What a sponsor hands out per goal, in its own words: "freebet", "freespin". Always KC for Alkanka events. */
  unit: string
  siteId: number | null
  /** The member must have joined the sponsor through our link. */
  viaLink: boolean
  /** Smallest bet the sponsor asks for, as it should read on the card: "100 TL". Empty when there is none. */
  minBet: string
  terms: string
  active: boolean
}

export type GoalEvent = Omit<GoalEventInput, 'id'> & { id: number; siteName: string | null; createdAt: string }

export type GoalMyPick = {
  side: GoalSide
  siteUsername: string | null
  approval: GoalApproval
  goals: number | null
  reward: number | null
  paid: boolean
}

export type GoalMatch = {
  id: number
  eventId: number
  league: string
  home: string
  away: string
  homeLogo: string | null
  awayLogo: string | null
  extId: number | null
  kickoff: string
  status: GoalStatus
  homeGoals: number | null
  awayGoals: number | null
  /** Fixed when the match is added, so a later change to the event never rewrites a promise already made. */
  perGoal: number
  homePicks: number
  awayPicks: number
  myPick: GoalMyPick | null
}

export type GoalEventView = GoalEvent & { matches: GoalMatch[] }

export type GoalPickRow = {
  userId: string
  userName: string
  side: GoalSide
  siteUsername: string | null
  approval: GoalApproval
  goals: number | null
  reward: number | null
  paid: boolean
  payError: string | null
  at: string
}

export const isGoalCategory = (v: unknown): v is GoalCategory => v === 'alkanka' || v === 'sponsor'
export const isGoalSide = (v: unknown): v is GoalSide => v === 'home' || v === 'away'
export const isGoalApproval = (v: unknown): v is GoalApproval => v === 'pending' || v === 'approved' || v === 'rejected'

const text = (v: unknown, max: number) =>
  String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)

/** Checks an event before it is saved; the cleaned copy is what gets stored. */
export function checkGoalEvent(input: unknown): { ok: true; value: GoalEventInput } | { ok: false; error: string } {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  if (!isGoalCategory(raw.category)) return { ok: false, error: 'Etkinlik türünü seç: Alkanka ya da sponsor.' }
  const sponsor = raw.category === 'sponsor'
  const title = text(raw.title, 80)
  if (title.length < 3) return { ok: false, error: 'Etkinliğe en az 3 harfli bir ad ver.' }
  const perGoal = Number(raw.perGoal)
  if (!Number.isInteger(perGoal) || perGoal < 1 || perGoal > GOAL_MAX_PER_GOAL) {
    return { ok: false, error: `Gol başı ödül 1 ile ${GOAL_MAX_PER_GOAL.toLocaleString('tr-TR')} arasında tam sayı olmalı.` }
  }
  const unit = sponsor ? text(raw.unit, 24) : GOAL_KC_UNIT
  if (sponsor && unit.length < 2) return { ok: false, error: 'Sponsorun verdiği ödülün adını yaz: freebet, freespin gibi.' }
  const siteId = sponsor ? Number(raw.siteId) : null
  if (sponsor && (!Number.isSafeInteger(siteId) || (siteId as number) <= 0)) return { ok: false, error: 'Etkinliğin sponsorunu seç.' }
  const viaLink = sponsor && Boolean(raw.viaLink)
  const minBet = sponsor ? text(raw.minBet, 40) : ''
  const terms = String(raw.terms ?? '')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, 600)
  if (sponsor && !viaLink && !minBet && terms.length < 10) {
    return { ok: false, error: 'Sponsor etkinliğinde katılım şartı kartta yazar: linkten üyelik, en az bahis ya da şart metninden en az birini doldur.' }
  }
  const id = raw.id === null || raw.id === undefined || raw.id === '' ? null : Number(raw.id)
  if (id !== null && (!Number.isSafeInteger(id) || id <= 0)) return { ok: false, error: 'Etkinlik bulunamadı.' }
  return { ok: true, value: { id, title, category: raw.category, perGoal, unit, siteId, viaLink, minBet, terms, active: raw.active !== false } }
}

export function checkGoalScore(home: unknown, away: unknown): { ok: true; home: number; away: number } | { ok: false; error: string } {
  const h = Number(home)
  const a = Number(away)
  const fine = (n: number) => Number.isInteger(n) && n >= 0 && n <= GOAL_MAX_GOALS
  if (home === '' || away === '' || home === null || away === null || !fine(h) || !fine(a)) {
    return { ok: false, error: `Skoru gir: iki takım için de 0 ile ${GOAL_MAX_GOALS} arasında bir sayı.` }
  }
  return { ok: true, home: h, away: a }
}

export const goalsFor = (side: GoalSide, home: number, away: number) => (side === 'home' ? home : away)

export function goalReward(perGoal: number, goals: number) {
  if (!Number.isInteger(perGoal) || !Number.isInteger(goals) || perGoal <= 0 || goals <= 0) return 0
  return perGoal * Math.min(goals, GOAL_MAX_GOALS)
}

export const goalAmount = (amount: number, unit: string) => `${amount.toLocaleString('tr-TR')} ${unit}`

/** The sponsor's condition as short lines for the card: what the member has to do before the reward counts. */
export function goalConditions(e: Pick<GoalEvent, 'category' | 'viaLink' | 'minBet' | 'terms' | 'siteName'>): string[] {
  if (e.category !== 'sponsor') return e.terms ? [e.terms] : []
  const out: string[] = []
  if (e.viaLink) out.push(`${e.siteName ?? 'Sponsor'} üyeliğini Alkanka linkiyle açmış olmalısın.`)
  if (e.minBet) out.push(`Maça en az ${e.minBet} bahis yapmış olmalısın.`)
  if (e.terms) out.push(e.terms)
  return out
}

export function goalStatusLabel(m: Pick<GoalMatch, 'status' | 'kickoff'>, now: number) {
  if (m.status === 'void') return 'İptal edildi'
  if (m.status === 'settled') return 'Sonuçlandı'
  return Date.parse(m.kickoff) > now ? 'Seçime açık' : 'Sonuç bekleniyor'
}

export const GOAL_APPROVAL_LABEL: Record<GoalApproval, string> = { pending: 'Şart bekliyor', approved: 'Şart onaylandı', rejected: 'Şart sağlanmadı' }

/**
 * Where one pick stands, in the words the panel and the Excel file both use. A payment marked as failed
 * is never called paid, and a member whose condition was refused is not waiting for a delivery.
 */
export function goalPickState(p: Pick<GoalPickRow, 'reward' | 'paid' | 'payError' | 'approval'>, sponsor: boolean, status: GoalStatus): string {
  if (status === 'void') return 'İptal'
  if (p.reward === null) return 'Sonuç bekleniyor'
  if (p.reward === 0) return 'Ödül yok'
  if (!sponsor) return p.payError ? 'Yazılamadı' : p.paid ? 'Ödendi' : 'Sırada'
  if (p.paid) return 'Teslim edildi'
  return p.approval === 'rejected' ? 'Verilmeyecek' : p.approval === 'approved' ? 'Teslim bekliyor' : 'Şart onayı bekliyor'
}

/** What a match owes and what has really gone out. Refused picks and failed payments count as neither. */
export function goalPickTotals(picks: GoalPickRow[], sponsor: boolean) {
  const sum = (list: GoalPickRow[]) => list.reduce((s, p) => s + (p.reward ?? 0), 0)
  const owed = picks.filter((p) => (p.reward ?? 0) > 0 && !(sponsor && p.approval === 'rejected'))
  return {
    owed: sum(owed),
    done: sum(owed.filter((p) => p.paid && !p.payError)),
    refused: sum(picks.filter((p) => sponsor && p.approval === 'rejected')),
    failed: picks.filter((p) => !sponsor && p.payError).length,
  }
}

function cell(value: string | number | null) {
  let out = value === null ? '' : String(value)
  // A cell starting with = + - @ runs as a formula in Excel.
  if (/^[=+\-@\t\r]/.test(out)) out = `'${out}`
  return `"${out.replace(/"/g, '""')}"`
}

/** Semicolon separated with a BOM: opens in Turkish Excel with the right columns and letters. */
export function goalPicksCsv(match: Pick<GoalMatch, 'home' | 'away' | 'status'>, unit: string, sponsor: boolean, picks: GoalPickRow[]) {
  const head = ['Üye', ...(sponsor ? ['Sponsordaki kullanıcı adı', 'Şart'] : []), 'Seçtiği takım', 'Gol', `Ödül (${unit})`, sponsor ? 'Teslim' : 'Ödeme', 'Seçim zamanı']
  const lines = picks.map((p) =>
    [
      p.userName,
      ...(sponsor ? [p.siteUsername, GOAL_APPROVAL_LABEL[p.approval]] : []),
      p.side === 'home' ? match.home : match.away,
      p.goals,
      p.reward,
      goalPickState(p, sponsor, match.status),
      new Date(p.at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }),
    ]
      .map(cell)
      .join(';'),
  )
  return `\uFEFF${[head.map(cell).join(';'), ...lines].join('\r\n')}`
}
