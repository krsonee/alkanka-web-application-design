import 'server-only'
import { FAQ } from '@/components/alkanka/data'
import { rows, sql } from '@/lib/db'

export type FaqRecord = {
  id: number
  question: string
  answer: string
  category: string
  slug: string
  sortOrder: number
  active: boolean
}

export type FaqInput = {
  id: number | null
  question: string
  answer: string
  category: string
  sortOrder: number
  active: boolean
}

export type PublicFaqGroup = {
  id: string
  label: string
  items: { id: string; q: string; a: string }[]
}

let ready: Promise<unknown> | null = null

const slugPart = (value: string) =>
  value
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)

function seedSlug(categoryId: string, question: string) {
  return `${slugPart(categoryId) || 'genel'}-${slugPart(question) || 'soru'}`.slice(0, 80)
}

export function ensureFaqs() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS faqs (
      id serial PRIMARY KEY,
      question text NOT NULL,
      answer text NOT NULL,
      category text NOT NULL DEFAULT 'Genel',
      slug text NOT NULL,
      sort_order int NOT NULL DEFAULT 0,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (slug))`)
    let sort = 0
    for (const group of FAQ) {
      for (const item of group.items) {
        const slug = seedSlug(group.id, item.q)
        await rows(sql`INSERT INTO faqs (question, answer, category, slug, sort_order, active)
          VALUES (${item.q}, ${item.a}, ${group.label}, ${slug}, ${sort}, true)
          ON CONFLICT (slug) DO NOTHING`)
        sort += 1
      }
    }
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

function mapFaq(row: Record<string, unknown>): FaqRecord {
  return {
    id: Number(row.id),
    question: String(row.question),
    answer: String(row.answer),
    category: String(row.category),
    slug: String(row.slug),
    sortOrder: Number(row.sort_order),
    active: Boolean(row.active),
  }
}

export async function listFaqs(): Promise<FaqRecord[]> {
  await ensureFaqs()
  const list = await rows(sql`SELECT id, question, answer, category, slug, sort_order, active FROM faqs ORDER BY sort_order, id`)
  return list.map(mapFaq)
}

export async function listPublicFaqs(): Promise<PublicFaqGroup[]> {
  await ensureFaqs()
  const list = (await listFaqs()).filter((item) => item.active)
  const groups: PublicFaqGroup[] = []
  for (const item of list) {
    const label = item.category.trim() || 'Genel'
    let group = groups.find((entry) => entry.label === label)
    if (!group) {
      group = { id: label, label, items: [] }
      groups.push(group)
    }
    group.items.push({ id: String(item.id), q: item.question, a: item.answer })
  }
  return groups
}

function cleanFaq(input: FaqInput) {
  const question = input.question.trim().replace(/\s+/g, ' ')
  const answer = input.answer.trim()
  const category = input.category.trim().replace(/\s+/g, ' ') || 'Genel'
  const sortOrder = Math.floor(Number(input.sortOrder))
  if (question.length < 5 || question.length > 200) throw new Error('Soru 5 ile 200 karakter arasında olmalı.')
  if (answer.length < 5 || answer.length > 2000) throw new Error('Cevap 5 ile 2000 karakter arasında olmalı.')
  if (category.length > 40) throw new Error('Kategori en fazla 40 karakter olabilir.')
  if (!Number.isFinite(sortOrder) || sortOrder < 0 || sortOrder > 9999) throw new Error('Sıra 0 ile 9999 arasında olmalı.')
  return { question, answer, category, sortOrder, active: Boolean(input.active) }
}

async function uniqueSlug(category: string, question: string) {
  const base = seedSlug(category, question) || `soru-${Date.now()}`
  const taken = await rows<{ slug: string }>(sql`SELECT slug FROM faqs WHERE slug = ${base} OR slug LIKE ${`${base}-%`}`)
  if (!taken.some((row) => row.slug === base)) return base
  let n = 2
  while (taken.some((row) => row.slug === `${base}-${n}`)) n += 1
  return `${base}-${n}`.slice(0, 80)
}

export async function saveFaq(input: FaqInput) {
  await ensureFaqs()
  const clean = cleanFaq(input)
  if (input.id) {
    const updated = await rows(sql`UPDATE faqs
      SET question = ${clean.question}, answer = ${clean.answer}, category = ${clean.category},
          sort_order = ${clean.sortOrder}, active = ${clean.active}
      WHERE id = ${input.id} RETURNING id`)
    if (!updated.length) throw new Error('Soru bulunamadı.')
    return
  }
  const slug = await uniqueSlug(clean.category, clean.question)
  await rows(sql`INSERT INTO faqs (question, answer, category, slug, sort_order, active)
    VALUES (${clean.question}, ${clean.answer}, ${clean.category}, ${slug}, ${clean.sortOrder}, ${clean.active})`)
}
