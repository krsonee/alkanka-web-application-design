'use client'


import { askConfirm } from '@/components/panel/confirm-dialog'
import { SeoGuide } from '@/components/panel/area-guides'
import { useActionState, useTransition } from 'react'
import { CheckCircle2, ExternalLink, Loader2, Search, Trash2, Zap } from 'lucide-react'
import {
  deleteDealAction,
  saveVerificationAction,
  setDealsPublishingAction,
} from '@/app/panel/seo-actions'
import type { ActionState } from '@/app/panel/actions'
import type { BlogPost } from '@/lib/blog'
import { DEAL_LABELS, type Deal, type Verification } from '@/lib/deal-types'
import { BlogEditor } from '@/components/panel/blog-editor'
import { SeoHealthCard } from '@/components/panel/seo-health-card'
import type { HealthIssue, NotFoundHit, Redirect } from '@/lib/seo-health'

type Props = {
  posts: BlogPost[]
  deals: Deal[]
  publishing: boolean
  verification: Verification
  siteUrl: string
  issues: HealthIssue[]
  notFound: NotFoundHit[]
  redirects: Redirect[]
}

const input =
  'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'
const card = 'flex flex-col gap-4 rounded-2xl border border-border bg-card p-5'
const label = 'flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground'

export function SeoManager({ posts, deals, publishing, verification, siteUrl, issues, notFound, redirects }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <SetupHub verification={verification} />
      <SeoGuide />
      <SearchConsoleCard verification={verification} siteUrl={siteUrl} />
      <SeoHealthCard issues={issues} notFound={notFound} redirects={redirects} siteUrl={siteUrl} />
      <BlogEditor posts={posts} siteUrl={siteUrl} />
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

function openSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  if (el instanceof HTMLDetailsElement) el.open = true
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function SetupHub({ verification }: { verification: Verification }) {
  const items = [
    {
      title: 'SEO eğitim rehberi',
      body: '13 adım: Search Console kurulumu, kelime bulma, yazı yazma, link, ölçüm ve haftalık rutin.',
      done: false,
      action: () => openSection('seo-rehber'),
    },
    {
      title: 'Google, Bing, Yandex ve Meta doğrulama',
      body: 'Meta (Facebook) alan adı doğrulama kutusu bu sekmede, hemen aşağıdaki kartta.',
      done: Boolean(verification.google && verification.meta),
      action: () => openSection('site-dogrulama'),
    },
  ]
  return (
    <section className={card} aria-labelledby="setup-hub-title">
      <div className="flex flex-col gap-1">
        <h2 id="setup-hub-title" className="font-display text-xl font-bold uppercase text-foreground">
          Kurulum ve eğitim merkezi
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Nereden başlayacağını bilmiyorsan sırayla bunları yap. Her biri seni ilgili kutuya ya da rehbere götürür.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {items.map((it) => (
          <button
            key={it.title}
            type="button"
            onClick={it.action}
            className="flex flex-col gap-1.5 rounded-xl border border-border bg-secondary p-4 text-left transition-colors hover:border-primary"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              {it.done ? <CheckCircle2 className="size-4 text-primary" aria-hidden /> : null}
              {it.title}
            </span>
            <span className="text-xs leading-relaxed text-muted-foreground">{it.body}</span>
          </button>
        ))}
        <a
          href="/panel?b=marketing"
          className="flex flex-col gap-1.5 rounded-xl border border-border bg-secondary p-4 text-left transition-colors hover:border-primary"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            Meta Pixel, Google Ads ve reklam rehberi
            <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden />
          </span>
          <span className="text-xs leading-relaxed text-muted-foreground">
            Pazarlama sekmesinde: Meta İşletme hesabı, reklam hesabı onayı, Pixel kodu, Google Ads doğrulaması ve kampanyalar.
          </span>
        </a>
      </div>
    </section>
  )
}

function SearchConsoleCard({ verification, siteUrl }: { verification: Verification; siteUrl: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveVerificationAction, {})
  return (
    <form id="site-dogrulama" action={action} className={`${card} scroll-mt-24`}>
      <div className="flex items-center gap-2">
        <Search className="size-5 text-primary" aria-hidden />
        <h2 className="font-display text-xl font-bold uppercase text-foreground">Site doğrulama: Google, Bing, Yandex ve Meta</h2>
      </div>
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
        <li>
          <a href="https://search.google.com/search-console" target="_blank" rel="noopener" className="font-semibold text-primary underline">
            Google Search Console
          </a>
          {"'a gir, \"Mülk ekle\" de ve sağdaki "}
          <strong className="text-foreground">{'"URL öneki"'}</strong>
          {' kutusuna '}
          <code className="rounded bg-secondary px-1 text-foreground">{siteUrl}</code>
          {' yaz. Soldaki "Alan adı" kutusunu seçme, o DNS kaydı ister ve buradan çalışmaz.'}
        </li>
        <li>{'"HTML etiketi" yöntemini seç, verilen <meta ...> satırını aşağıya yapıştır ve kaydet.'}</li>
        <li>{"Search Console'da \"Doğrula\" de."}</li>
        <li>
          {'Soldan "Site haritaları" bölümüne '}
          <code className="rounded bg-secondary px-1 text-foreground">sitemap.xml</code>
          {' yaz ve gönder. Bing ve Yandex için de aynı adımlar.'}
        </li>
        <li>
          <strong className="text-foreground">Meta için:</strong>
          {' business.facebook.com → İşletme ayarları → Marka güvenliği → Alan adları → Ekle. "Meta etiketi" yöntemini seç, verilen satırı aşağıdaki Meta kutusuna yapıştır, kaydet ve Meta\'da "Doğrula" de. Detaylı anlatım Pazarlama sekmesindeki rehberde.'}
        </li>
      </ol>
      <div className="grid gap-3 md:grid-cols-2">
        {(['google', 'bing', 'yandex', 'meta'] as const).map((k) => (
          <label key={k} className={label}>
            {k === 'google' ? 'Google' : k === 'bing' ? 'Bing' : k === 'yandex' ? 'Yandex' : 'Meta (Facebook) alan adı'} doğrulama kodu
            <input name={k} defaultValue={verification[k]} placeholder="<meta name=... content=...> ya da sadece kod" className={input} />
            {verification[k] ? (
              <span className="flex items-center gap-1.5 font-medium text-primary">
                <CheckCircle2 className="size-3.5" aria-hidden />
                Kod sitede yayında, doğrulama tamam
              </span>
            ) : (
              <span className="font-normal">Henüz bağlanmadı</span>
            )}
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
                onClick={() => void askConfirm('Fırsat sayfası silinsin mi?').then((ok) => ok && start(() => deleteDealAction(d.id)))}
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
