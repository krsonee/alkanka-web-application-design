import 'server-only'
import { generateText } from 'ai'
import type { ParsedOdd } from '@/lib/deal-types'
import { declaresOdd, groundedOdds, localNote, localOdds } from '@/lib/odds-post'

const PARSE_MODEL = 'google/gemini-3.5-flash'
const ANSWER_LIMIT_MS = 20_000

/** What a post is: a fresh odd, the outcome of an earlier one, or anything else (campaign, notice). */
export type OddsPostKind = 'oran' | 'sonuc' | 'diger'

export type OddsReading = {
  odds: ParsedOdd[]
  /** The reader could not be reached and the post could not be read without it either. */
  failed: boolean
  kind: OddsPostKind
  /** Whether the matches are one combined coupon. Null when the reader did not say. */
  coupon: boolean | null
  /** Who can take the odd, as the source wrote it. */
  note: string
}

export type OddsImage = { data: Uint8Array; mediaType: string }

const toNumber = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) && n > 1 && n < 100_000 ? Math.round(n * 100) / 100 : null
}
const toText = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

function sanitize(raw: unknown): ParsedOdd[] {
  if (!Array.isArray(raw)) return []
  const out: ParsedOdd[] = []
  for (const item of raw.slice(0, 12)) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const match = toText(r.match, 80)
    const newOdd = toNumber(r.newOdd)
    if (!match || !newOdd) continue
    const oldOdd = toNumber(r.oldOdd)
    out.push({
      match,
      league: toText(r.league, 40),
      market: toText(r.market, 60),
      oldOdd: oldOdd && oldOdd < newOdd ? oldOdd : null,
      newOdd,
      kickoff: toText(r.kickoff, 40),
      limit: toText(r.limit, 40),
    })
  }
  return out
}

const task = (text: string, withPicture: boolean) => `Aşağıda bir bahis sitesinin Telegram kanalındaki bir post var${withPicture ? ' (görseli ekte)' : ''}.
Önce postun ne olduğuna karar ver:
- "oran": belirli bir maç (ya da birleşik kupon) için yeni duyurulan özel/artırılmış oran.
- "sonuc": daha önce duyurulmuş bir oranın sonucu ya da kapanışı (kazandı, kaybetti, iade, limit doldu).
- "diger": geri kalan her şey. Freespin, freebet, bonus, kod, kasa, turnuva, çekiliş, yatırım kampanyası, güvenlik uyarısı ve genel duyurular
  içinde sayı, "oran" kelimesi ya da "A - B" biçiminde bir satır geçse bile "diger"dir.

Sadece şu biçimde tek bir JSON nesnesi döndür, açıklama yazma:
{"kind":"oran|sonuc|diger","coupon":true|false,"note":"","odds":[{"match":"","league":"","market":"","oldOdd":null,"newOdd":0,"kickoff":"","limit":""}]}

Alanlar:
- match: "Ev Sahibi - Deplasman". ${withPicture ? 'Yazıda yoksa görselden oku.' : 'Sadece yazıda geçen takımları yaz, tahmin etme.'}
- league: lig adı, yoksa "". market: bahis türü (ör. "Maç Sonucu 1", "Karşılıklı Gol - Evet").
- oldOdd: eski/normal oran, yoksa null. newOdd: özel/yeni oran. Para tutarlarını (₺, TL) oran sanma.
- kickoff: tarih-saat metni, yoksa "". limit: en yüksek bahis tutarı (ör. "1.000₺"), yoksa "".
- coupon: maçlar tek bir birleşik kuponsa ve tek bir toplam oran veriliyorsa true; her maçın kendi oranı varsa false.
  Birleşik kuponda her maça aynı toplam oranı yaz.
- note: orandan kimlerin yararlanabileceğini anlatan şart (ör. "Gün içinde 5.000₺ ve üzeri yatırımı olanlara özel"), tek cümle, yoksa "".
- kind "oran" değilse odds boş dizi olsun.

POST:
${text.slice(0, 3000)}`

type Answer = Pick<OddsReading, 'odds' | 'kind' | 'coupon' | 'note'>

function parseAnswer(answer: string): Answer | null {
  const start = answer.search(/[[{]/)
  if (start < 0) return null
  const isList = answer[start] === '['
  const end = answer.lastIndexOf(isList ? ']' : '}')
  if (end <= start) return null
  let data: unknown
  try {
    data = JSON.parse(answer.slice(start, end + 1))
  } catch {
    return null
  }
  if (Array.isArray(data)) {
    const odds = sanitize(data)
    return { odds, kind: odds.length ? 'oran' : 'diger', coupon: null, note: '' }
  }
  if (!data || typeof data !== 'object') return null
  const r = data as Record<string, unknown>
  const kind: OddsPostKind = r.kind === 'oran' || r.kind === 'sonuc' ? r.kind : 'diger'
  return {
    odds: kind === 'oran' ? sanitize(r.odds) : [],
    kind,
    coupon: typeof r.coupon === 'boolean' ? r.coupon : null,
    note: toText(r.note, 200),
  }
}

type Part = { type: 'text'; text: string } | { type: 'file'; data: Uint8Array; mediaType: string }

/** Null when the reader gave no usable answer. */
async function ask(content: Part[]): Promise<Answer | null> {
  try {
    const { text } = await generateText({
      model: PARSE_MODEL,
      messages: [{ role: 'user', content }],
      abortSignal: AbortSignal.timeout(ANSWER_LIMIT_MS),
    })
    return parseAnswer(text)
  } catch (error) {
    console.error('[odds] post çözümlenemedi', error)
    return null
  }
}

export async function parseOddsPost(text: string): Promise<ParsedOdd[]> {
  return (await readOddsPost(text)).odds
}

/**
 * Reads a post. The picture is only looked at when the text says it is an odd but names no match,
 * which is how some sources post (the match is drawn on the card). Without the reader the post is
 * read by rule; `failed` then tells "could not be read" apart from "has no odds".
 */
export async function readOddsPost(text: string, picture?: () => Promise<OddsImage | null>): Promise<OddsReading> {
  const read = await ask([{ type: 'text', text: task(text, false) }])
  if (!read) {
    const odds = localOdds(text)
    return { odds, failed: !odds.length, kind: odds.length ? 'oran' : 'diger', coupon: null, note: odds.length ? localNote(text) : '' }
  }
  const odds = groundedOdds(text, read.odds)
  if (odds.length) return { ...read, odds, failed: false }
  const none: OddsReading = { odds: [], failed: false, kind: read.kind === 'oran' ? 'diger' : read.kind, coupon: null, note: '' }
  if (!picture || read.kind === 'sonuc' || !declaresOdd(text)) return none

  const image = await picture().catch(() => null)
  if (!image) return none
  const seen = await ask([
    { type: 'file', data: image.data, mediaType: image.mediaType },
    { type: 'text', text: task(text, true) },
  ])
  return seen?.odds.length ? { ...seen, failed: false } : none
}
