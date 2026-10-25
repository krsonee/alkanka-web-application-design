'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, ArrowRight, CircleAlert, CircleCheck, Loader2, Trash2 } from 'lucide-react'
import { clear404Action, deleteRedirectAction, saveRedirectAction } from '@/app/panel/seo-actions'
import type { HealthIssue, NotFoundHit, Redirect } from '@/lib/seo-health'

const input =
  'min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'
const card = 'flex flex-col gap-4 rounded-2xl border border-border bg-card p-5'

type Props = { issues: HealthIssue[]; notFound: NotFoundHit[]; redirects: Redirect[]; siteUrl: string }

export function SeoHealthCard({ issues, notFound, redirects, siteUrl }: Props) {
  const errors = issues.filter((i) => i.level === 'hata').length
  const warnings = issues.length - errors
  const score = Math.max(0, 100 - errors * 12 - warnings * 4)

  return (
    <>
      <section className={card} aria-labelledby="seo-saglik">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="seo-saglik" className="font-display text-lg font-bold text-foreground">SEO sağlık kontrolü</h2>
            <p className="text-sm text-muted-foreground">Yayındaki yazılar ve kırık adresler otomatik taranır.</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-xl px-3 py-1.5 font-display text-2xl font-bold ${
                score >= 80 ? 'bg-primary/10 text-primary' : score >= 50 ? 'bg-accent/15 text-accent-foreground' : 'bg-destructive/10 text-destructive'
              }`}
            >
              {score}
              <span className="text-sm font-semibold">/100</span>
            </span>
            <span className="text-xs text-muted-foreground">
              {errors} hata · {warnings} uyarı
            </span>
          </div>
        </div>

        {issues.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl bg-primary/10 p-3 text-sm font-semibold text-primary">
            <CircleCheck className="size-4" aria-hidden />
            Sorun bulunamadı. Yeni yazı eklemeye devam et.
          </p>
        ) : (
          <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
            {issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl border border-border p-3">
                {issue.level === 'hata' ? (
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Hata" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Uyarı" />
                )}
                <div className="flex min-w-0 flex-col gap-0.5">
                  <a
                    href={issue.href.startsWith('#') ? issue.href : `${siteUrl}${issue.href}`}
                    target={issue.href.startsWith('#') ? undefined : '_blank'}
                    rel="noreferrer"
                    className="truncate text-sm font-semibold text-foreground hover:text-primary"
                  >
                    {issue.target}
                  </a>
                  <p className="text-sm leading-relaxed text-muted-foreground">{issue.message}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <RedirectsCard notFound={notFound} redirects={redirects} />
    </>
  )
}

function RedirectsCard({ notFound, redirects }: { notFound: NotFoundHit[]; redirects: Redirect[] }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  const run = (fn: () => Promise<{ ok: boolean; message: string }>, reset = false) =>
    start(async () => {
      const res = await fn()
      setMessage({ ok: res.ok, text: res.message })
      if (res.ok && reset) {
        setFrom('')
        setTo('')
      }
    })

  return (
    <section id="yonlendirme" className={card} aria-labelledby="yonlendirme-baslik">
      <div className="flex flex-col gap-1">
        <h2 id="yonlendirme-baslik" className="font-display text-lg font-bold text-foreground">404 kaydı ve yönlendirmeler</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Bir yazının adresini değiştirdiysen ya da sildiysen eski adresi yenisine bağla. Google eski adresin gücünü yeni adrese aktarır (301).
        </p>
      </div>

      <form
        className="flex flex-col gap-2 md:flex-row md:items-center"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => saveRedirectAction(from, to), true)
        }}
      >
        <label className="sr-only" htmlFor="redir-from">Eski adres</label>
        <input id="redir-from" className={input} placeholder="/eski-adres" value={from} onChange={(e) => setFrom(e.target.value)} required />
        <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground md:block" aria-hidden />
        <label className="sr-only" htmlFor="redir-to">Yeni adres</label>
        <input id="redir-to" className={input} placeholder="/rehber/yeni-adres" value={to} onChange={(e) => setTo(e.target.value)} required />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Yönlendir
        </button>
      </form>
      {message && (
        <p role="status" className={`text-sm font-semibold ${message.ok ? 'text-primary' : 'text-destructive'}`}>
          {message.text}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-foreground">Bulunamayan adresler</h3>
          {notFound.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz kırık adres kaydı yok.</p>
          ) : (
            <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
              {notFound.map((n) => (
                <li key={n.path} className="flex items-center gap-2 rounded-xl border border-border p-2.5 text-sm">
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-bold text-foreground">{n.hits}x</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground" title={n.referrer ? `Geldiği yer: ${n.referrer}` : undefined}>
                    {n.path}
                  </span>
                  <button type="button" className="text-xs font-semibold text-primary" onClick={() => setFrom(n.path)}>
                    Yönlendir
                  </button>
                  <button
                    type="button"
                    aria-label={`${n.path} kaydını sil`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => run(() => clear404Action(n.path))}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-foreground">Aktif yönlendirmeler</h3>
          {redirects.length === 0 ? (
            <p className="text-sm text-muted-foreground">Yönlendirme eklenmedi.</p>
          ) : (
            <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
              {redirects.map((r) => (
                <li key={r.from} className="flex items-center gap-2 rounded-xl border border-border p-2.5">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                    {r.from} <span className="text-muted-foreground">{'→'}</span> {r.to}
                  </span>
                  <button
                    type="button"
                    aria-label={`${r.from} yönlendirmesini sil`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => run(() => deleteRedirectAction(r.from))}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
