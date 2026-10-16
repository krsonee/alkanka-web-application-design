'use client'

import { useState, useTransition } from 'react'
import { Check, Copy, ExternalLink, Link2, Loader2, Pause, Pencil, Play, Plus, Radar, Star, Trash2, X } from 'lucide-react'
import { checkAffLinkAction, deleteAffLinkAction, saveAffLinkAction, toggleAffLinkAction } from '@/app/panel/growth-actions'
import type { AffLinkView, AffMode } from '@/lib/aff-links'
import { cn } from '@/lib/utils'

export type AffSiteOption = { id: number; name: string; slug: string; active: boolean }
type Props = { links: AffLinkView[]; sites: AffSiteOption[]; siteUrl: string }
type Msg = { ok: boolean; message: string } | null
type Draft = { id?: number; code: string; siteId: string; label: string; affUrl: string; mode: AffMode; primary: boolean; active: boolean }

const input = 'rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none'
const btn = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50'
const ghost = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50'

const EMPTY: Draft = { code: '', siteId: '', label: '', affUrl: '', mode: 'follow', primary: true, active: true }

function slugCode(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function hostOf(url: string) {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className={ghost}
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setDone(true)
        setTimeout(() => setDone(false), 1500)
      }}
    >
      {done ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      {done ? 'Kopyalandı' : 'Kopyala'}
    </button>
  )
}

function Spark({ data }: { data: number[] }) {
  const max = Math.max(1, ...data)
  return (
    <div className="flex h-8 items-end gap-0.5" aria-label={`Son 14 gün tıklama: ${data.join(', ')}`} role="img">
      {data.map((n, i) => (
        <span key={i} className={cn('w-1.5 rounded-sm', n ? 'bg-primary' : 'bg-secondary')} style={{ height: `${Math.max(8, (n / max) * 100)}%` }} />
      ))}
    </div>
  )
}

function Editor({ draft, sites, siteUrl, onClose }: { draft: Draft; sites: AffSiteOption[]; siteUrl: string; onClose?: () => void }) {
  const [d, setD] = useState<Draft>(draft)
  const [codeTouched, setCodeTouched] = useState(Boolean(draft.id))
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<Msg>(null)
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }))
  const site = sites.find((s) => String(s.id) === d.siteId)
  const affHost = hostOf(d.affUrl)

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const r = await saveAffLinkAction({
            id: d.id,
            code: d.code,
            siteId: d.siteId ? Number(d.siteId) : null,
            label: d.label,
            affUrl: d.affUrl,
            mode: d.siteId ? d.mode : 'fixed',
            primary: Boolean(d.siteId) && d.primary,
            active: d.active,
          })
          setMsg(r)
          if (r.ok && !d.id) {
            setD(EMPTY)
            setCodeTouched(false)
          }
          if (r.ok && onClose) onClose()
        })
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Sponsor
          <select
            className={input}
            value={d.siteId}
            onChange={(e) => {
              const next = sites.find((s) => String(s.id) === e.target.value)
              set({ siteId: e.target.value, ...(codeTouched || !next ? {} : { code: slugCode(next.slug || next.name) }) })
            }}
          >
            <option value="">Sponsora bağlı değil</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.active ? '' : ' (pasif)'}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Etiket (sadece sen görürsün)
          <input className={input} value={d.label} onChange={(e) => set({ label: e.target.value })} placeholder="Ör. Ekim kampanyası, hoş geldin bonusu" maxLength={80} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
        Sponsorun verdiği affiliate linki
        <input
          className={cn(input, 'font-mono text-xs')}
          value={d.affUrl}
          onChange={(e) => set({ affUrl: e.target.value })}
          placeholder="https://sponsorsite.com/tr/register?btag=SENIN_KODUN"
          inputMode="url"
          required
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
        Kısa link
        <div className="flex items-stretch overflow-hidden rounded-lg border border-input bg-background focus-within:border-primary">
          <span className="flex items-center bg-secondary px-3 font-mono text-xs text-muted-foreground">{siteUrl.replace(/^https?:\/\//, '')}/r/</span>
          <input
            className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-sm text-foreground focus:outline-none"
            value={d.code}
            onChange={(e) => {
              setCodeTouched(true)
              set({ code: slugCode(e.target.value) })
            }}
            placeholder="makro"
            required
            minLength={2}
            aria-label="Kısa kod"
          />
        </div>
      </label>

      {d.siteId ? (
        <fieldset className="flex flex-col gap-2 rounded-xl border border-border p-3">
          <legend className="px-1 text-xs font-semibold text-muted-foreground">Yönlendirme</legend>
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input type="radio" name={`mode-${d.id ?? 'new'}`} className="mt-1 size-4 accent-primary" checked={d.mode === 'follow'} onChange={() => set({ mode: 'follow' })} />
            <span className="flex flex-col">
              <b>Güncel adrese aff koduyla yönlendir</b>
              <span className="text-xs leading-relaxed text-muted-foreground">
                Linkteki yol ve aff kodun korunur, alan adı sponsorun güncel adresiyle değişir. Site adres değiştirince linkini yenilemen gerekmez.
                {site ? ` Şu an: ${affHost || '...'} → güncel adres kullanılır.` : ''}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input type="radio" name={`mode-${d.id ?? 'new'}`} className="mt-1 size-4 accent-primary" checked={d.mode === 'fixed'} onChange={() => set({ mode: 'fixed' })} />
            <span className="flex flex-col">
              <b>Linki aynen kullan</b>
              <span className="text-xs leading-relaxed text-muted-foreground">
                Sponsorun linki kendi takip alan adındaysa (ör. track.sponsor.com, go.aff...) bunu seç. Link hiç değiştirilmeden açılır.
              </span>
            </span>
          </label>
          <label className="mt-1 flex items-start gap-2 border-t border-border pt-2 text-sm text-foreground">
            <input type="checkbox" className="mt-1 size-4 accent-primary" checked={d.primary} onChange={(e) => set({ primary: e.target.checked })} />
            <span className="flex flex-col">
              <b>Sitedeki tüm “Git” butonları bu linki kullansın</b>
              <span className="text-xs leading-relaxed text-muted-foreground">Bir sponsorda tek ana link olur. Bunu işaretlersen önceki ana link normal linke döner.</span>
            </span>
          </label>
        </fieldset>
      ) : null}

      {msg ? <p role="status" className={cn('break-all text-sm', msg.ok ? 'text-primary' : 'text-destructive')}>{msg.message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={btn} disabled={pending || !d.affUrl.trim() || d.code.length < 2}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : d.id ? <Check className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          {d.id ? 'Değişiklikleri kaydet' : 'Linki ekle'}
        </button>
        {onClose ? (
          <button type="button" className={cn(ghost, 'h-9')} onClick={onClose}>
            <X className="size-4" aria-hidden="true" /> Vazgeç
          </button>
        ) : null}
      </div>
    </form>
  )
}

function LinkRow({ link, sites, siteUrl }: { link: AffLinkView; sites: AffSiteOption[]; siteUrl: string }) {
  const [editing, setEditing] = useState(false)
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<Msg>(null)
  const short = `${siteUrl}/r/${link.code}`
  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => start(async () => setMsg(await fn()))

  if (editing) {
    return (
      <li className="border-b border-border p-4 last:border-0">
        <Editor
          sites={sites}
          siteUrl={siteUrl}
          onClose={() => setEditing(false)}
          draft={{
            id: link.id,
            code: link.code,
            siteId: link.siteId === null ? '' : String(link.siteId),
            label: link.label,
            affUrl: link.affUrl,
            mode: link.mode,
            primary: link.primary,
            active: link.active,
          }}
        />
      </li>
    )
  }

  return (
    <li className={cn('flex flex-col gap-3 border-b border-border p-4 last:border-0', !link.active && 'opacity-60')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">{link.siteName ?? 'Bağımsız link'}</span>
            {link.label ? <span className="text-sm text-muted-foreground">· {link.label}</span> : null}
            {link.primary ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                <Star className="size-3" aria-hidden="true" /> Git butonu
              </span>
            ) : null}
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-foreground">{link.mode === 'follow' ? 'Güncel adres takibi' : 'Sabit link'}</span>
            {!link.active ? <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">Durduruldu</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="truncate rounded-md bg-secondary px-2 py-1 text-xs font-semibold text-foreground">{short}</code>
            <CopyButton value={short} />
            <a href={short} target="_blank" rel="noopener noreferrer" className={ghost}>
              <ExternalLink className="size-3.5" aria-hidden="true" /> Test et
            </a>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Spark data={link.stats.daily} />
          <span className="text-[11px] text-muted-foreground">Son 14 gün</span>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        {[
          ['Bugün (24s)', link.stats.day],
          ['7 gün', link.stats.week],
          ['Toplam', link.stats.total],
          ['Tekil kişi', link.stats.uniques],
          ['Üye tıklaması', link.stats.members],
        ].map(([label, n]) => (
          <div key={label as string} className="flex flex-col rounded-lg bg-secondary px-3 py-2">
            <dt className="text-[11px] text-muted-foreground">{label}</dt>
            <dd className="font-semibold tabular-nums text-foreground">{Number(n).toLocaleString('tr-TR')}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <span className="break-all">
          <b className="text-foreground">Sponsor linki:</b> {link.affUrl}
        </span>
        <span className="break-all">
          <b className="text-foreground">Şu an gidilen adres:</b> {link.target ?? 'Hesaplanamadı'}
          {link.mode === 'follow' && !link.currentHost ? ' (sponsorun güncel adresi girilmemiş, link aynen kullanılıyor)' : ''}
        </span>
        {link.prevUrl ? <span className="break-all">Önceki link: {link.prevUrl}</span> : null}
        {link.stats.sources.length ? (
          <span className="flex flex-wrap items-center gap-1.5 pt-1">
            Kaynaklar (30 gün):
            {link.stats.sources.map((s) => (
              <span key={s.src} className="rounded-full bg-secondary px-2 py-0.5 text-foreground">
                {s.src}: <b className="tabular-nums">{s.n}</b>
              </span>
            ))}
          </span>
        ) : null}
      </div>

      {msg ? <p role="status" className={cn('break-all text-sm', msg.ok ? 'text-primary' : 'text-destructive')}>{msg.message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={ghost} onClick={() => setEditing(true)}>
          <Pencil className="size-3.5" aria-hidden="true" /> Düzenle / linki yenile
        </button>
        <button type="button" className={ghost} disabled={pending} onClick={() => run(() => checkAffLinkAction(link.id))}>
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Radar className="size-3.5" aria-hidden="true" />} Hedefi kontrol et
        </button>
        <button type="button" className={ghost} disabled={pending} onClick={() => run(() => toggleAffLinkAction(link.id, !link.active))}>
          {link.active ? <Pause className="size-3.5" aria-hidden="true" /> : <Play className="size-3.5" aria-hidden="true" />}
          {link.active ? 'Durdur' : 'Aç'}
        </button>
        <button
          type="button"
          className={cn(ghost, 'text-destructive')}
          disabled={pending}
          onClick={() => {
            if (window.confirm(`${short} silinsin mi? Tıklama geçmişi de silinir ve link çalışmaz.`)) run(() => deleteAffLinkAction(link.id))
          }}
        >
          <Trash2 className="size-3.5" aria-hidden="true" /> Sil
        </button>
      </div>
    </li>
  )
}

export function AffLinksManager({ links, sites, siteUrl }: Props) {
  const total = links.reduce((n, l) => n + l.stats.week, 0)
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-lg font-bold text-foreground">Sponsor affiliate linkleri</h2>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Sponsorun kendi affiliate panelinden sana verdiği linki buraya yapıştır. Sistem onu kendi kısa linkine çevirir, her tıklamayı sayar ve ziyaretçiyi sponsorun güncel sitesine senin aff kodunla gönderir.
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {links.length} link · son 7 gün <b className="tabular-nums text-foreground">{total.toLocaleString('tr-TR')}</b> tıklama
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-border p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Yeni link ekle</h3>
        <Editor draft={EMPTY} sites={sites} siteUrl={siteUrl} />
      </div>

      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz link yok. Sponsorun verdiği ilk linki yukarıdan ekle.</p>
      ) : (
        <ul className="flex flex-col rounded-xl border border-border">
          {links.map((link) => (
            <LinkRow key={`${link.id}-${link.updatedAt}`} link={link} sites={sites} siteUrl={siteUrl} />
          ))}
        </ul>
      )}
    </section>
  )
}
