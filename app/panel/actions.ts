'use server'

import { logPanel } from '@/lib/panel-log'
import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import type { PanelModule } from '@/lib/panel-modules'
import { panelLogout } from '@/app/panel/auth-actions'
import { deleteContent, getContent, setContent, type HeroOverride, type SlideOverride } from '@/lib/content'
import { CUSTOM_SLIDES_KEY, MAX_CUSTOM_SLIDES, readCustomSlides, isSafeHref, readSlideOrder, resolveSlide, SLIDE_ORDER_KEY, sortByOrder, type SlideSaved } from '@/lib/custom-slides'
import { cleanLocal, parseLocal } from '@/lib/schedule'
import { HERO_PAGES, JAKO_POSES, isAllowedImage } from '@/lib/site-registry'
import { SLIDES } from '@/components/alkanka/data'
import { SHARE_KEY } from '@/lib/share'
import { TEXT_FIELDS, TEXTS_KEY, legacyEventTexts } from '@/lib/site-texts-shared'

export type ActionState = { ok?: boolean; message?: string }

const LIMITS = { eyebrow: 40, title: 90, description: 280, speech: 160, cta: 30 } as const

const LIMIT_LABELS: Record<keyof typeof LIMITS, string> = { eyebrow: 'Üst etiket', title: 'Başlık', description: 'Açıklama', speech: 'Jako konuşma balonu', cta: 'Düğme yazısı' }

function field(form: FormData, name: keyof typeof LIMITS) {
  const value = String(form.get(name) ?? '').trim()
  if (value.length > LIMITS[name]) throw new Error(`${LIMIT_LABELS[name]} en fazla ${LIMITS[name]} karakter olabilir (yazdığın ${value.length} karakter). Hiçbir şey kaydedilmedi.`)
  return value
}

function imageField(form: FormData, name = 'image', label = 'Görsel') {
  const value = String(form.get(name) ?? '').trim()
  if (!value) return ''
  if (value.length > 500) throw new Error(`${label} adresi en fazla 500 karakter olabilir.`)
  if (!isAllowedImage(value)) throw new Error(`${label} /images/ ile ya da https:// ile başlamalı.`)
  return value
}

/** Where a slide leads. Empty means "leave it as it is"; anything typed has to be a site path or an https address. */
function slideHref(form: FormData) {
  const value = String(form.get('href') ?? '').trim().slice(0, 300)
  if (value && !isSafeHref(value)) throw new Error('Link / ile ya da https:// ile başlamalı.')
  return value
}

async function requireAdmin(module: PanelModule) {
  if (!(await canPanel(module))) throw new Error('Oturum süresi doldu, tekrar giriş yap.')
}

export async function saveShare(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('logo')
    const text = (name: string, max: number) => String(form.get(name) ?? '').trim().slice(0, max)
    const image = text('image', 500)
    if (image && !isAllowedImage(image)) throw new Error('Görsel /images/ ile ya da https:// ile başlamalı.')
    await setContent(SHARE_KEY, {
      title: text('title', 90),
      description: text('description', 200),
      siteName: text('siteName', 40),
      image,
    })
    revalidatePath('/', 'layout')
    await logPanel('logo', 'Paylaşım görseli kaydedildi')
    return { ok: true, message: 'Paylaşım önizlemesi kaydedildi. WhatsApp/Telegram eski önizlemeyi bir süre önbellekte tutabilir.' }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Kaydedilemedi.' }
  }
}

export async function saveAds(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('logo')
    const { AD_PAGES, AD_POSITIONS, ADS_KEY } = await import('@/lib/ads')
    const value: Record<string, { image: string; href: string; alt: string; startAt?: string; endAt?: string; w?: number; h?: number }> = {}
    const pixels = (v: FormDataEntryValue | null) => {
      const n = Math.round(Number(v))
      return n > 0 && n <= 20_000 ? n : 0
    }
    for (const page of AD_PAGES) {
      for (const pos of AD_POSITIONS) {
        const key = `${page.id}:${pos.id}`
        const image = String(form.get(`${key}:image`) ?? '').trim()
        const href = String(form.get(`${key}:href`) ?? '').trim()
        if (!image) continue
        if (!isAllowedImage(image)) return { message: `${page.label} / ${pos.label}: görsel https:// veya /images/ ile başlamalı.` }
        if (href && !/^https:\/\//.test(href) && !href.startsWith('/')) return { message: `${page.label} / ${pos.label}: link https:// ile başlamalı.` }
        const startAt = cleanLocal(form.get(`${key}:startAt`))
        const endAt = cleanLocal(form.get(`${key}:endAt`))
        if (startAt && endAt && parseLocal(endAt)! <= parseLocal(startAt)!) {
          return { message: `${page.label} / ${pos.label}: bitiş, başlangıçtan sonra olmalı.` }
        }
        const w = pixels(form.get(`${key}:w`))
        const h = pixels(form.get(`${key}:h`))
        value[key] = {
          image,
          href,
          alt: String(form.get(`${key}:alt`) ?? '').trim().slice(0, 80),
          ...(startAt ? { startAt } : {}),
          ...(endAt ? { endAt } : {}),
          ...(w && h ? { w, h } : {}),
        }
      }
    }
    await setContent(ADS_KEY, value)
    for (const page of AD_PAGES) revalidatePath(`/${page.id}`)
    await logPanel('logo', 'Reklam alanları kaydedildi', null, `${Object.keys(value).length} dolu alan`)
    return { ok: true, message: 'Reklam alanları kaydedildi.' }
  } catch (error) {
    return { message: error instanceof Error ? error.message : 'Kaydedilemedi.' }
  }
}

export async function logout() {
  await panelLogout()
}

export async function saveHero(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('hero')
    const slug = String(form.get('slug'))
    const page = HERO_PAGES.find((p) => p.slug === slug)
    if (!page) return { message: 'Sayfa bulunamadı.' }
    const pose = String(form.get('pose') ?? '')
    const value: HeroOverride = {
      eyebrow: field(form, 'eyebrow'),
      title: field(form, 'title'),
      description: field(form, 'description'),
      speech: field(form, 'speech'),
      image: imageField(form),
      pose: (JAKO_POSES as readonly string[]).includes(pose) ? pose : '',
    }
    await setContent(`hero:${slug}`, value)
    revalidatePath(page.path)
    await logPanel('hero', 'Sayfa başlığı kaydedildi', page.path)
    return { ok: true, message: 'Kaydedildi.' }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Kaydedilemedi.' }
  }
}

export async function resetHero(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('hero')
    const page = HERO_PAGES.find((p) => p.slug === String(form.get('slug')))
    if (!page) return { message: 'Sayfa bulunamadı.' }
    await deleteContent(`hero:${page.slug}`)
    revalidatePath(page.path)
    revalidatePath('/panel')
    await logPanel('hero', 'Sayfa başlığı varsayılana döndü', page.path)
    return { ok: true, message: 'Varsayılana döndü.' }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Sıfırlanamadı.' }
  }
}

export async function saveTexts(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('texts')
    // Event card texts typed here before the cards moved to their own tab stay until that event is saved again.
    const value: Record<string, string> = legacyEventTexts(await getContent(TEXTS_KEY))
    const kept = Object.keys(value).length
    for (const f of TEXT_FIELDS) {
      const v = String(form.get(f.key) ?? '').trim()
      if (!v) continue
      if (f.key === 'auth.bonus') {
        if (!/^\d+$/.test(v)) return { message: 'Kayıt bonusu sadece rakam olmalı. Hiçbir şey kaydedilmedi.' }
        if (v.length > 6) return { message: `Kayıt bonusu en fazla 999.999 KC olabilir (yazdığın ${Number(v).toLocaleString('tr-TR')}). Hiçbir şey kaydedilmedi.` }
      }
      if (v.length > f.max) return { message: `"${f.label}" en fazla ${f.max} karakter olabilir (yazdığın ${v.length} karakter). Hiçbir şey kaydedilmedi.` }
      value[f.key] = v
    }
    await setContent(TEXTS_KEY, value)
    revalidatePath('/', 'layout')
    const custom = Object.keys(value).length - kept
    await logPanel('texts', 'Site yazıları kaydedildi', null, `${custom} özel metin`)
    return { ok: true, message: `Kaydedildi (${custom} özel metin).` }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Kaydedilemedi.' }
  }
}

export async function saveSlide(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('slide')
    const id = String(form.get('id'))
    // "Sadece görsel": a banner with its words in the picture. Nothing is written or shaded over it on the site.
    const plain = form.get('plain') === '1'
    const value: SlideOverride = {
      eyebrow: field(form, 'eyebrow'),
      title: field(form, 'title'),
      description: field(form, 'description'),
      cta: field(form, 'cta'),
      image: imageField(form),
      plain,
    }
    const mobileImage = imageField(form, 'mobileImage', 'Telefon görseli')
    if (mobileImage) value.mobileImage = mobileImage
    const href = slideHref(form)
    const startAt = cleanLocal(form.get('startAt'))
    const endAt = cleanLocal(form.get('endAt'))
    if (startAt && endAt && parseLocal(endAt) <= parseLocal(startAt)) return { message: 'Bitiş tarihi başlangıçtan sonra olmalı.' }
    if (startAt) value.startAt = startAt
    if (endAt) value.endAt = endAt
    if (id.startsWith('c-')) {
      const list = readCustomSlides(await getContent(CUSTOM_SLIDES_KEY))
      const current = list.find((s) => s.id === id)
      if (!current) return { message: 'Slayt bulunamadı.' }
      if (!plain && !value.title) return { message: 'Görselin üstüne yazı seçiliyken başlık boş olamaz. Yazı istemiyorsan "Sadece görsel"i seç.' }
      const next = list.map((s) =>
        s.id === id
          ? {
              ...s,
              eyebrow: value.eyebrow || '',
              title: value.title || '',
              description: value.description || '',
              cta: value.cta || 'İncele',
              image: value.image || s.image,
              mobileImage: mobileImage || undefined,
              plain,
              href: href || '/',
              startAt: startAt || undefined,
              endAt: endAt || undefined,
            }
          : s,
      )
      await setContent(CUSTOM_SLIDES_KEY, next)
      revalidatePath('/')
      revalidatePath('/panel')
      await logPanel('slide', 'Slayt kaydedildi', value.title || id)
      return { ok: true, message: 'Kaydedildi. Ana sayfada görünür.' }
    }
    const ready = SLIDES.find((s) => s.id === id)
    if (!ready) return { message: 'Slayt bulunamadı.' }
    if (href && href !== ready.href) value.href = href
    await setContent(`slide:${id}`, value)
    revalidatePath('/')
    revalidatePath('/panel')
    await logPanel('slide', 'Slayt kaydedildi', value.title || id)
    return { ok: true, message: 'Kaydedildi. Ana sayfada görünür.' }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Kaydedilemedi.' }
  }
}

/** A new slide exists only once its form is saved, so closing the form leaves nothing half-made on the site. */
export async function createSlide(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('slide')
    const list = readCustomSlides(await getContent(CUSTOM_SLIDES_KEY))
    if (list.length >= MAX_CUSTOM_SLIDES) return { message: `En fazla ${MAX_CUSTOM_SLIDES} yeni slayt eklenebilir.` }
    const plain = form.get('plain') === '1'
    const title = field(form, 'title')
    const image = imageField(form)
    if (plain && !image) return { message: 'Önce görseli ekle: "Sadece görsel" slaytında sitede görünen tek şey görseldir.' }
    if (!plain && !title) return { message: 'Görselin üstüne yazı seçiliyken başlık boş olamaz. Yazı istemiyorsan "Sadece görsel"i seç.' }
    const href = slideHref(form) || '/'
    const startAt = cleanLocal(form.get('startAt'))
    const endAt = cleanLocal(form.get('endAt'))
    if (startAt && endAt && parseLocal(endAt) <= parseLocal(startAt)) return { message: 'Bitiş tarihi başlangıçtan sonra olmalı.' }
    const mobileImage = imageField(form, 'mobileImage', 'Telefon görseli')
    const id = `c-${Date.now().toString(36)}`
    await setContent(CUSTOM_SLIDES_KEY, [
      ...list,
      {
        id,
        eyebrow: field(form, 'eyebrow'),
        title,
        description: field(form, 'description'),
        cta: field(form, 'cta') || 'İncele',
        href,
        image: image || '/images/banner-wheel.png',
        plain,
        ...(mobileImage ? { mobileImage } : {}),
        ...(startAt ? { startAt } : {}),
        ...(endAt ? { endAt } : {}),
      },
    ])
    revalidatePath('/')
    revalidatePath('/panel')
    await logPanel('slide', 'Slayt eklendi', title || 'afiş')
    return { ok: true, message: 'Slayt eklendi, listenin sonunda. Ana sayfada görünür.' }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Eklenemedi.' }
  }
}

async function currentSlideIds() {
  const custom = readCustomSlides(await getContent(CUSTOM_SLIDES_KEY))
  const all = [...SLIDES.map((s) => ({ id: s.id })), ...custom.map((s) => ({ id: s.id }))]
  return sortByOrder(all, readSlideOrder(await getContent(SLIDE_ORDER_KEY))).map((s) => s.id)
}

export async function reorderSlides(ids: string[]): Promise<ActionState> {
  try {
    await requireAdmin('slide')
    const current = await currentSlideIds()
    const next = Array.isArray(ids) ? ids.map(String) : []
    if (next.length !== current.length || new Set(next).size !== next.length || next.some((id) => !current.includes(id))) {
      return { message: 'Slayt listesi bu arada değişmiş. Sayfayı yenileyip tekrar dene.' }
    }
    await setContent(SLIDE_ORDER_KEY, next)
    revalidatePath('/')
    revalidatePath('/panel')
    await logPanel('slide', 'Slayt sırası değişti', null, 'sürüklenerek sıralandı')
    return { ok: true, message: 'Sıra güncellendi.' }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Sıra kaydedilemedi.' }
  }
}

export async function duplicateSlide(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('slide')
    const id = String(form.get('id'))
    const list = readCustomSlides(await getContent(CUSTOM_SLIDES_KEY))
    if (list.length >= MAX_CUSTOM_SLIDES) return { message: `En fazla ${MAX_CUSTOM_SLIDES} yeni slayt eklenebilir.` }
    const builtIn = SLIDES.find((s) => s.id === id)
    const source = builtIn ? resolveSlide(builtIn, (await getContent(`slide:${id}`)) as SlideSaved | null) : list.find((s) => s.id === id)
    if (!source) return { message: 'Slayt bulunamadı.' }
    const copy = {
      id: `c-${Date.now().toString(36)}`,
      eyebrow: String(source.eyebrow ?? ''),
      title: `${String(source.title ?? '')} (kopya)`.trim().slice(0, 120),
      description: String(source.description ?? ''),
      cta: String(source.cta ?? 'İncele'),
      href: String(source.href ?? '/'),
      image: String(source.image ?? '/images/banner-wheel.png'),
      plain: source.plain === true,
      ...(typeof source.mobileImage === 'string' && source.mobileImage ? { mobileImage: source.mobileImage } : {}),
    }
    await setContent(CUSTOM_SLIDES_KEY, [...list, copy])
    const ids = await currentSlideIds()
    const from = ids.indexOf(copy.id)
    const at = ids.indexOf(id)
    if (from >= 0 && at >= 0) {
      ids.splice(from, 1)
      ids.splice(at + 1, 0, copy.id)
      await setContent(SLIDE_ORDER_KEY, ids)
    }
    revalidatePath('/')
    revalidatePath('/panel')
    await logPanel('slide', 'Slayt kopyalandı', copy.title)
    return { ok: true, message: 'Kopyası eklendi.' }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Kopyalanamadı.' }
  }
}

export async function resetSlide(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('slide')
    const id = String(form.get('id'))
    if (id.startsWith('c-')) {
      const list = readCustomSlides(await getContent(CUSTOM_SLIDES_KEY))
      await setContent(CUSTOM_SLIDES_KEY, list.filter((s) => s.id !== id))
      revalidatePath('/')
      revalidatePath('/panel')
      await logPanel('slide', 'Slayt silindi', list.find((s) => s.id === id)?.title ?? id)
      return { ok: true, message: 'Slayt silindi.' }
    }
    if (!SLIDES.some((s) => s.id === id)) return { message: 'Slayt bulunamadı.' }
    await deleteContent(`slide:${id}`)
    revalidatePath('/')
    revalidatePath('/panel')
    await logPanel('slide', 'Slayt varsayılana döndü', id)
    return { ok: true, message: 'Varsayılana döndü.' }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Sıfırlanamadı.' }
  }
}

export async function saveHomeV2(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('logo')
    const { HOME_V2_KEY, mergeHomeV2 } = await import('@/lib/home-v2-shared')
    const raw = mergeHomeV2(JSON.parse(String(form.get('payload') ?? '{}')) as unknown)
    // The layout and the wizard are saved from separate tabs; each one writes only its own half.
    const part = String(form.get('part') ?? '')
    const stored = part === 'home' || part === 'setup' ? mergeHomeV2(await getContent(HOME_V2_KEY)) : null
    const value = stored ? mergeHomeV2({ ...stored, [part]: raw[part as 'home' | 'setup'] }) : raw
    const tiles = [...value.home.daily, ...value.home.free, ...value.home.promos]
    const images = [value.home.heroImage, ...tiles.map((t) => t.image)].filter(Boolean)
    for (const img of images) if (!isAllowedImage(img)) throw new Error('Görseller /images/ ile ya da https:// ile başlamalı.')
    const hrefs = [
      value.home.primaryHref,
      value.home.secondaryHref,
      value.home.marketHref,
      value.home.guestPrimaryHref,
      value.home.guestSecondaryHref,
      ...tiles.map((t) => t.href),
      ...value.home.rail.map((t) => t.href),
    ]
    // "#kayit" and "#giris" open the sign-up and sign-in windows; the guest button ships with "#kayit".
    for (const h of hrefs) if (h && !isSafeHref(h) && !/^#[\w-]+$/.test(h)) throw new Error(`"${h.slice(0, 60)}" geçerli bir bağlantı değil. Bağlantılar / ile, https:// ile ya da #kayit gibi # ile başlamalı.`)
    await setContent(HOME_V2_KEY, value)
    revalidatePath('/')
    revalidatePath('/oyunlar/okey')
    const what = part === 'home' ? 'Ana sayfa düzeni' : part === 'setup' ? 'Masa açma sihirbazı' : 'Ana sayfa ve masa açma ayarları'
    await logPanel('logo', `${what} kaydedildi`)
    return { ok: true, message: `${what} kaydedildi.` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Kaydedilemedi.' }
  }
}
