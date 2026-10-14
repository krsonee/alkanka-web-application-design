import { NextResponse, type NextRequest } from 'next/server'
import { canPanel } from '@/lib/admin-auth'
import { addJob, assetsByIds, getBrand, getJob, readFile, storeFile } from '@/lib/studio'
import { runGeneration } from '@/lib/studio-generate'
import { IMAGE_COST, STUDIO_CATEGORIES, STUDIO_FORMATS } from '@/lib/studio-types'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  if (!(await canPanel('studio'))) return NextResponse.json({ error: 'Oturum süresi doldu, tekrar giriş yap.' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })

  const kind = body.kind === 'sticker' ? 'sticker' : 'banner'
  const format = STUDIO_FORMATS.some((f) => f.id === body.format) ? String(body.format) : '1:1'
  const category = STUDIO_CATEGORIES.find((c) => c === body.category) ?? STUDIO_CATEGORIES[0]
  const prompt = String(body.prompt ?? '').trim().slice(0, 1500)
  if (prompt.length < 5) return NextResponse.json({ error: 'Talimat en az 5 karakter olmalı.' }, { status: 400 })

  const brandId = Number.parseInt(String(body.brandId ?? ''), 10)
  const brand = Number.isFinite(brandId) ? await getBrand(brandId) : null
  const parentId = Number.parseInt(String(body.parentId ?? ''), 10)
  const parent = Number.isFinite(parentId) ? await getJob(parentId) : null
  const assetIds = (Array.isArray(body.assetIds) ? body.assetIds : [])
    .map((v) => Number.parseInt(String(v), 10))
    .filter(Number.isFinite)
    .slice(0, 3)

  try {
    const mascot = body.useMascot === true && brand?.mascot ? await readFile(brand.mascot) : null
    const assetRefs = await Promise.all((await assetsByIds(assetIds)).map(readFile))
    const references = mascot ? [mascot, ...assetRefs] : assetRefs
    const revisionOf = parent?.cleanPathname ? await readFile(parent.cleanPathname) : parent ? await readFile(parent.pathname) : null
    const result = await runGeneration({ kind, format, category, prompt, brand, references, revisionOf, mascot: Boolean(mascot) })
    const folder = kind === 'sticker' ? 'stickers' : 'banners'
    const [pathname, clean] = await Promise.all([
      storeFile(folder, result.data, result.contentType, result.ext),
      result.clean ? storeFile('clean', result.clean, 'image/png', 'png') : Promise.resolve(''),
    ])
    const job = await addJob({
      clean,
      brandId: brand?.id ?? null,
      kind,
      format: kind === 'sticker' ? '1:1' : format,
      prompt,
      pathname,
      parentId: parent?.id ?? null,
      cost: IMAGE_COST,
    })
    return NextResponse.json({ job: { ...job, brandName: brand?.name ?? '' } })
  } catch (error) {
    console.error('Studio generation failed:', error)
    const message = error instanceof Error ? error.message : ''
    const blocked = /safety|policy|blocked|refus/i.test(message)
    return NextResponse.json(
      { error: blocked ? 'Model bu talimatı reddetti. Metni biraz yumuşatıp tekrar dene.' : 'Üretim başarısız oldu, tekrar dene.' },
      { status: 500 },
    )
  }
}
