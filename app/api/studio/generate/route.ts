import { NextResponse, type NextRequest } from 'next/server'
import { canPanel } from '@/lib/admin-auth'
import { logPanel } from '@/lib/panel-log'
import { rejectCrossSite } from '@/lib/same-origin'
import { addJob, assetsByIds, getBrand, getJob, readFile, storeFile } from '@/lib/studio'
import { briefLabel, briefProblem, briefText, cleanBrief } from '@/lib/studio-brief'
import { budgetBlock } from '@/lib/studio-budget'
import { runGeneration } from '@/lib/studio-generate'
import { applyOverlay, brushOf } from '@/lib/studio-overlay'
import { cleanTexts, imageCost, STUDIO_CATEGORIES, STUDIO_FORMATS, toImageSize, type StudioTexts } from '@/lib/studio-types'

export const maxDuration = 300

const retextLabel = (texts: StudioTexts | null) =>
  texts ? `Yazı güncellendi: ${[texts.headline, texts.subline, texts.cta].filter(Boolean).join(' · ')}` : 'Yazılar kaldırıldı'

export async function POST(request: NextRequest) {
  const crossSite = rejectCrossSite(request)
  if (crossSite) return crossSite
  if (!(await canPanel('studio'))) return NextResponse.json({ error: 'Oturum süresi doldu, tekrar giriş yap.' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })

  const kind = body.kind === 'sticker' ? 'sticker' : 'banner'
  const format = STUDIO_FORMATS.some((f) => f.id === body.format) ? String(body.format) : '1:1'
  const category = STUDIO_CATEGORIES.find((c) => c === body.category) ?? STUDIO_CATEGORIES[0]
  // New pictures come from the form's fields; a revision is a free instruction about one picture.
  const brief = body.brief && typeof body.brief === 'object' ? cleanBrief(body.brief) : null
  const prompt = brief ? briefText(brief) : String(body.prompt ?? '').trim().slice(0, 1500)

  const brandId = Number.parseInt(String(body.brandId ?? ''), 10)
  const brand = Number.isFinite(brandId) ? await getBrand(brandId) : null
  const parentId = Number.parseInt(String(body.parentId ?? ''), 10)
  const parent = Number.isFinite(parentId) ? await getJob(parentId) : null
  // Stickers are scaled down to 512 px for Telegram, so a larger render would be wasted.
  const size = kind === 'sticker' ? '1K' : toImageSize(body.size)
  // A revision that sends no copy at all keeps the parent's; an explicit empty set removes it.
  const texts = kind === 'sticker' ? null : 'texts' in body ? cleanTexts(body.texts) : (parent?.texts ?? null)
  // Changing only the copy re-prints it on the stored text-free picture, with no model call.
  const retext = body.retext === true && kind === 'banner' && parent?.kind === 'banner' && Boolean(parent.cleanPathname)

  const problem = retext ? null : brief ? briefProblem(brief) : prompt.length < 5 ? 'Talimat en az 5 karakter olmalı.' : null
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })
  // A revised sticker already carries its edge, so a second one is never drawn on top of it.
  const outline = kind === 'sticker' && !parent && body.outline !== false
  const overCap = retext ? null : await budgetBlock(imageCost(size))
  if (overCap) return NextResponse.json({ error: overCap }, { status: 409 })

  try {
    if (retext && parent) {
      const data = await applyOverlay(await readFile(parent.cleanPathname), brushOf(brand, texts))
      const job = await addJob({
        clean: parent.cleanPathname,
        brandId: brand?.id ?? null,
        kind,
        format: parent.format,
        prompt: retextLabel(texts),
        pathname: await storeFile('banners', data, 'image/png', 'png'),
        parentId: parent.id,
        cost: 0,
        texts,
      })
      await logPanel('studio', 'Görselin yazısı değiştirildi', brand?.name || null, `Görsel #${job.id}`)
      return NextResponse.json({ job: { ...job, brandName: brand?.name ?? '' } })
    }

    const mascot = body.useMascot === true && brand?.mascot ? await readFile(brand.mascot) : null
    const assetIds = (Array.isArray(body.assetIds) ? body.assetIds : [])
      .map((v) => Number.parseInt(String(v), 10))
      .filter(Number.isFinite)
      .slice(0, 3)
    const assetRefs = await Promise.all((await assetsByIds(assetIds)).map(readFile))
    const references = mascot ? [mascot, ...assetRefs] : assetRefs
    const revisionOf = parent?.cleanPathname ? await readFile(parent.cleanPathname) : parent ? await readFile(parent.pathname) : null
    const result = await runGeneration({
      kind,
      format,
      category,
      prompt,
      brand,
      references,
      revisionOf,
      mascot: Boolean(mascot),
      texts,
      size,
      style: brief?.style,
      palette: brief?.colors,
      caption: kind === 'sticker' ? brief?.caption : '',
      outline,
    })
    const shown = brief ? briefLabel(brief) : prompt
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
      prompt: shown,
      pathname,
      parentId: parent?.id ?? null,
      cost: imageCost(size),
      texts,
    })
    await logPanel('studio', 'Görsel üretildi', brand?.name || null, `Görsel #${job.id} · ${shown.slice(0, 200)}`)
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
