'use client'

import { useActionState, useMemo, useRef, useState, useTransition } from 'react'
import {
  Bold,
  CheckCircle2,
  CircleHelp,
  Eye,
  FileText,
  Heading2,
  Heading3,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Pencil,
  Quote,
  Trash2,
  XCircle,
} from 'lucide-react'
import { deletePostAction, savePostAction } from '@/app/panel/seo-actions'
import type { ActionState } from '@/app/panel/actions'
import type { BlogPost } from '@/lib/blog'
import { analyzePost, BlogBody } from '@/lib/blog-format'
import { ImageField } from '@/components/panel/image-field'

const input =
  'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'
const card = 'flex flex-col gap-4 rounded-2xl border border-border bg-card p-5'
const label = 'flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground'

type Draft = { title: string; slug: string; keywords: string; excerpt: string; body: string; cover: string }

const toDraft = (p: BlogPost | null): Draft => ({
  title: p?.title ?? '',
  slug: p?.slug ?? '',
  keywords: p?.keywords ?? '',
  excerpt: p?.excerpt ?? '',
  body: p?.body ?? '',
  cover: p?.cover ?? '',
})

const TEMPLATE = `Giriş paragrafı: odak kelimeyi ilk cümlede geçir ve okuyucuya bu yazıda ne bulacağını söyle.

## Odak kelime nedir?

Kısa ve net bir açıklama. **Önemli kısımları kalın** yaz.

## Nasıl alınır? (adım adım)

1. Sponsor sitesine kayıt ol.
2. Hesabını doğrula.
3. Canlı destekten bonusu talep et.

## Dikkat edilmesi gerekenler

- Çevrim şartı
- Maksimum çekim limiti
- Geçerlilik süresi

Güncel sponsor listesi için [güvenilir siteler](/siteler) sayfasına bak.

## Sık sorulan sorular

S: Soru 1?
C: Cevap 1.
S: Soru 2?
C: Cevap 2.`

function Counter({ value, min, max }: { value: number; min: number; max: number }) {
  const ok = value >= min && value <= max
  return <span className={ok ? 'font-medium text-primary' : 'font-medium text-destructive'}>{`${value}/${max}`}</span>
}

function Status({ state }: { state: ActionState }) {
  if (!state.message) return null
  return (
    <p role="status" className={state.ok ? 'text-sm text-primary' : 'text-sm text-destructive'}>
      {state.message}
    </p>
  )
}

export function BlogEditor({ posts, siteUrl }: { posts: BlogPost[]; siteUrl: string }) {
  const [editing, setEditing] = useState<BlogPost | null>(null)
  const [draft, setDraft] = useState<Draft>(() => toDraft(null))
  const [formKey, setFormKey] = useState(0)
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const [state, action, pending] = useActionState<ActionState, FormData>(savePostAction, {})
  const [deleting, startDelete] = useTransition()
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const focusKeyword = draft.keywords.split(',')[0]?.trim() ?? ''
  const report = useMemo(() => analyzePost({ ...draft, keyword: focusKeyword }), [draft, focusKeyword])

  const open = (post: BlogPost | null) => {
    setEditing(post)
    setDraft(toDraft(post))
    setTab('write')
    setFormKey((k) => k + 1)
  }

  const insert = (before: string, after = '', placeholder = '') => {
    const el = bodyRef.current
    if (!el) return
    const { selectionStart: s, selectionEnd: e, value } = el
    const selected = value.slice(s, e) || placeholder
    const next = value.slice(0, s) + before + selected + after + value.slice(e)
    set('body', next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(s + before.length, s + before.length + selected.length)
    })
  }

  const block = (text: string) => {
    const el = bodyRef.current
    const at = el?.selectionStart ?? draft.body.length
    const prefix = draft.body.slice(0, at).replace(/\s+$/, '')
    insert(prefix ? '\n\n' : '', '\n\n', text)
  }

  const tools = [
    { icon: Heading2, label: 'Ara başlık', run: () => block('## Ara başlık') },
    { icon: Heading3, label: 'Alt başlık', run: () => block('### Alt başlık') },
    { icon: Bold, label: 'Kalın', run: () => insert('**', '**', 'kalın yazı') },
    { icon: Link2, label: 'Link', run: () => insert('[', '](/siteler)', 'link yazısı') },
    { icon: List, label: 'Madde listesi', run: () => block('- Madde 1\n- Madde 2') },
    { icon: ListOrdered, label: 'Numaralı liste', run: () => block('1. Adım 1\n2. Adım 2') },
    { icon: Quote, label: 'Not kutusu', run: () => block('> Önemli not') },
    { icon: CircleHelp, label: 'SSS', run: () => block('S: Soru?\nC: Cevap.') },
  ]

  const host = siteUrl.replace(/^https?:\/\//, '')
  const scoreTone = report.score >= 80 ? 'text-primary' : report.score >= 50 ? 'text-foreground' : 'text-destructive'

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <form key={formKey} action={action} className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-primary" aria-hidden />
            <h2 className="font-display text-xl font-bold uppercase text-foreground">
              {editing ? 'Rehberi düzenle' : 'Yeni rehber yazısı'}
            </h2>
          </div>
          {!draft.body ? (
            <button type="button" onClick={() => set('body', TEMPLATE)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary">
              Şablonla başla
            </button>
          ) : null}
        </div>

        <input type="hidden" name="id" value={editing?.id ?? ''} />
        <label className={label}>
          <span className="flex justify-between">
            Başlık <Counter value={draft.title.length} min={30} max={60} />
          </span>
          <input name="title" required maxLength={120} value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="Deneme Bonusu Veren Siteler 2026" className={input} />
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className={label}>
            Adres (boş bırakırsan başlıktan oluşur)
            <input name="slug" maxLength={90} value={draft.slug} onChange={(e) => set('slug', e.target.value)} placeholder="deneme-bonusu-veren-siteler" className={input} />
          </label>
          <label className={label}>
            Anahtar kelimeler (ilki odak kelime)
            <input name="keywords" maxLength={300} value={draft.keywords} onChange={(e) => set('keywords', e.target.value)} placeholder="deneme bonusu, çevrimsiz bonus" className={input} />
          </label>
        </div>
        <label className={label}>
          <span className="flex justify-between">
            Özet (Google açıklaması) <Counter value={draft.excerpt.length} min={110} max={160} />
          </span>
          <textarea name="excerpt" required maxLength={200} rows={2} value={draft.excerpt} onChange={(e) => set('excerpt', e.target.value)} className={input} />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Google sonuç önizlemesi</span>
          <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-background p-4">
            <span className="truncate text-xs text-muted-foreground">{`${host} › rehber › ${report.slug || '...'}`}</span>
            <span className="truncate text-lg font-medium text-primary">
              {draft.title ? (draft.title.length > 60 ? `${draft.title.slice(0, 60)}…` : draft.title) : 'Başlık burada görünecek'}
              {' | AL KANKA'}
            </span>
            <span className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {draft.excerpt ? (draft.excerpt.length > 160 ? `${draft.excerpt.slice(0, 160)}…` : draft.excerpt) : 'Özet burada görünecek.'}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground">{`İçerik · ${report.words} kelime`}</span>
            <div role="tablist" aria-label="İçerik görünümü" className="flex rounded-lg border border-border p-0.5">
              {(['write', 'preview'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold ${tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {t === 'write' ? <Pencil className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
                  {t === 'write' ? 'Yaz' : 'Önizle'}
                </button>
              ))}
            </div>
          </div>
          <input type="hidden" name="body" value={draft.body} />
          {tab === 'write' ? (
            <>
              <div className="flex flex-wrap gap-1 rounded-t-xl border border-b-0 border-input bg-secondary p-1">
                {tools.map(({ icon: Icon, label: l, run }) => (
                  <button key={l} type="button" onClick={run} title={l} aria-label={l} className="rounded-md p-2 text-muted-foreground hover:bg-background hover:text-foreground">
                    <Icon className="size-4" aria-hidden />
                  </button>
                ))}
              </div>
              <textarea
                ref={bodyRef}
                aria-label="İçerik"
                rows={18}
                value={draft.body}
                onChange={(e) => set('body', e.target.value)}
                className={`${input} -mt-1.5 rounded-t-none font-mono leading-relaxed`}
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                {'"## " ara başlık, "### " alt başlık, "- " madde, "1. " numaralı liste, "> " not kutusu, **kalın**, [yazı](/adres) link. SSS için "S: soru" ve altına "C: cevap" yaz.'}
              </p>
            </>
          ) : (
            <div className="min-h-64 rounded-xl border border-border bg-background p-5">
              {draft.body ? <BlogBody body={draft.body} /> : <p className="text-sm text-muted-foreground">Önizlenecek içerik yok.</p>}
            </div>
          )}
        </div>

        <label className={label}>
          Kapak görseli (1280×720 önerilir)
          <ImageField key={editing?.slug ?? 'new'} name="cover" defaultValue={draft.cover} uploadId="guide-cover" onChange={(url) => set('cover', url)} />
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" name="published" defaultChecked={editing?.published ?? true} className="size-4 accent-primary" />
          Yayında
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Kaydet
          </button>
          {editing ? (
            <>
              <button type="button" onClick={() => open(null)} className="rounded-xl border border-border px-4 py-2.5 text-sm text-foreground hover:bg-secondary">
                Yeni yazı
              </button>
              {editing.published ? (
                <a href={`/rehber/${editing.slug}`} target="_blank" rel="noreferrer" className="text-sm text-muted-foreground underline hover:text-foreground">
                  Sitede gör
                </a>
              ) : null}
            </>
          ) : null}
          <Status state={state} />
        </div>
      </form>

      <div className="flex flex-col gap-6">
        <section className={card} aria-label="SEO kontrolü">
          <div className="flex items-baseline justify-between">
            <h3 className="font-semibold text-foreground">SEO kontrolü</h3>
            <span className={`text-2xl font-bold tabular-nums ${scoreTone}`}>{report.score}</span>
          </div>
          {!focusKeyword ? (
            <p className="rounded-lg bg-secondary px-3 py-2 text-xs leading-relaxed text-secondary-foreground">
              {'Anahtar kelimelere bir odak kelime yaz (ör. "deneme bonusu"). Kelime kontrolleri o zaman açılır.'}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Odak kelime: <strong className="text-foreground">{focusKeyword}</strong>
            </p>
          )}
          <ul className="flex flex-col gap-2.5">
            {report.checks.map((c) => (
              <li key={c.label} className="flex gap-2">
                {c.ok ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-label="Tamam" />
                ) : (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Eksik" />
                )}
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{c.label}</span>
                  <span className="text-xs text-muted-foreground">{c.hint}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className={card} aria-label="Yazılar">
          <h3 className="font-semibold text-foreground">Yazılar ({posts.length})</h3>
          {posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{'Henüz yazı yok. İlk yazı için "Şablonla başla" butonunu kullanabilirsin.'}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {posts.map((p) => (
                <li key={p.id} className={`flex items-center gap-2 rounded-xl border p-2 ${editing?.id === p.id ? 'border-primary' : 'border-border'}`}>
                  <button type="button" onClick={() => open(p)} className="flex min-w-0 flex-1 flex-col text-left">
                    <span className="truncate text-sm font-semibold text-foreground">{p.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.published ? `/rehber/${p.slug}` : 'Taslak'}
                      {' · '}
                      {new Date(p.updatedAt).toLocaleDateString('tr-TR')}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => confirm('Yazı silinsin mi?') && startDelete(() => deletePostAction(p.id))}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-destructive"
                    aria-label={`${p.title} yazısını sil`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
