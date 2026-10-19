'use client'

import { useState } from 'react'
import { BadgeCheck, CalendarClock, Check, Clock, Copy, ExternalLink, ShieldCheck, Trash2, Trophy } from 'lucide-react'
import { joinSocialEventAction, linkSocialAccountAction, removeSocialAccountAction } from '@/app/actions/social'
import { StatusLine, useAction } from '../community/use-action'
import { SocialIcon } from '../social-icons'
import {
  PLATFORM_LABEL,
  SOCIAL_PLATFORMS,
  profileUrl,
  type MyEntry,
  type SocialAccount,
  type SocialEvent,
  type SocialLinks,
  type SocialPlatform,
} from '@/lib/social-shared'
import { cn } from '@/lib/utils'

const inputCls =
  'h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20'

const PLACEHOLDER: Record<SocialPlatform, string> = { x: '@kullaniciadi', instagram: '@kullaniciadi', youtube: '@kanaladi', twitch: 'kullaniciadi' }

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      }}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 font-mono text-sm font-bold tracking-wider text-primary"
    >
      {code}
      {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      <span className="sr-only">{copied ? 'Kopyalandı' : 'Kodu kopyala'}</span>
    </button>
  )
}

function PlatformRow({ platform, account, official }: { platform: SocialPlatform; account?: SocialAccount; official?: string }) {
  const [handle, setHandle] = useState('')
  const { pending, status, run } = useAction()
  const label = PLATFORM_LABEL[platform]
  const showForm = !account || account.status === 'rejected'

  return (
    <li className="@container flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-foreground">
          <SocialIcon platform={platform} className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-bold text-foreground">{label}</span>
          {account && account.status !== 'rejected' ? (
            <a href={profileUrl(platform, account.handle)} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-muted-foreground hover:text-foreground">
              @{account.handle}
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">Bağlı değil</span>
          )}
        </div>
        {account?.status === 'verified' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-live/15 px-2.5 py-1 text-xs font-bold text-live">
            <BadgeCheck className="size-3.5" aria-hidden /> Doğrulandı
          </span>
        )}
        {account?.status === 'pending' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-muted-foreground">
            <Clock className="size-3.5" aria-hidden /> İnceleniyor
          </span>
        )}
        {account && account.status !== 'rejected' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => removeSocialAccountAction(platform))}
            aria-label={`${label} bağlantısını kaldır`}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {account?.status === 'pending' && (
        <ol className="flex flex-col gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/[0.04] p-3 text-sm text-muted-foreground">
          <li>
            <b className="text-foreground">1.</b>{' '}
            {official ? (
              <a href={official} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline-offset-4 hover:underline">
                Resmi {label} hesabımızı takip et
              </a>
            ) : (
              `Resmi ${label} hesabımızı takip et`
            )}
            .
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <span><b className="text-foreground">2.</b> Bu kodu profil açıklamana (bio) ekle:</span>
            <CopyCode code={account.code} />
          </li>
          <li>
            <b className="text-foreground">3.</b> Ekibimiz kontrol edip onaylar. Onaydan sonra kodu bio&apos;ndan silebilirsin.
          </li>
        </ol>
      )}

      {account?.status === 'rejected' && (
        <p className="text-xs text-destructive">
          @{account.handle} onaylanmadı{account.note ? `: ${account.note}` : '.'} Doğru hesabı yeniden ekleyebilirsin.
        </p>
      )}

      {showForm && (
        <form
          className="flex flex-col gap-2 @sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => linkSocialAccountAction(platform, handle), () => setHandle(''))
          }}
        >
          <label htmlFor={`social-${platform}`} className="sr-only">{label} kullanıcı adın</label>
          <input id={`social-${platform}`} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder={PLACEHOLDER[platform]} className={inputCls} />
          <button type="submit" disabled={pending || handle.trim().length < 3} className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
            Bağla
          </button>
        </form>
      )}
      <StatusLine status={status} />
    </li>
  )
}

export function SocialAccountsCard({ accounts, links }: { accounts: SocialAccount[]; links: SocialLinks }) {
  const byPlatform = Object.fromEntries(accounts.map((a) => [a.platform, a])) as Partial<Record<SocialPlatform, SocialAccount>>
  return (
    <section aria-labelledby="sosyal-hesaplar" className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex flex-col gap-1 border-b border-border p-5">
        <h3 id="sosyal-hesaplar" className="font-display text-base font-bold text-foreground">Sosyal medya hesaplarım</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Hesabını bağla ve doğrulat. Doğrulanmış hesaplar sosyal medya etkinliklerine katılıp KP kazanır.
        </p>
      </header>
      <ul className="flex flex-col divide-y divide-border">
        {SOCIAL_PLATFORMS.map((p) => (
          <PlatformRow key={p} platform={p} account={byPlatform[p]} official={links[p]} />
        ))}
      </ul>
      <p className="flex items-start gap-2 border-t border-border bg-background/40 p-4 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        Bir sosyal hesap sadece bir üyeye bağlanabilir. Sahte veya bot hesaplar reddedilir; tekrarlayan denemelerde üyelik incelemeye alınır.
      </p>
    </section>
  )
}

function EventItem({ event, entry, verified }: { event: SocialEvent; entry?: MyEntry; verified: boolean }) {
  const [url, setUrl] = useState('')
  const { pending, status, run } = useAction()
  const label = PLATFORM_LABEL[event.platform]

  return (
    <li className="@container flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <SocialIcon platform={event.platform} className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm font-bold text-foreground text-pretty">{event.title}</span>
          {event.description && <p className="text-xs leading-relaxed text-muted-foreground">{event.description}</p>}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {event.endsAt && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3.5" aria-hidden />
                {new Date(event.endsAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} bitiyor
              </span>
            )}
            <span>{event.entries} onaylı katılım</span>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">
          <Trophy className="size-3.5" aria-hidden /> {event.reward} KP
        </span>
      </div>

      <a href={event.postUrl} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline">
        Gönderiye git <ExternalLink className="size-3.5" aria-hidden />
      </a>

      {entry ? (
        <p
          className={cn(
            'rounded-lg px-3 py-2 text-xs font-semibold',
            entry.status === 'approved' && 'bg-live/15 text-live',
            entry.status === 'pending' && 'bg-secondary text-muted-foreground',
            entry.status === 'rejected' && 'bg-destructive/10 text-destructive',
          )}
        >
          {entry.status === 'approved'
            ? `Onaylandı, ${event.reward} KP hesabına eklendi.`
            : entry.status === 'pending'
              ? 'Katılımın inceleniyor.'
              : `Katılım reddedildi${entry.note ? `: ${entry.note}` : '.'}`}
        </p>
      ) : verified ? (
        <form
          className="flex flex-col gap-2 @md:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => joinSocialEventAction(event.id, url), () => setUrl(''))
          }}
        >
          <label htmlFor={`event-${event.id}`} className="sr-only">Yorumunun linki</label>
          <input
            id={`event-${event.id}`}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Yorumunun linkini yapıştır"
            className={inputCls}
          />
          <button type="submit" disabled={pending || url.trim().length < 12} className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
            Katıldım
          </button>
        </form>
      ) : (
        <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
          Katılmak için önce {label} hesabını yukarıdan bağlayıp doğrulat.
        </p>
      )}
      <StatusLine status={status} />
    </li>
  )
}

export function SocialEventsCard({ events, entries, accounts }: { events: SocialEvent[]; entries: MyEntry[]; accounts: SocialAccount[] }) {
  const verified = new Set(accounts.filter((a) => a.status === 'verified').map((a) => a.platform))
  const byEvent = Object.fromEntries(entries.map((e) => [e.eventId, e])) as Record<number, MyEntry>
  return (
    <section aria-labelledby="sosyal-etkinlik" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 id="sosyal-etkinlik" className="font-display text-base font-bold text-foreground">Sosyal medya etkinlikleri</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Hesabımızı takip et, gönderiye yorum yap ve yorumunun linkini gönder. Ekip kontrol edince KP hesabına geçer.
        </p>
      </div>
      {events.length ? (
        <ul className="grid gap-3 lg:grid-cols-2">
          {events.map((e) => (
            <EventItem key={e.id} event={e} entry={byEvent[e.id]} verified={verified.has(e.platform)} />
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          Şu an açık etkinlik yok. Yeni etkinlikler açıldığında burada görünecek.
        </p>
      )}
    </section>
  )
}
