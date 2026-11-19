import 'server-only'
import { listAffLinks } from '@/lib/aff-links'
import { rows, sql } from '@/lib/db'
import { getShortDomain } from '@/lib/links'
import { shortUrl } from '@/lib/links-shared'
import { ensureMarketing, saveCampaign } from '@/lib/marketing'
import { recordCodeBase, recordPath, type RecordKind } from '@/lib/record-links'
import { SITE_URL } from '@/lib/seo'

const MAX_TRIES = 50

/**
 * The short link of one record's own page. A record keeps one link: asking again hands back the one already made,
 * so its clicks stay on a single row of the Linkler report.
 */
export async function recordShortLink(kind: RecordKind, id: string | number, name: string) {
  await ensureMarketing()
  const target = recordPath(kind, id)
  const [campaigns, affLinks, shortDomain] = await Promise.all([
    rows<{ code: string; target: string; active: boolean }>(sql`SELECT code, target, active FROM campaigns ORDER BY id`),
    listAffLinks(),
    getShortDomain(),
  ])
  const affCodes = new Set(affLinks.map((l) => l.code))
  const address = (code: string) => shortUrl({ kind: 'sayfa', code, path: `/k/${code}`, clash: affCodes.has(code) }, SITE_URL, shortDomain)

  const existing = campaigns.find((c) => c.target === target && c.active)
  if (existing) return { url: address(String(existing.code)), code: String(existing.code), created: false }

  const taken = new Set([...campaigns.map((c) => String(c.code)), ...affCodes])
  const base = recordCodeBase(kind, id)
  let code = base
  for (let n = 2; taken.has(code); n++) {
    if (n > MAX_TRIES) throw new Error('Bu kayıt için boş bir kısa kod bulunamadı. Büyüme → Linkler ekranından elle bir kod ver.')
    code = `${base}-${n}`
  }
  await saveCampaign({ code, name: name.trim().slice(0, 80) || target, channel: 'diger', target, cost: 0, active: true })
  return { url: address(code), code, created: true }
}
