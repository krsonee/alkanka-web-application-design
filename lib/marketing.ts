import 'server-only'
import { rows, sql } from '@/lib/db'
import { ensureGrowth, hashNetwork } from '@/lib/growth'
import { listSites } from '@/lib/sites'
import {
  EARNING_MODELS,
  EARNING_STATUSES,
  EMPTY_TRACKING,
  TRACKING_RULES,
  type CampaignView,
  type EarningStatus,
  type EarningView,
  type TrackingSettings,
} from '@/lib/marketing-shared'

const RESERVED_SRC = new Set(['direkt', 'eski-uye', 'alkanka'])

let ready: Promise<unknown> | null = null
function ensureMarketing() {
  ready ??= (async () => {
    await ensureGrowth()
    await rows(sql`CREATE TABLE IF NOT EXISTS mkt_settings (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS campaigns (
      id serial PRIMARY KEY, code text NOT NULL UNIQUE, name text NOT NULL, channel text NOT NULL DEFAULT 'diger',
      target text NOT NULL DEFAULT '/', cost numeric NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS campaign_visits (
      id bigserial PRIMARY KEY, campaign_id integer NOT NULL, ip_hash text, created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE INDEX IF NOT EXISTS campaign_visits_c_time ON campaign_visits (campaign_id, created_at)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS aff_earnings (
      id serial PRIMARY KEY, site_id integer NOT NULL, period text NOT NULL, model text NOT NULL DEFAULT 'cpa',
      ftd integer NOT NULL DEFAULT 0, amount numeric NOT NULL DEFAULT 0, currency text NOT NULL DEFAULT 'TRY',
      status text NOT NULL DEFAULT 'pending', note text NOT NULL DEFAULT '', claimed_at timestamptz, paid_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE INDEX IF NOT EXISTS link_clicks_src ON link_clicks (src)`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null)

// --- Tracking tags ------------------------------------------------------------

export async function getTracking(): Promise<TrackingSettings> {
  if (!process.env.DATABASE_URL) return EMPTY_TRACKING
  await ensureMarketing()
  const r = await rows<{ value: Partial<TrackingSettings> }>(sql`SELECT value FROM mkt_settings WHERE key = 'tracking'`)
  return { ...EMPTY_TRACKING, ...(r[0]?.value ?? {}) }
}

export async function saveTracking(input: TrackingSettings) {
  await ensureMarketing()
  const clean = { ...EMPTY_TRACKING }
  for (const key of Object.keys(TRACKING_RULES) as (keyof TrackingSettings)[]) {
    const raw = String(input[key] ?? '').trim()
    const value = key === 'ga4Id' || key === 'adsId' ? raw.toUpperCase() : raw
    if (value && !TRACKING_RULES[key].re.test(value)) {
      throw new Error(`${TRACKING_RULES[key].label} hatalı. Örnek biçim: ${TRACKING_RULES[key].example}`)
    }
    clean[key] = value
  }
  if ((clean.adsSignupLabel || clean.adsSponsorLabel) && !clean.adsId) throw new Error('Dönüşüm etiketi için önce Google Ads etiket kimliğini (AW-...) gir.')
  await rows(sql`INSERT INTO mkt_settings (key, value) VALUES ('tracking', ${JSON.stringify(clean)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`)
  return clean
}

// --- Campaign links -----------------------------------------------------------

export function cleanCampaignCode(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

function cleanTarget(value: string) {
  const t = value.trim() || '/'
  if (!t.startsWith('/') || t.startsWith('//') || !/^\/[A-Za-z0-9\-/_.?=&%]*$/.test(t)) {
    throw new Error('Hedef sayfa sitemizin içinden olmalı, örneğin /turnuvalar ya da /git/site-adi')
  }
  return t.slice(0, 200)
}

export type CampaignInput = { id?: number; code: string; name: string; channel: string; target: string; cost: number; active: boolean }

export async function saveCampaign(input: CampaignInput) {
  await ensureMarketing()
  const code = cleanCampaignCode(input.code)
  if (code.length < 2) throw new Error('Kampanya kodu en az 2 karakter olmalı (harf, rakam, -).')
  if (RESERVED_SRC.has(code)) throw new Error('Bu kod sistem tarafından kullanılıyor, başka bir kod seç.')
  const name = input.name.trim().slice(0, 80)
  if (!name) throw new Error('Kampanyaya bir ad ver.')
  const channel = input.channel.trim().slice(0, 24) || 'diger'
  const target = cleanTarget(input.target)
  const cost = Number.isFinite(Number(input.cost)) ? Math.max(0, Math.min(1e9, Number(input.cost))) : 0
  const taken = await rows(sql`SELECT id FROM campaigns WHERE code = ${code}`)
  if (taken.some((t) => Number(t.id) !== input.id)) throw new Error('Bu kod başka bir kampanyada kullanılıyor.')
  if (input.id) {
    const r = await rows(sql`UPDATE campaigns SET code = ${code}, name = ${name}, channel = ${channel}, target = ${target},
      cost = ${cost}, active = ${Boolean(input.active)} WHERE id = ${input.id} RETURNING id`)
    if (!r.length) throw new Error('Kampanya bulunamadı.')
    return { id: input.id, code }
  }
  const r = await rows(sql`INSERT INTO campaigns (code, name, channel, target, cost, active)
    VALUES (${code}, ${name}, ${channel}, ${target}, ${cost}, ${Boolean(input.active)}) RETURNING id`)
  return { id: Number(r[0].id), code }
}

export async function deleteCampaign(id: number) {
  await ensureMarketing()
  await rows(sql`DELETE FROM campaigns WHERE id = ${id}`)
  await rows(sql`DELETE FROM campaign_visits WHERE campaign_id = ${id}`)
}

export async function listCampaigns(): Promise<CampaignView[]> {
  await ensureMarketing()
  const list = await rows(sql`SELECT * FROM campaigns ORDER BY active DESC, created_at DESC`)
  if (!list.length) return []
  const codes = sql.join(list.map((c) => sql`${String(c.code)}`), sql`, `)
  const ids = sql.join(list.map((c) => sql`${Number(c.id)}`), sql`, `)
  const [visits, daily, signups, clicks] = await Promise.all([
    rows(sql`SELECT campaign_id, count(*) AS n, count(DISTINCT ip_hash) AS u,
        count(*) FILTER (WHERE created_at > now() - interval '7 days') AS w
      FROM campaign_visits WHERE campaign_id IN (${ids}) GROUP BY campaign_id`),
    rows(sql`SELECT campaign_id, (now()::date - (created_at AT TIME ZONE 'Europe/Istanbul')::date) AS ago, count(*) AS n
      FROM campaign_visits WHERE campaign_id IN (${ids}) AND created_at > now() - interval '14 days' GROUP BY campaign_id, ago`),
    rows(sql`SELECT src, count(*) AS n FROM member_origin WHERE src IN (${codes}) GROUP BY src`),
    rows(sql`SELECT src, count(*) AS n FROM link_clicks WHERE src IN (${codes}) GROUP BY src`),
  ])
  const vMap = new Map(visits.map((v) => [Number(v.campaign_id), v]))
  const sMap = new Map(signups.map((s) => [String(s.src), Number(s.n)]))
  const cMap = new Map(clicks.map((s) => [String(s.src), Number(s.n)]))
  return list.map((c) => {
    const id = Number(c.id)
    const code = String(c.code)
    const v = vMap.get(id)
    const days = Array<number>(14).fill(0)
    for (const d of daily) {
      const ago = Number(d.ago)
      if (Number(d.campaign_id) === id && ago >= 0 && ago < 14) days[13 - ago] += Number(d.n)
    }
    return {
      id,
      code,
      name: String(c.name),
      channel: String(c.channel),
      target: String(c.target),
      cost: Number(c.cost),
      active: Boolean(c.active),
      createdAt: iso(c.created_at) ?? '',
      visits: Number(v?.n ?? 0),
      uniques: Number(v?.u ?? 0),
      week: Number(v?.w ?? 0),
      signups: sMap.get(code) ?? 0,
      sponsorClicks: cMap.get(code) ?? 0,
      daily: days,
    }
  })
}

/** Resolves /k/{code}, records a human visit and returns the internal path to land on. */
export async function hitCampaign(code: string, ip: string | null, isBot: boolean) {
  await ensureMarketing()
  const r = await rows(sql`SELECT id, code, channel, target FROM campaigns WHERE code = ${cleanCampaignCode(code)} AND active LIMIT 1`)
  const c = r[0]
  if (!c) return null
  if (!isBot) {
    await rows(sql`INSERT INTO campaign_visits (campaign_id, ip_hash) VALUES (${Number(c.id)}, ${hashNetwork(ip)})`).catch((error) =>
      console.error('[k] ziyaret kaydedilemedi', error),
    )
  }
  return { code: String(c.code), channel: String(c.channel), target: String(c.target) }
}

// --- Affiliate earnings -------------------------------------------------------

export type EarningInput = { id?: number; siteId: number; period: string; model: string; ftd: number; amount: number; currency: string; note: string }

export async function saveEarning(input: EarningInput) {
  await ensureMarketing()
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.period)) throw new Error('Dönem YYYY-AA biçiminde olmalı, örneğin 2026-10.')
  if (!(await listSites()).some((s) => s.id === Number(input.siteId))) throw new Error('Sponsor seç.')
  const model = EARNING_MODELS.some((m) => m.id === input.model) ? input.model : 'cpa'
  const ftd = Math.max(0, Math.min(1e6, Math.trunc(Number(input.ftd) || 0)))
  const amount = Math.max(0, Math.min(1e10, Number(input.amount) || 0))
  const currency = ['TRY', 'USD', 'EUR', 'USDT'].includes(input.currency) ? input.currency : 'TRY'
  const note = input.note.trim().slice(0, 400)
  if (input.id) {
    const r = await rows(sql`UPDATE aff_earnings SET site_id = ${Number(input.siteId)}, period = ${input.period}, model = ${model},
      ftd = ${ftd}, amount = ${amount}, currency = ${currency}, note = ${note}, updated_at = now() WHERE id = ${input.id} RETURNING id`)
    if (!r.length) throw new Error('Kayıt bulunamadı.')
    return
  }
  await rows(sql`INSERT INTO aff_earnings (site_id, period, model, ftd, amount, currency, note)
    VALUES (${Number(input.siteId)}, ${input.period}, ${model}, ${ftd}, ${amount}, ${currency}, ${note})`)
}

export async function setEarningStatus(id: number, status: EarningStatus) {
  await ensureMarketing()
  if (!EARNING_STATUSES.some((s) => s.id === status)) throw new Error('Geçersiz durum.')
  await rows(sql`UPDATE aff_earnings SET status = ${status}, updated_at = now(),
      claimed_at = CASE WHEN ${status} = 'claimed' AND claimed_at IS NULL THEN now() ELSE claimed_at END,
      paid_at = CASE WHEN ${status} = 'paid' THEN now() WHEN ${status} <> 'paid' THEN NULL ELSE paid_at END
    WHERE id = ${id}`)
}

export async function deleteEarning(id: number) {
  await ensureMarketing()
  await rows(sql`DELETE FROM aff_earnings WHERE id = ${id}`)
}

export async function listEarnings(): Promise<EarningView[]> {
  await ensureMarketing()
  const [list, sites] = await Promise.all([rows(sql`SELECT * FROM aff_earnings ORDER BY period DESC, updated_at DESC LIMIT 300`), listSites()])
  const names = new Map(sites.map((s) => [s.id, s.name]))
  const clicks = await rows(sql`SELECT site_id, to_char(created_at AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM') AS period, count(*) AS n
    FROM link_clicks WHERE created_at > now() - interval '400 days' GROUP BY site_id, period`)
  const cMap = new Map(clicks.map((c) => [`${c.site_id}:${c.period}`, Number(c.n)]))
  return list.map((e) => ({
    id: Number(e.id),
    siteId: Number(e.site_id),
    siteName: names.get(Number(e.site_id)) ?? `#${e.site_id}`,
    period: String(e.period),
    model: String(e.model),
    ftd: Number(e.ftd),
    amount: Number(e.amount),
    currency: String(e.currency),
    status: (EARNING_STATUSES.some((s) => s.id === e.status) ? e.status : 'pending') as EarningStatus,
    note: String(e.note ?? ''),
    claimedAt: iso(e.claimed_at),
    paidAt: iso(e.paid_at),
    clicks: cMap.get(`${e.site_id}:${e.period}`) ?? 0,
  }))
}
