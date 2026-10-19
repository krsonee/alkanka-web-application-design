'use client'

import { HideButton } from '@/components/panel/hide-button'
import { useState, useTransition, type ComponentProps } from 'react'
import { SocialApiForm } from '@/components/panel/social-api-form'
import { Check, ExternalLink, Loader2, Trash2, X } from 'lucide-react'
import {
  createSocialEventAction,
  deleteSocialEventAction,
  reviewEntryAction,
  reviewSocialAccountAction,
  saveSocialLinksAction,
} from '@/app/panel/social-actions'
import { SocialGuide } from '@/components/panel/social-guide'
import type { AdminEntry, AdminSocialAccount } from '@/lib/social'
import { PLATFORM_LABEL, SOCIAL_PLATFORMS, profileUrl, type SocialEvent, type SocialLinks, type SocialPlatform } from '@/lib/social-shared'
import { cn } from '@/lib/utils'

const input = 'rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none'
const card = 'flex flex-col gap-4 rounded-2xl border border-border bg-card p-5'
const btn = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50'
const ghost = 'inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50'

function useRunner() {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null)
  const run = (fn: () => Promise<{ ok: boolean; message: string }>, onOk?: () => void) =>
    start(async () => {
      const r = await fn()
      setMsg(r)
      if (r.ok) onOk?.()
    })
  return { pending, msg, run }
}

function Note({ msg }: { msg: { ok: boolean; message: string } | null }) {
  if (!msg) return null
  return <p role="status" className={cn('text-sm', msg.ok ? 'text-primary' : 'text-destructive')}>{msg.message}</p>
}

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-secondary text-muted-foreground',
  verified: 'bg-primary/15 text-primary',
  approved: 'bg-primary/15 text-primary',
  rejected: 'bg-destructive/15 text-destructive',
}
const STATUS_TXT: Record<string, string> = { pending: 'Bekliyor', verified: 'Doğrulandı', approved: 'Onaylandı', rejected: 'Reddedildi' }

function LinksForm({ links }: { links: SocialLinks }) {
  const [values, setValues] = useState<SocialLinks>(links)
  const { pending, msg, run } = useRunner()
  return (
    <form
      className={card}
      onSubmit={(e) => {
        e.preventDefault()
        run(() => saveSocialLinksAction(values))
      }}
    >
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold text-foreground">Resmi hesaplarımız</h3>
        <p className="text-sm text-muted-foreground">Profil linklerini yapıştır. Sol menüde ve üyelerin doğrulama adımlarında görünür. Boş bırakılan gizlenir.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {SOCIAL_PLATFORMS.map((p) => (
          <label key={p} className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">{PLATFORM_LABEL[p]}</span>
            <input
              type="url"
              value={values[p] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [p]: e.target.value }))}
              placeholder={profileUrl(p, 'alkanka')}
              className={input}
            />
          </label>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">Telegram kanalı</span>
          <input
            type="url"
            value={values.telegram ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, telegram: e.target.value }))}
            placeholder="https://t.me/AlkankaOfficial"
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">Ana sayfa &quot;Katıl&quot; butonu linki</span>
          <input
            type="text"
            value={values.join ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, join: e.target.value }))}
            placeholder="https://t.me/... veya /kampanyalar"
            className={input}
          />
          <span className="text-xs text-muted-foreground">Boş kalırsa Telegram kanalına yönlendirir.</span>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={btn}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Kaydet
        </button>
        <Note msg={msg} />
      </div>
    </form>
  )
}

function AccountsReview({ accounts }: { accounts: AdminSocialAccount[] }) {
  const { pending, msg, run } = useRunner()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const waiting = accounts.filter((a) => a.status === 'pending').length
  return (
    <section className={card}>
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold text-foreground">Üye hesap doğrulama {waiting > 0 && <span className="text-primary">({waiting} bekliyor)</span>}</h3>
        <p className="text-sm text-muted-foreground">
          Profili aç, açıklamada (bio) üyenin kodu var mı ve hesap gerçek mi kontrol et. Yeni açılmış, gönderisi/takipçisi olmayan hesapları reddet.
        </p>
      </div>
      <Note msg={msg} />
      {accounts.length ? (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {accounts.map((a) => {
            const key = `${a.userId}:${a.platform}`
            return (
              <li key={key} className="flex flex-col gap-2 p-3 md:flex-row md:items-center">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold text-foreground">
                    {a.userName} <span className="font-normal text-muted-foreground">· {PLATFORM_LABEL[a.platform]}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                    <a href={profileUrl(a.platform, a.handle)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      @{a.handle} <ExternalLink className="size-3" aria-hidden />
                    </a>
                    <span>Kod: <b className="font-mono text-foreground">{a.code}</b></span>
                    {a.email && <span>{a.email}</span>}
                  </span>
                </div>
                <span className={cn('w-fit rounded-full px-2.5 py-1 text-xs font-semibold', STATUS_CLS[a.status])}>{STATUS_TXT[a.status]}</span>
                {a.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <input
                      aria-label="Ret nedeni"
                      placeholder="Ret nedeni (isteğe bağlı)"
                      value={notes[key] ?? ''}
                      onChange={(e) => setNotes((n) => ({ ...n, [key]: e.target.value }))}
                      className={cn(input, 'h-8 w-44 py-1 text-xs')}
                    />
                    <button disabled={pending} onClick={() => run(() => reviewSocialAccountAction(a.userId, a.platform, true, ''))} className={ghost}>
                      <Check className="size-3.5" aria-hidden /> Onayla
                    </button>
                    <button disabled={pending} onClick={() => run(() => reviewSocialAccountAction(a.userId, a.platform, false, notes[key] ?? ''))} className={ghost}>
                      <X className="size-3.5" aria-hidden /> Reddet
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Henüz bağlanmış üye hesabı yok.</p>
      )}
    </section>
  )
}

function EventsAdmin({ events, entries }: { events: SocialEvent[]; entries: AdminEntry[] }) {
  const { pending, msg, run } = useRunner()
  const empty = { platform: 'instagram' as SocialPlatform, title: '', description: '', postUrl: '', reward: 50, endsAt: '' }
  const [form, setForm] = useState(empty)
  const waiting = entries.filter((e) => e.status === 'pending')

  return (
    <>
      <form
        className={card}
        onSubmit={(e) => {
          e.preventDefault()
          run(() => createSocialEventAction({ ...form, endsAt: form.endsAt || null }), () => setForm(empty))
        }}
      >
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold text-foreground">Yeni sosyal medya etkinliği</h3>
          <p className="text-sm text-muted-foreground">Örn. &quot;Takip et + yorum yap, 50 KP kazan&quot;. Sadece hesabı doğrulanmış üyeler katılabilir, her üye bir kez.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-[10rem_1fr]">
          <select aria-label="Platform" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value as SocialPlatform })} className={input}>
            {SOCIAL_PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
          </select>
          <input aria-label="Başlık" required placeholder="Başlık" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={input} />
        </div>
        <textarea aria-label="Açıklama" placeholder="Kurallar: hesabı takip et, gönderiye en az 3 kelimelik yorum yaz..." rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={input} />
        <div className="grid gap-3 md:grid-cols-[1fr_8rem_12rem]">
          <input aria-label="Gönderi linki" type="url" required placeholder="Gönderi linki" value={form.postUrl} onChange={(e) => setForm({ ...form, postUrl: e.target.value })} className={input} />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input aria-label="Ödül KP" type="number" min={0} max={10000} value={form.reward} onChange={(e) => setForm({ ...form, reward: Number(e.target.value) })} className={cn(input, 'w-full')} />
            KP
          </label>
          <input aria-label="Bitiş tarihi" type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className={input} />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className={btn}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Yayınla
          </button>
          <Note msg={msg} />
        </div>
      </form>

      <section className={card}>
        <h3 className="font-semibold text-foreground">Etkinlikler</h3>
        {events.length ? (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {events.map((ev) => (
              <li key={ev.id} className="flex flex-col gap-2 p-3 md:flex-row md:items-center">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-foreground">{ev.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {PLATFORM_LABEL[ev.platform]} · {ev.reward} KP · {ev.entries} katılım
                    {ev.endsAt ? ` · ${new Date(ev.endsAt).toLocaleString('tr-TR')} bitiş` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <a href={ev.postUrl} target="_blank" rel="noopener noreferrer" className={ghost}>Gönderi</a>
                  <HideButton key={`${ev.id}-${ev.active}`} kind="social" id={ev.id} hidden={!ev.active} label={ev.title} />
                  <button disabled={pending} aria-label={`${ev.title} sil`} onClick={() => confirm('Etkinlik ve katılımları silinsin mi?') && run(() => deleteSocialEventAction(ev.id))} className={ghost}>
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Henüz etkinlik yok.</p>
        )}
      </section>

      <section className={card}>
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold text-foreground">Katılım onayı {waiting.length > 0 && <span className="text-primary">({waiting.length} bekliyor)</span>}</h3>
          <p className="text-sm text-muted-foreground">Yorum linkini aç: yorum üyenin bağlı hesabından mı, takip ediyor mu, yorum anlamlı mı? Onaylayınca KP otomatik verilir.</p>
        </div>
        {entries.length ? (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {entries.map((en) => (
              <li key={`${en.eventId}:${en.userId}`} className="flex flex-col gap-2 p-3 md:flex-row md:items-center">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {en.userName} <span className="font-normal text-muted-foreground">· {en.eventTitle}</span>
                  </span>
                  <span className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {en.handle && <span>@{en.handle}</span>}
                    <a href={en.commentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      Yorumu aç <ExternalLink className="size-3" aria-hidden />
                    </a>
                  </span>
                </div>
                <span className={cn('w-fit rounded-full px-2.5 py-1 text-xs font-semibold', STATUS_CLS[en.status])}>{STATUS_TXT[en.status]}</span>
                {en.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button disabled={pending} onClick={() => run(() => reviewEntryAction(en.eventId, en.userId, true, ''))} className={ghost}>
                      <Check className="size-3.5" aria-hidden /> Onayla
                    </button>
                    <button disabled={pending} onClick={() => run(() => reviewEntryAction(en.eventId, en.userId, false, 'Kurallara uymuyor'))} className={ghost}>
                      <X className="size-3.5" aria-hidden /> Reddet
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Henüz katılım yok.</p>
        )}
      </section>
    </>
  )
}

export function SocialManager({
  links,
  accounts,
  events,
  entries,
  api,
}: {
  links: SocialLinks
  accounts: AdminSocialAccount[]
  events: SocialEvent[]
  entries: AdminEntry[]
  api?: ComponentProps<typeof SocialApiForm>
}) {
  return (
    <div className="flex flex-col gap-6">
      <SocialGuide />
      <LinksForm links={links} />
      {api ? <SocialApiForm {...api} /> : null}
      <AccountsReview accounts={accounts} />
      <EventsAdmin events={events} entries={entries} />
    </div>
  )
}
