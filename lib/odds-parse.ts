import 'server-only'
import { generateText } from 'ai'
import type { ParsedOdd } from '@/lib/deal-types'

const PARSE_MODEL = 'google/gemini-3.5-flash'

const toNumber = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) && n >= 1 && n < 1000 ? Math.round(n * 100) / 100 : null
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

export async function parseOddsPost(text: string): Promise<ParsedOdd[]> {
  try {
    const { text: answer } = await generateText({
      model: PARSE_MODEL,
      prompt: `Aşağıdaki Telegram postu bir bahis sitesinin özel/artırılmış oran duyurusu olabilir.
Posttaki her maçı çıkar. Sadece JSON dizisi döndür, açıklama yazma.
Alanlar: match ("Ev Sahibi - Deplasman"), league (lig adı, yoksa ""), market (bahis türü, ör. "Maç sonucu 1", "2.5 Üst"),
oldOdd (eski/normal oran sayısı, yoksa null), newOdd (özel/yeni oran sayısı), kickoff (tarih-saat metni, yoksa ""), limit (maks. bahis, yoksa "").
Maç ya da oran yoksa [] döndür.

POST:
${text.slice(0, 3000)}`,
    })
    const json = answer.match(/\[[\s\S]*\]/)?.[0]
    return json ? sanitize(JSON.parse(json)) : []
  } catch (error) {
    console.error('[odds] post çözümlenemedi', error)
    return []
  }
}
