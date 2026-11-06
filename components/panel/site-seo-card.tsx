'use client'

import { useActionState, useState } from 'react'
import { CalendarCheck, CheckCircle2, Circle, Globe, Loader2 } from 'lucide-react'
import { saveSiteSeoAction } from '@/app/panel/seo-actions'
import type { ActionState } from '@/app/panel/actions'
import type { CareItem } from '@/lib/seo-health'
import type { SiteSeo } from '@/lib/site-seo'

const input =
  'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'
const card = 'flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 scroll-mt-24'
const label = 'flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground'

function Counter({ value, min, max }: { value: number; min: number; max: number }) {
  const ok = value >= min && value <= max
  return (
    <span className={ok ? 'font-medium text-primary' : 'font-medium text-destructive'}>
      {value} karakter · ideal {min}-{max}
    </span>
  )
}

export function SiteSeoCard({ initial, siteUrl }: { initial: SiteSeo; siteUrl: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSiteSeoAction, {})
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [keywords, setKeywords] = useState(initial.keywords)
  const keywordCount = keywords.split(/[,\n]/).filter((k) => k.trim()).length
  const host = siteUrl.replace(/^https?:\/\//, '')

  return (
    <form id="site-seo" action={action} className={card}>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Globe className="size-5 text-primary" aria-hidden />
          <h2 className="font-display text-xl font-bold uppercase text-foreground">Site başlığı, açıklama ve anahtar kelimeler</h2>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {"Google'da ana sayfan için görünen başlık ve açıklama. Boş bırakılan alanda varsayılan değer kullanılır."}
        </p>
      </div>

      <label className={label}>
        Site başlığı (Title)
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={90}
          placeholder="Alkanka | Online Tavla, Okey ve Bilardo Oyna"
          className={input}
        />
        <Counter value={title.length} min={30} max={60} />
      </label>

      <label className={label}>
        Açıklama (Description)
        <textarea
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="Ücretsiz online tavla, okey, 101 ve bilardo oyna..."
          className={`${input} resize-y leading-relaxed`}
        />
        <Counter value={description.length} min={120} max={160} />
      </label>

      <label className={label}>
        Anahtar kelimeler (Keywords)
        <textarea
          name="keywords"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          maxLength={600}
          rows={2}
          placeholder="online tavla, okey oyna, 101 okey, bilardo oyna"
          className={`${input} resize-y leading-relaxed`}
        />
        <span className="font-normal">Virgülle ayır. {keywordCount} kelime · ideal 5-15 arası, en çok 20 kaydedilir.</span>
      </label>

      <div className="flex flex-col gap-1 rounded-xl border border-border bg-background p-4" aria-label="Google önizlemesi">
        <span className="text-xs text-muted-foreground">Google önizlemesi</span>
        <span className="truncate text-xs text-muted-foreground">{host}</span>
        <span className="line-clamp-1 text-lg font-medium text-primary">{title || 'Site başlığı burada görünür'}</span>
        <span className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {description || 'Açıklama burada görünür. Google genelde 160 karakterden sonrasını keser.'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Kaydet
        </button>
        {state.message ? (
          <p role="status" className={state.ok ? 'text-sm text-primary' : 'text-sm text-destructive'}>
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  )
}

const ROUTINE = [
  { day: 'Pazartesi', task: "Search Console'da tıklama, gösterim ve hata raporlarına bak." },
  { day: 'Salı', task: 'Yeni rehber yazısı yayınla (1/3).' },
  { day: 'Çarşamba', task: 'Bir eski yazıyı güncelle: bilgi, iç link, SSS ekle.' },
  { day: 'Perşembe', task: 'Yeni rehber yazısı yayınla (2/3).' },
  { day: 'Cuma', task: 'Kırık adresleri (404) yönlendir, yazıları sosyal medyada paylaş.' },
  { day: 'Cumartesi', task: 'Yeni rehber yazısı yayınla (3/3).' },
]

export function WeeklyCareCard({ items }: { items: CareItem[] }) {
  const done = items.filter((i) => i.done).length
  return (
    <section id="haftalik-bakim" className={card} aria-labelledby="haftalik-bakim-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarCheck className="size-5 text-primary" aria-hidden />
          <h2 id="haftalik-bakim-title" className="font-display text-xl font-bold uppercase text-foreground">
            Haftalık SEO bakımı
          </h2>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-foreground">
          {done}/{items.length} tamam
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {items.map((it) => (
          <li key={it.title}>
            <a
              href={it.href}
              className="flex items-start gap-3 rounded-xl border border-border bg-secondary p-3 transition-colors hover:border-primary"
            >
              {it.done ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-label="Tamam" />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Yapılmadı" />
              )}
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-foreground">{it.title}</span>
                <span className="text-xs leading-relaxed text-muted-foreground">{it.detail}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      <details className="rounded-xl border border-border bg-background p-3">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">Haftalık rutin takvimi</summary>
        <ul className="mt-3 flex flex-col gap-2">
          {ROUTINE.map((r) => (
            <li key={r.day} className="flex gap-3 text-sm leading-relaxed">
              <span className="w-24 shrink-0 font-semibold text-foreground">{r.day}</span>
              <span className="text-muted-foreground">{r.task}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}
