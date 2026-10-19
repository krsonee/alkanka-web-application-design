'use client'

import { SeoGuide } from '@/components/panel/area-guides'
import { useActionState, useState, useTransition } from 'react'
import { ExternalLink, FileText, Loader2, Search, Trash2, Zap } from 'lucide-react'
import {
  deleteDealAction,
  deletePostAction,
  savePostAction,
  saveVerificationAction,
  setDealsPublishingAction,
} from '@/app/panel/seo-actions'
import type { ActionState } from '@/app/panel/actions'
import type { BlogPost } from '@/lib/blog'
import { DEAL_LABELS, type Deal, type Verification } from '@/lib/deal-types'
import { ImageField } from '@/components/panel/image-field'

type Props = { posts: BlogPost[]; deals: Deal[]; publishing: boolean; verification: Verification; siteUrl: string }

const input =
  'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'
const card = 'flex flex-col gap-4 rounded-2xl border border-border bg-card p-5'
const label = 'flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground'

export function SeoManager({ posts, deals, publishing, verification, siteUrl }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <SeoGuide />
      <SearchConsoleCard verification={verification} siteUrl={siteUrl} />
      <BlogEditor posts={posts} />
      <DealsCard deals={deals} publishing={publishing} />
    </div>
  )
}

function Status({ state }: { state: ActionState }) {
  if (!state.message) return null
  return (
    <p role="status" className={state.ok ? 'text-sm text-primary' : 'text-sm text-destructive'}>
      {state.message}
    </p>
  )
}

function SearchConsoleCard({ verification, siteUrl }: { verification: Verification; siteUrl: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveVerificationAction, {})
  return (
    <form action={action} className={card}>
      <div className="flex items-center gap-2">
        <Search className="size-5 text-primary" aria-hidden />
        <h2 className="font-display text-xl font-bold uppercase text-foreground">Google kaydı</h2>
      </div>
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
        <li>
          <a href="https://search.google.com/search-console" target="_blank" rel="noopener" className="font-semibold text-primary underline">
            Google Search Console
          </a>
          {"'a gir, \"Mülk ekle\" de ve \"URL öneki\" olarak "}
          <code className="rounded bg-secondary px-1 text-foreground">{siteUrl}</code> yaz.
        </li>
        <li>{'"HTML etiketi" yöntemini seç, verilen <meta ...> satırını aşağıya yapıştır ve kaydet.'}</li>
        <li>{"Search Console'da \"Doğrula\" de."}</li>
        <li>
          {'Soldan "Site haritaları" bölümüne '}
          <code className="rounded bg-secondary px-1 text-foreground">sitemap.xml</code>
          {' yaz ve gönder. Bing ve Yandex için de aynı adımlar.'}
        </li>
      </ol>
      <div className="grid gap-3 md:grid-cols-3">
        {(['google', 'bing', 'yandex'] as const).map((k) => (
          <label key={k} className={label}>
            {k === 'google' ? 'Google' : k === 'bing' ? 'Bing' : 'Yandex'} doğrulama kodu
            <input name={k} defaultValue={verification[k]} placeholder="<meta name=... content=...> ya da sadece kod" className={input} />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Kaydet
        </button>
        <a href="/sitemap.xml" target="_blank" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          Site haritasını gör <ExternalLink className="size-3.5" aria-hidden />
        </a>
        <Status state={state} />
      </div>
    </form>
  )
}

function BlogEditor({ posts }: { posts: BlogPost[] }) {
  const [editing, setEditing] = useState<BlogPost | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [state, action, pending] = useActionState<ActionState, FormData>(savePostAction, {})
  const [deleting, startDelete] = useTransition()

  const open = (post: BlogPost | null) => {
    setEditing(post)
    setFormKey((k) => k + 1)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <form key={formKey} action={action} className={card}>
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-primary" aria-hidden />
          <h2 className="font-display text-xl font-bold uppercase text-foreground">
            {editing ? 'Rehberi düzenle' : 'Yeni rehber yazısı'}
          </h2>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {'Her yazı Google\'da ayrı bir sayfa olarak çıkar. Başlığa aranan kelimeyi koy (ör. "Deneme bonusu veren siteler 2026"). İçerikte "## " ile ara başlık, "- " ile madde açabilirsin.'}
        </p>
        <input type="hidden" name="id" value={editing?.id ?? ''} />
        <label className={label}>
          Başlık
          <input name="title" required maxLength={120} defaultValue={editing?.title} className={input} />
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className={label}>
            Adres (boş bırakırsan başlıktan oluşur)
            <input name="slug" maxLength={90} defaultValue={editing?.slug} placeholder="deneme-bonusu-veren-siteler" className={input} />
          </label>
          <label className={label}>
            Anahtar kelimeler (virgülle)
            <input name="keywords" maxLength={300} defaultValue={editing?.keywords} placeholder="deneme bonusu, promo kod" className={input} />
          </label>
        </div>
        <label className={label}>
          Özet (Google sonucunda görünür, en fazla 200)
          <textarea name="excerpt" required maxLength={200} rows={2} defaultValue={editing?.excerpt} className={input} />
        </label>
        <label className={label}>
          İçerik
          <textarea name="body" required rows={12} defaultValue={editing?.body} className={`${input} font-mono`} />
        </label>
        <label className={label}>
          Kapak görseli linki (isteğe bağlı)
          <ImageField key={editing?.slug ?? 'new'} name="cover" defaultValue={editing?.cover ?? ''} uploadId="guide-cover" />
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
            <button type="button" onClick={() => open(null)} className="rounded-xl border border-border px-4 py-2.5 text-sm text-foreground hover:bg-secondary">
              Yeni yazı
            </button>
          ) : null}
          <Status state={state} />
        </div>
      </form>

      <section className={card} aria-label="Yazılar">
        <h3 className="font-semibold text-foreground">Yazılar ({posts.length})</h3>
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz yazı yok.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {posts.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-xl border border-border p-2">
                <button type="button" onClick={() => open(p)} className="flex min-w-0 flex-1 flex-col text-left">
                  <span className="truncate text-sm font-semibold text-foreground">{p.title}</span>
                  <span className="text-xs text-muted-foreground">{p.published ? `/rehber/${p.slug}` : 'Taslak'}</span>
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
  )
}

function DealsCard({ deals, publishing }: { deals: Deal[]; publishing: boolean }) {
  const [pending, start] = useTransition()
  return (
    <section className={card} aria-label="Fırsat sayfaları">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap className="size-5 text-primary" aria-hidden />
          <h2 className="font-display text-xl font-bold uppercase text-foreground">Fırsat sayfaları</h2>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            defaultChecked={publishing}
            disabled={pending}
            onChange={(e) => {
              const on = e.currentTarget.checked
              start(() => setDealsPublishingAction(on))
            }}
            className="size-4 accent-primary"
          />
          Telegram postlarını siteye de yayınla
        </label>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {'Açıksa Telegram botunun paylaştığı özel oran postları siteye kaydedilir ve Özel oranlar sayfasında görünür. Kapatırsan yeni postlar siteye düşmez.'}
      </p>
      {deals.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz fırsat sayfası yok.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {deals.map((d) => (
            <li key={d.id} className="flex items-center gap-2 rounded-xl border border-border p-2">
              <a href={d.link || '/ozel-oranlar'} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold text-foreground">{d.title}</span>
                <span className="text-xs text-muted-foreground">
                  {d.brand} · {DEAL_LABELS[d.kind]}
                </span>
              </a>
              <button
                type="button"
                disabled={pending}
                onClick={() => confirm('Fırsat sayfası silinsin mi?') && start(() => deleteDealAction(d.id))}
                className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-destructive"
                aria-label={`${d.title} sayfasını sil`}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
