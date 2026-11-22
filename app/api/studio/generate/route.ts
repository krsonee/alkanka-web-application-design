import { NextResponse, type NextRequest } from 'next/server'
import { canPanel, isPanelOwner } from '@/lib/admin-auth'
import { logPanel } from '@/lib/panel-log'
import { rejectCrossSite } from '@/lib/same-origin'
import { addJob, assetsByIds, getBrand, getJob, readFile, storeFile } from '@/lib/studio'
import { briefLabel, briefProblem, briefText, cleanBrief } from '@/lib/studio-brief'
import { closeHold, holdBudget, type BudgetHold } from '@/lib/studio-budget'
import { direct } from '@/lib/studio-direct'
import { faultMessage, studioFault } from '@/lib/studio-fault'
import { runGeneration } from '@/lib/studio-generate'
import { applyOverlay, brushOf } from '@/lib/studio-overlay'
import { stickerOnGreen, whiteEdged } from '@/lib/studio-telegram'
import { cleanTexts, DIRECTION_COST, imageCost, STUDIO_CATEGORIES, STUDIO_TEXT_CEILING, STUDIO_FORMATS, toImageSize, type StudioTexts } from '@/lib/studio-types'

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
  const prompt = brief ? briefText(brief) : String(body.prompt ?? '').trim().slice(0, STUDIO_TEXT_CEILING)

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
  const owner = await isPanelOwner()
  const held = await holdBudget(retext ? 0 : imageCost(size), owner)
  if (held.error !== null) return NextResponse.json({ error: held.error }, { status: 409 })
  const hold = held.hold
  // A sticker that comes back cut off is drawn a second time; that call gets its own share of the cap.
  const second: { hold: BudgetHold | null } = { hold: null }
  // The art-direction step is a paid call of its own, so it has its own share of the cap.
  const planning: { hold: BudgetHold | null } = { hold: null }

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
    const chosen = await assetsByIds(assetIds)
    const assetRefs = await Promise.all(chosen.map((asset) => readFile(asset.pathname)))
    const references = mascot ? [mascot, ...assetRefs] : assetRefs
    const original = parent?.cleanPathname ? await readFile(parent.cleanPathname) : parent ? await readFile(parent.pathname) : null
    // A stored sticker is transparent; the model edits it on the green it is asked to hand back.
    const revisionOf = original && kind === 'sticker' ? await stickerOnGreen(original) : original
    const edged = original && kind === 'sticker' ? await whiteEdged(original) : false
    // The note is worked out in English and the copy settled before anything is drawn. When this
    // step cannot run, the picture is drawn from the note alone.
    const planned = await holdBudget(DIRECTION_COST, owner)
    planning.hold = planned.hold
    const direction =
      planned.error === null
        ? await direct({ kind, revision: Boolean(parent), brief: prompt, format, category, texts, caption: kind === 'sticker' ? (brief?.caption ?? '') : '', mascot: Boolean(mascot) })
        : null
    if (direction && planning.hold) planning.hold.billed = true
    const printed = direction ? direction.texts : texts
    const result = await runGeneration({
      scene: direction?.scene,
      redraw:
        kind === 'sticker'
          ? {
              allow: async () => {
                const more = await holdBudget(imageCost(size), owner)
                second.hold = more.hold
                return more.error === null
              },
              billed: () => {
                if (second.hold) second.hold.billed = true
              },
            }
          : undefined,
      onBilled: () => {
        hold.billed = true
      },
      kind,
      format,
      category,
      prompt: direction ? direction.note : prompt,
      brand,
      references,
      referenceRoles: chosen.map((asset) => asset.role),
      revisionOf,
      mascot: Boolean(mascot),
      texts: printed,
      size,
      style: brief?.style,
      palette: brief?.colors,
      caption: kind === 'sticker' ? direction?.caption || brief?.caption : '',
      outline,
      edged,
    })
    const redrawn = result.calls > 1
    const shown = `${brief ? briefLabel(brief) : prompt}${redrawn ? ' · kenardan taşan çizim bir kez yeniden çizildi' : ''}`
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
      cost: imageCost(size) * result.calls + (direction ? DIRECTION_COST : 0),
      texts: printed,
    })
    await closeHold(hold, 'recorded')
    if (second.hold) await closeHold(second.hold, redrawn ? 'recorded' : 'failed')
    if (planning.hold) await closeHold(planning.hold, direction ? 'recorded' : 'failed')
    await logPanel('studio', 'Görsel üretildi', brand?.name || null, `Görsel #${job.id} · ${shown.slice(0, 200)}`)
    return NextResponse.json({ job: { ...job, brandName: brand?.name ?? '' } })
  } catch (error) {
    console.error('Studio generation failed:', error)
    await closeHold(hold, 'failed', `Görsel kaydedilemedi (${kind}, ${size})`)
    if (second.hold) await closeHold(second.hold, 'failed', `Yeniden çizilen sticker kaydedilemedi (${size})`)
    if (planning.hold) await closeHold(planning.hold, 'failed', 'Sahne tarifi yazıldı, görsel kaydedilemedi')
    const fault = studioFault(error)
    const known = faultMessage(fault, { owner, video: false })
    return NextResponse.json(
      { error: known ?? (fault === 'blocked' ? 'Model bu talimatı reddetti. Metni biraz yumuşatıp tekrar dene.' : 'Üretim başarısız oldu, tekrar dene.') },
      { status: fault === 'funds' ? 402 : 500 },
    )
  }
}
