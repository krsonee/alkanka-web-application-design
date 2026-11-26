import { NextResponse, type NextRequest } from 'next/server'
import { canPanel, isPanelOwner } from '@/lib/admin-auth'
import { addMotionStyle, deleteMotionStyle } from '@/lib/motion/styles'
import { studyExample, type ExampleSource } from '@/lib/motion/study'
import { logPanel } from '@/lib/panel-log'
import { assertPublicUrl, InsideAddressError } from '@/lib/public-address'
import { rejectCrossSite } from '@/lib/same-origin'
import { storeFile } from '@/lib/studio'

export const maxDuration = 120

const EXPIRED = { error: 'Oturum süresi doldu, tekrar giriş yap.' }
const MAX_BYTES = 25 * 1024 * 1024
const TYPES = ['image/gif', 'image/png', 'image/jpeg', 'image/webp']
const HOPS = 3
/** Frames the screen picked out of a GIF too heavy to send whole. */
const MAX_SHOTS = 16
const MAX_SHOT_BYTES = 1024 * 1024

/** An example given as a link. Every address on the way, redirects included, has to be a public one. */
async function fromLink(raw: string) {
  let address = raw
  for (let hop = 0; hop <= HOPS; hop++) {
    const url = await assertPublicUrl(address)
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'Mozilla/5.0 AlkankaStudio' } })
    const next = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null
    if (next) {
      address = new URL(next, url).toString()
      continue
    }
    if (!res.ok) throw new Error('Bu linkteki dosya açılamadı.')
    if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) throw new Error('Dosya 25 MB sınırını aşıyor.')
    const data = Buffer.from(await res.arrayBuffer())
    if (data.length > MAX_BYTES) throw new Error('Dosya 25 MB sınırını aşıyor.')
    return { data, name: url.pathname.split('/').pop() ?? '' }
  }
  throw new Error('Bu link çok fazla yönleniyor.')
}

export async function POST(request: NextRequest) {
  const crossSite = rejectCrossSite(request)
  if (crossSite) return crossSite
  if (!(await canPanel('studio'))) return NextResponse.json(EXPIRED, { status: 401 })

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  const link = String(form?.get('url') ?? '').trim()
  const shots = (form?.getAll('shot') ?? []).filter((shot): shot is File => shot instanceof File && shot.size > 0)
  try {
    let source: ExampleSource
    let fileName = String(form?.get('fileName') ?? '')
    if (shots.length) {
      if (shots.length > MAX_SHOTS || shots.some((shot) => shot.size > MAX_SHOT_BYTES || !TYPES.includes(shot.type))) return NextResponse.json({ error: 'Örnek okunamadı.' }, { status: 400 })
      source = { shots: await Promise.all(shots.map(async (shot) => Buffer.from(await shot.arrayBuffer()))), seconds: Number(form?.get('seconds')) || 0 }
    } else if (file instanceof File && file.size > 0) {
      if (!TYPES.includes(file.type)) return NextResponse.json({ error: 'Örnek GIF, PNG, JPG ya da WEBP olmalı.' }, { status: 400 })
      source = { file: Buffer.from(await file.arrayBuffer()) }
      fileName = file.name
    } else if (link) {
      const fetched = await fromLink(link)
      source = { file: fetched.data }
      fileName = fetched.name
    } else {
      return NextResponse.json({ error: 'Bir örnek dosya seç ya da linkini yapıştır.' }, { status: 400 })
    }
    const study = await studyExample(source, await isPanelOwner())
    const sheet = await storeFile('motion-examples', study.sheet, 'image/webp', 'webp')
    const typed = String(form?.get('name') ?? '').replace(/\s+/g, ' ').trim()
    const name = (typed || fileName.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim() || 'Örnek').slice(0, 60)
    const style = await addMotionStyle({ name, sheet, look: study.look, colors: study.colors, note: study.note, seconds: study.seconds })
    await logPanel('studio', 'Örnek banner incelendi', name, `Tarz #${style.id}${study.read ? '' : ' · sadece renkler ölçüldü'}`)
    return NextResponse.json({ style, read: study.read })
  } catch (error) {
    console.error('Motion example failed:', error)
    const known = error instanceof InsideAddressError || (error instanceof Error && /link|Dosya|okunamadı/.test(error.message))
    return NextResponse.json({ error: known ? (error as Error).message : 'Örnek incelenemedi. Dosya bozuk olabilir; başka bir dosyayla dene.' }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  const crossSite = rejectCrossSite(request)
  if (crossSite) return crossSite
  if (!(await canPanel('studio'))) return NextResponse.json(EXPIRED, { status: 401 })
  const id = Number.parseInt(request.nextUrl.searchParams.get('id') ?? '', 10)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Tarz bulunamadı.' }, { status: 400 })
  await deleteMotionStyle(id)
  await logPanel('studio', 'Örnek tarz silindi', `Tarz #${id}`)
  return NextResponse.json({ ok: true })
}
