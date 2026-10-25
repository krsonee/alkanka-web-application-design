import Link from 'next/link'
import type { ReactNode } from 'react'
import { slugify } from '@/lib/seo'

export type FaqItem = { q: string; a: string }

export type BodyBlock =
  | { type: 'h2' | 'h3' | 'p' | 'quote'; text: string }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'faq'; items: FaqItem[] }

const isFaqLine = (l: string) => /^(S|C):\s/.test(l)

function parseFaq(lines: string[]): FaqItem[] {
  const items: FaqItem[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (line.startsWith('S: ')) items.push({ q: line.slice(3).trim(), a: '' })
    else if (items.length) {
      const last = items[items.length - 1]
      const text = line.startsWith('C: ') ? line.slice(3).trim() : line
      last.a = last.a ? `${last.a} ${text}` : text
    }
  }
  return items.filter((i) => i.q && i.a)
}

export function parseBody(body: string): BodyBlock[] {
  return body
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk): BodyBlock => {
      if (chunk.startsWith('### ')) return { type: 'h3', text: chunk.slice(4).trim() }
      if (chunk.startsWith('## ')) return { type: 'h2', text: chunk.slice(3).trim() }
      const lines = chunk.split('\n').map((l) => l.trim())
      if (lines[0].startsWith('S: ') && lines.some(isFaqLine)) return { type: 'faq', items: parseFaq(lines) }
      if (lines.every((l) => l.startsWith('> '))) return { type: 'quote', text: lines.map((l) => l.slice(2)).join(' ') }
      if (lines.every((l) => l.startsWith('- '))) return { type: 'ul', items: lines.map((l) => l.slice(2)) }
      if (lines.every((l) => /^\d+\.\s/.test(l))) return { type: 'ol', items: lines.map((l) => l.replace(/^\d+\.\s/, '')) }
      return { type: 'p', text: lines.join(' ') }
    })
}

const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g

export function renderInline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
    if (link) {
      const [, label, href] = link
      if (href.startsWith('/')) {
        return <Link key={i} href={href} className="font-semibold text-primary underline underline-offset-2">{label}</Link>
      }
      if (href.startsWith('https://')) {
        return (
          <a key={i} href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-primary underline underline-offset-2">
            {label}
          </a>
        )
      }
      return label
    }
    return part
  })
}

export const stripInline = (text: string) => text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1')

export function BlogBody({ body }: { body: string }) {
  return (
    <div className="flex flex-col gap-4 leading-relaxed text-foreground">
      {parseBody(body).map((block, i) => {
        switch (block.type) {
          case 'h2':
            return <h2 key={i} id={slugify(block.text)} className="mt-2 scroll-mt-24 text-balance text-xl font-bold">{renderInline(block.text)}</h2>
          case 'h3':
            return <h3 key={i} className="mt-1 text-balance text-lg font-semibold">{renderInline(block.text)}</h3>
          case 'quote':
            return <blockquote key={i} className="rounded-xl bg-secondary px-4 py-3 text-pretty text-secondary-foreground">{renderInline(block.text)}</blockquote>
          case 'ul':
            return <ul key={i} className="flex list-disc flex-col gap-1.5 pl-5">{block.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ul>
          case 'ol':
            return <ol key={i} className="flex list-decimal flex-col gap-1.5 pl-5">{block.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ol>
          case 'faq':
            return (
              <section key={i} aria-label="Sık sorulan sorular" className="flex flex-col gap-2">
                {block.items.map((item, j) => (
                  <details key={j} className="group rounded-xl border border-border bg-card px-4 py-3">
                    <summary className="cursor-pointer list-none font-semibold text-foreground">{item.q}</summary>
                    <p className="mt-2 text-pretty text-muted-foreground">{renderInline(item.a)}</p>
                  </details>
                ))}
              </section>
            )
          default:
            return <p key={i} className="text-pretty">{renderInline(block.text)}</p>
        }
      })}
    </div>
  )
}

export function extractFaq(body: string): FaqItem[] {
  return parseBody(body).flatMap((b) => (b.type === 'faq' ? b.items.map((i) => ({ q: i.q, a: stripInline(i.a) })) : []))
}

export function bodyWordCount(body: string) {
  const text = stripInline(body).replace(/^(#{2,3}|[->]|\d+\.|S:|C:)\s/gm, ' ')
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
}

export type SeoCheck = { label: string; ok: boolean; hint: string }

export function analyzePost(p: { title: string; slug: string; excerpt: string; body: string; keyword: string; cover: string }) {
  const lower = (s: string) => s.toLocaleLowerCase('tr')
  const kw = lower(p.keyword.trim())
  const blocks = parseBody(p.body)
  const firstPara = blocks.find((b) => b.type === 'p')
  const headings = blocks.filter((b) => b.type === 'h2' || b.type === 'h3').map((b) => ('text' in b ? lower(b.text) : ''))
  const words = bodyWordCount(p.body)
  const plain = lower(stripInline(p.body))
  const kwHits = kw ? plain.split(kw).length - 1 : 0
  const density = words && kw ? (kwHits * kw.split(/\s+/).length * 100) / words : 0
  const slug = p.slug ? slugify(p.slug) : slugify(p.title)
  const internalLinks = (p.body.match(/\]\(\/[^)\s]*\)/g) ?? []).length
  const h2Count = blocks.filter((b) => b.type === 'h2').length
  const hasFaq = blocks.some((b) => b.type === 'faq')

  const checks: SeoCheck[] = [
    { label: 'Başlık uzunluğu', ok: p.title.length >= 30 && p.title.length <= 60, hint: `${p.title.length} karakter, ideal 30–60` },
    { label: 'Özet uzunluğu', ok: p.excerpt.length >= 110 && p.excerpt.length <= 160, hint: `${p.excerpt.length} karakter, ideal 110–160` },
    { label: 'İçerik uzunluğu', ok: words >= 800, hint: `${words} kelime, en az 800, ideal 1200+` },
    { label: 'Ara başlıklar', ok: h2Count >= 3, hint: `${h2Count} adet "## " başlık, en az 3` },
    { label: 'İç link', ok: internalLinks >= 2, hint: `${internalLinks} adet site içi link, en az 2` },
    { label: 'SSS bloğu', ok: hasFaq, hint: hasFaq ? 'Google soru-cevap olarak gösterebilir' : 'S: / C: satırlarıyla ekle' },
    { label: 'Kapak görseli', ok: Boolean(p.cover), hint: p.cover ? 'Var' : 'Paylaşımda ve Google Görsellerde lazım' },
  ]
  if (kw) {
    checks.unshift(
      { label: 'Kelime başlıkta', ok: lower(p.title).includes(kw), hint: 'Odak kelime başlıkta geçmeli, tercihen başta' },
      { label: 'Kelime özette', ok: lower(p.excerpt).includes(kw), hint: 'Google aranan kelimeyi özette kalın gösterir' },
      { label: 'Kelime adreste', ok: slug.includes(slugify(kw)), hint: `/rehber/${slug || '...'}` },
      { label: 'Kelime ilk paragrafta', ok: Boolean(firstPara && 'text' in firstPara && lower(firstPara.text).includes(kw)), hint: 'İlk 100 kelimede geçmeli' },
      { label: 'Kelime ara başlıkta', ok: headings.some((h) => h.includes(kw)), hint: 'En az bir "## " başlıkta geçmeli' },
      { label: 'Kelime yoğunluğu', ok: density >= 0.5 && density <= 2.5, hint: `${kwHits} kez, %${density.toFixed(1)} (ideal %0,5–2,5)` },
    )
  }
  const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100)
  return { checks, score, words, slug }
}
