import 'server-only'
import { rows, sql } from '@/lib/db'
import { listPosts } from '@/lib/blog'

export type HealthIssue = { level: 'hata' | 'uyari'; target: string; href: string; message: string }
export type NotFoundHit = { path: string; hits: number; referrer: string; lastSeen: string }
export type Redirect = { from: string; to: string; createdAt: string }

let ready: Promise<unknown> | null = null
function ensureSeoTables() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS seo_redirects (from_path text PRIMARY KEY, to_path text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS seo_404 (path text PRIMARY KEY, hits integer NOT NULL DEFAULT 1, referrer text NOT NULL DEFAULT '', last_seen timestamptz NOT NULL DEFAULT now())`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

export function normalizePath(value: string) {
  let path = value.trim()
  try {
    if (/^https?:\/\//i.test(path)) path = new URL(path).pathname
  } catch {
    return ''
  }
  if (!path.startsWith('/')) path = `/${path}`
  path = path.split(/[?#]/)[0].replace(/\/+$/, '')
  return (path || '/').slice(0, 300)
}

const IGNORED_404 = /\.(php|env|asp|aspx|jsp|cgi|sql|bak|zip|xml\.gz)$|^\/(wp-|\.well-known|cgi-bin|vendor)/i

export async function log404(rawPath: string, referrer: string) {
  // Preview/dev servers share the production database; their compile-time 404s would pollute the report.
  if (process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'preview') return
  const path = normalizePath(rawPath)
  if (!path || path === '/' || IGNORED_404.test(path)) return
  await ensureSeoTables()
  const ref = referrer.slice(0, 300)
  await rows(sql`INSERT INTO seo_404 (path, referrer) VALUES (${path}, ${ref})
    ON CONFLICT (path) DO UPDATE SET hits = seo_404.hits + 1, last_seen = now(),
    referrer = CASE WHEN ${ref} <> '' THEN ${ref} ELSE seo_404.referrer END`)
}

export async function list404(limit = 50): Promise<NotFoundHit[]> {
  await ensureSeoTables()
  const data = await rows<{ path: string; hits: number; referrer: string; last_seen: string }>(
    sql`SELECT n.path, n.hits, n.referrer, n.last_seen FROM seo_404 n
      WHERE NOT EXISTS (SELECT 1 FROM seo_redirects r WHERE r.from_path = n.path)
      ORDER BY n.hits DESC, n.last_seen DESC LIMIT ${limit}`,
  )
  return data.map((r) => ({ path: r.path, hits: Number(r.hits), referrer: r.referrer, lastSeen: new Date(r.last_seen).toISOString() }))
}

export async function clear404(path: string) {
  await ensureSeoTables()
  await rows(sql`DELETE FROM seo_404 WHERE path = ${path}`)
}

export async function listRedirects(): Promise<Redirect[]> {
  await ensureSeoTables()
  const data = await rows<{ from_path: string; to_path: string; created_at: string }>(
    sql`SELECT from_path, to_path, created_at FROM seo_redirects ORDER BY created_at DESC LIMIT 500`,
  )
  return data.map((r) => ({ from: r.from_path, to: r.to_path, createdAt: new Date(r.created_at).toISOString() }))
}

export async function saveRedirect(fromRaw: string, toRaw: string) {
  const from = normalizePath(fromRaw)
  const to = /^https?:\/\//i.test(toRaw.trim()) ? toRaw.trim().slice(0, 500) : normalizePath(toRaw)
  if (!from || from === '/') throw new Error('Eski adres geçerli değil.')
  if (!to) throw new Error('Yeni adres geçerli değil.')
  if (from === to) throw new Error('Eski ve yeni adres aynı olamaz.')
  if (/^\/(panel|api|_next|git|r|k)(\/|$)/.test(from)) throw new Error('Bu adres sistem tarafından kullanılıyor.')
  await ensureSeoTables()
  await rows(sql`INSERT INTO seo_redirects (from_path, to_path) VALUES (${from}, ${to})
    ON CONFLICT (from_path) DO UPDATE SET to_path = EXCLUDED.to_path`)
  await rows(sql`DELETE FROM seo_404 WHERE path = ${from}`)
}

export async function deleteRedirect(from: string) {
  await ensureSeoTables()
  await rows(sql`DELETE FROM seo_redirects WHERE from_path = ${from}`)
}

const words = (text: string) => text.replace(/[#*>\-[\]()?]/g, ' ').split(/\s+/).filter(Boolean).length

export async function seoHealth(): Promise<HealthIssue[]> {
  const posts = (await listPosts({ includeDrafts: false })).filter((p) => p.published)
  const issues: HealthIssue[] = []
  const titles = new Map<string, string>()

  if (posts.length === 0) {
    issues.push({ level: 'hata', target: 'Rehber', href: '/rehber', message: 'Hiç yayında yazı yok. Google’a sıralanacak içerik vermek için ilk yazıyı yayınla.' })
  } else if (posts.length < 10) {
    issues.push({ level: 'uyari', target: 'Rehber', href: '/rehber', message: `Sadece ${posts.length} yazı var. İlk hedef 10+ kaliteli yazı.` })
  }

  for (const p of posts) {
    const target = p.title
    const href = `/rehber/${p.slug}`
    const add = (level: HealthIssue['level'], message: string) => issues.push({ level, target, href, message })
    const count = words(p.body)

    if (p.title.length > 60) add('uyari', `Başlık ${p.title.length} karakter. Google 60 karakterden sonrasını keser.`)
    if (p.title.length < 25) add('uyari', 'Başlık çok kısa. Odak kelimeyi ve bir fayda ekle.')
    if (!p.excerpt.trim()) add('hata', 'Özet (meta açıklama) boş. Google kendi seçtiği rastgele bir cümleyi gösterir.')
    else if (p.excerpt.length > 160) add('uyari', `Özet ${p.excerpt.length} karakter, 155 civarına indir.`)
    else if (p.excerpt.length < 70) add('uyari', 'Özet çok kısa, 120–155 karakter ideal.')
    if (count < 300) add('hata', `Yazı sadece ${count} kelime. Google bunu “zayıf içerik” sayar, en az 800 kelime hedefle.`)
    else if (count < 800) add('uyari', `Yazı ${count} kelime. 1200+ kelime rekabetçi kelimelerde çok daha iyi sıralanır.`)
    if (!p.cover) add('uyari', 'Kapak görseli yok. Paylaşımlarda ve Google Görsellerde görünmez.')
    if (!p.keywords.trim()) add('uyari', 'Odak kelime girilmemiş.')
    if (!/\]\(\/(?!\/)/.test(p.body)) add('uyari', 'Yazıda hiç iç link yok. Bir sponsor ya da başka bir rehber yazısına link ver.')
    if (!/^##\s/m.test(p.body)) add('uyari', 'Ara başlık (##) yok. Uzun yazıyı bölümlere ayır.')

    const key = p.title.trim().toLocaleLowerCase('tr')
    const dup = titles.get(key)
    if (dup) add('hata', `Aynı başlık başka bir yazıda da var (/rehber/${dup}). Google ikisini birbirine rakip görür.`)
    else titles.set(key, p.slug)

    const age = Date.now() - new Date(p.updatedAt).getTime()
    if (age > 1000 * 60 * 60 * 24 * 180) add('uyari', '6 aydır güncellenmemiş. Bilgileri tazele, tarih otomatik güncellenir.')
  }

  try {
    const missing = await list404(200)
    const hot = missing.filter((m) => m.hits >= 3)
    if (hot.length) {
      issues.push({ level: 'hata', target: '404 sayfaları', href: '#yonlendirme', message: `${hot.length} kırık adrese tekrar tekrar giriliyor. Aşağıdan yönlendirme ekle.` })
    }
  } catch {}

  return issues.sort((a, b) => (a.level === b.level ? 0 : a.level === 'hata' ? -1 : 1))
}
