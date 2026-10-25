'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import type { PanelModule } from '@/lib/panel-modules'
import { panelLogout } from '@/app/panel/auth-actions'
import { deleteContent, getContent, setContent, type HeroOverride, type SlideOverride } from '@/lib/content'
import { CUSTOM_SLIDES_KEY, MAX_CUSTOM_SLIDES, readCustomSlides, isSafeHref, readSlideOrder, SLIDE_ORDER_KEY, sortByOrder } from '@/lib/custom-slides'
import { cleanLocal, parseLocal } from '@/lib/schedule'
import { HERO_PAGES, JAKO_POSES, isAllowedImage } from '@/lib/site-registry'
import { SLIDES } from '@/components/alkanka/data'
import { LOGO_TEAMS, listLogoSponsors } from '@/lib/logo-registry'
import { SHARE_KEY } from '@/lib/share'
import { TEXT_FIELDS, TEXTS_KEY } from '@/lib/site-texts-shared'

export type ActionState = { ok?: boolean; message?: string }

const LIMITS = { eyebrow: 40, title: 90, description: 280, speech: 160, cta: 30 } as const

function field(form: FormData, name: keyof typeof LIMITS) {
  return String(form.get(name) ?? '').trim().slice(0, LIMITS[name])
}

function imageField(form: FormData) {
  const value = String(form.get('image') ?? '').trim()
  if (!value) return ''
  if (!isAllowedImage(value)) throw new Error('Görsel /images/ ile ya da https:// ile başlamalı.')
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
    return { ok: true, message: 'Paylaşım önizlemesi kaydedildi. WhatsApp/Telegram eski önizlemeyi bir süre önbellekte tutabilir.' }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Kaydedilemedi.' }
  }
}

export async function saveAds(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('logo')
    const { AD_PAGES, AD_POSITIONS, ADS_KEY } = await import('@/lib/ads')
    const value: Record<string, { image: string; href: string; alt: string; startAt?: string; endAt?: string }> = {}
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
        value[key] = {
          image,
          href,
          alt: String(form.get(`${key}:alt`) ?? '').trim().slice(0, 80),
          ...(startAt ? { startAt } : {}),
          ...(endAt ? { endAt } : {}),
        }
      }
    }
    await setContent(ADS_KEY, value)
    for (const page of AD_PAGES) revalidatePath(`/${page.id}`)
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
    return { ok: true, message: 'Varsayılana döndü.' }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Sıfırlanamadı.' }
  }
}

export async function saveTexts(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('texts')
    const value: Record<string, string> = {}
    for (const f of TEXT_FIELDS) {
      const v = String(form.get(f.key) ?? '').trim().slice(0, f.max)
      if (!v) continue
      if (f.key === 'auth.bonus' && !/^\d{1,6}$/.test(v)) return { message: 'Kayıt bonusu sadece rakam olmalı.' }
      value[f.key] = v
    }
    await setContent(TEXTS_KEY, value)
    revalidatePath('/', 'layout')
    return { ok: true, message: `Kaydedildi (${Object.keys(value).length} özel metin).` }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Kaydedilemedi.' }
  }
}

export async function saveSlide(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('slide')
    const id = String(form.get('id'))
    const value: SlideOverride = {
      eyebrow: field(form, 'eyebrow'),
      title: field(form, 'title'),
      description: field(form, 'description'),
      cta: field(form, 'cta'),
      image: imageField(form),
    }
    const startAt = cleanLocal(form.get('startAt'))
    const endAt = cleanLocal(form.get('endAt'))
    if (startAt && endAt && parseLocal(endAt) <= parseLocal(startAt)) return { message: 'Bitiş tarihi başlangıçtan sonra olmalı.' }
    if (startAt) value.startAt = startAt
    if (endAt) value.endAt = endAt
    if (id.startsWith('c-')) {
      const list = readCustomSlides(await getContent(CUSTOM_SLIDES_KEY))
      const current = list.find((s) => s.id === id)
      if (!current) return { message: 'Slayt bulunamadı.' }
      const href = String(form.get('href') ?? '').trim().slice(0, 300) || '/'
      if (!isSafeHref(href)) return { message: 'Link / ile ya da https:// ile başlamalı.' }
      if (!value.title) return { message: 'Başlık boş olamaz.' }
      const next = list.map((s) =>
        s.id === id
          ? {
              ...s,
              eyebrow: value.eyebrow || '',
              title: value.title || '',
              description: value.description || '',
              cta: value.cta || 'İncele',
              image: value.image || s.image,
              href,
              startAt: startAt || undefined,
              endAt: endAt || undefined,
            }
          : s,
      )
      await setContent(CUSTOM_SLIDES_KEY, next)
      revalidatePath('/')
      revalidatePath('/panel')
      return { ok: true, message: 'Kaydedildi.' }
    }
    if (!SLIDES.some((s) => s.id === id)) return { message: 'Slayt bulunamadı.' }
    await setContent(`slide:${id}`, value)
    revalidatePath('/')
    return { ok: true, message: 'Kaydedildi.' }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Kaydedilemedi.' }
  }
}

export async function addSlide(_: ActionState): Promise<ActionState> {
  try {
    await requireAdmin('slide')
    const list = readCustomSlides(await getContent(CUSTOM_SLIDES_KEY))
    if (list.length >= MAX_CUSTOM_SLIDES) return { message: `En fazla ${MAX_CUSTOM_SLIDES} yeni slayt eklenebilir.` }
    const id = `c-${Date.now().toString(36)}`
    await setContent(CUSTOM_SLIDES_KEY, [
      ...list,
      { id, eyebrow: 'Yeni slayt', title: 'Başlığı buraya yaz', description: '', cta: 'İncele', href: '/', image: '/images/banner-wheel.png' },
    ])
    revalidatePath('/')
    revalidatePath('/panel')
    return { ok: true, message: 'Yeni slayt eklendi. Aşağıdan düzenleyip kaydet.' }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Eklenemedi.' }
  }
}

export async function saveLogos(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('logo')
    const kind = String(form.get('kind'))
    const allowed = kind === 'sponsors' ? await listLogoSponsors() : kind === 'teams' ? LOGO_TEAMS : null
    if (!allowed) return { message: 'Geçersiz liste.' }
    const value: Record<string, string> = {}
    for (const item of allowed) {
      const url = String(form.get(`logo:${item.id}`) ?? '').trim()
      if (!url) continue
      if (!isAllowedImage(url)) return { message: `${item.label}: logo /images/ ya da https:// ile başlamalı.` }
      value[item.id] = url.slice(0, 500)
    }
    await setContent(`logos:${kind}`, value)
    revalidatePath('/', 'layout')
    return { ok: true, message: `Kaydedildi (${Object.keys(value).length} logo).` }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Kaydedilemedi.' }
  }
}

async function currentSlideIds() {
  const custom = readCustomSlides(await getContent(CUSTOM_SLIDES_KEY))
  const all = [...SLIDES.map((s) => ({ id: s.id })), ...custom.map((s) => ({ id: s.id }))]
  return sortByOrder(all, readSlideOrder(await getContent(SLIDE_ORDER_KEY))).map((s) => s.id)
}

export async function moveSlide(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('slide')
    const id = String(form.get('id'))
    const dir = form.get('dir') === 'up' ? -1 : 1
    const ids = await currentSlideIds()
    const i = ids.indexOf(id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= ids.length) return { message: 'Taşınamadı.' }
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    await setContent(SLIDE_ORDER_KEY, ids)
    revalidatePath('/')
    revalidatePath('/panel')
    return { ok: true, message: 'Sıra güncellendi.' }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Taşınamadı.' }
  }
}

export async function duplicateSlide(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('slide')
    const id = String(form.get('id'))
    const list = readCustomSlides(await getContent(CUSTOM_SLIDES_KEY))
    if (list.length >= MAX_CUSTOM_SLIDES) return { message: `En fazla ${MAX_CUSTOM_SLIDES} yeni slayt eklenebilir.` }
    const builtIn = SLIDES.find((s) => s.id === id)
    const source = builtIn
      ? { ...builtIn, ...Object.fromEntries(Object.entries((await getContent(`slide:${id}`)) ?? {}).filter(([, v]) => v)) }
      : list.find((s) => s.id === id)
    if (!source) return { message: 'Slayt bulunamadı.' }
    const copy = {
      id: `c-${Date.now().toString(36)}`,
      eyebrow: String(source.eyebrow ?? ''),
      title: `${String(source.title ?? '')} (kopya)`.slice(0, 120),
      description: String(source.description ?? ''),
      cta: String(source.cta ?? 'İncele'),
      href: String(source.href ?? '/'),
      image: String(source.image ?? '/images/banner-wheel.png'),
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
      return { ok: true, message: 'Slayt silindi.' }
    }
    if (!SLIDES.some((s) => s.id === id)) return { message: 'Slayt bulunamadı.' }
    await deleteContent(`slide:${id}`)
    revalidatePath('/')
    revalidatePath('/panel')
    return { ok: true, message: 'Varsayılana döndü.' }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Sıfırlanamadı.' }
  }
}
