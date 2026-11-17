'use client'

import { useRef, useState, useTransition } from 'react'
import { Bell, CalendarClock, Loader2, Send, Smartphone, TestTube2, Users } from 'lucide-react'
import { confirmed } from '@/components/panel/confirm-dialog'
import { OutboxList, ScheduleField, sendTimeFmt } from '@/components/panel/outbox'
import { sendPushNow, testPush } from '@/app/panel/push-actions'
import { schedulePush } from '@/app/panel/outbox-actions'
import { cleanSendAt, type OutboxItem, type SendResult } from '@/lib/outbox-shared'
import type { PushLog } from '@/lib/push'

type Props = { total: number; members: number; log: PushLog[]; configured: boolean; outbox: OutboxItem[] }

const PRESETS = [
  { title: 'Çark yenilendi!', body: 'Ücretsiz çark hakkın hazır, hemen çevir ve KC kazan.', url: '/oyunlar/cark' },
  { title: 'Sandık açıldı', body: 'Günlük gizemli sandığın seni bekliyor.', url: '/oyunlar/sandik' },
  { title: 'Yeni turnuva başladı', body: 'Kafa Topu turnuvasına katıl, ödül havuzunu kap.', url: '/oyunlar' },
]

const input =
  'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'

/** The push subscription of the browser the panel is open in, if this browser ever turned Alkanka notifications on. */
async function ownEndpoint() {
  if (!('serviceWorker' in navigator)) return null
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = await registration?.pushManager?.getSubscription()
    return subscription?.endpoint ?? null
  } catch {
    return null
  }
}

export function PushSender({ total, members, log, configured, outbox }: Props) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('/')
  const [scheduled, setScheduled] = useState(false)
  const [at, setAt] = useState('')
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [sending, startSend] = useTransition()
  const [testing, startTest] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  const run = (call: () => Promise<SendResult>) =>
    startSend(async () => {
      const r = await call()
      if (!r.ok) return setStatus({ ok: false, text: r.error })
      setStatus({ ok: true, text: r.message })
      setTitle('')
      setBody('')
      setUrl('/')
      setScheduled(false)
      setAt('')
    })

  const submit = () => {
    setStatus(null)
    const payload = { title, body, url }
    if (scheduled) {
      const when = cleanSendAt(at)
      if (!when.ok) return setStatus({ ok: false, text: when.error })
      return confirmed(
        `Bu bildirim ${sendTimeFmt.format(new Date(when.value))} (Türkiye saati) için zamanlansın mı? O an kayıtlı tüm cihazlara gider; şu an ${total.toLocaleString('tr-TR')} cihaz kayıtlı.`,
        () => run(() => schedulePush({ ...payload, at })),
      )
    }
    confirmed(`Bu bildirim ${total.toLocaleString('tr-TR')} cihaza hemen gönderilsin mi? Gönderilen bildirim geri alınamaz.`, () => run(() => sendPushNow(payload)))
  }

  const tryHere = () => {
    if (!formRef.current?.reportValidity()) return
    setStatus(null)
    startTest(async () => {
      const endpoint = await ownEndpoint()
      if (!endpoint) {
        return setStatus({
          ok: false,
          text: 'Bu tarayıcıda Alkanka bildirimleri açık değil. Siteyi bu tarayıcıda açıp bildirimlere izin ver, sonra tekrar dene.',
        })
      }
      const r = await testPush({ title, body, url, endpoint })
      setStatus({ ok: r.ok, text: r.ok ? r.message : r.error })
    })
  }

  const busy = sending || testing

  return (
    <div className="grid grid-cols-12 gap-6">
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="col-span-12 flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 lg:col-span-7"
      >
        <div className="flex items-center gap-2">
          <Bell className="size-5 text-primary" aria-hidden />
          <h2 className="font-display text-xl font-bold uppercase text-foreground">Bildirim gönder</h2>
        </div>
        {!configured ? (
          <p className="rounded-xl bg-secondary p-3 text-sm leading-relaxed text-muted-foreground">
            Bildirim anahtarları ilk gönderimde otomatik oluşturulur ve veritabanına kaydedilir.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.title}
              type="button"
              onClick={() => {
                setTitle(p.title)
                setBody(p.body)
                setUrl(p.url)
              }}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary max-sm:min-h-9"
            >
              {p.title}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
          Başlık (en fazla 60)
          <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} required className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
          Mesaj (en fazla 180)
          <textarea name="body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={180} required rows={3} className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
          Tıklanınca açılacak sayfa
          <input name="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/oyunlar/cark" className={input} />
        </label>

        <ScheduleField what="Bildirim" on={scheduled} at={at} onToggle={setScheduled} onAt={setAt} />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy || (!scheduled && total === 0)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : scheduled ? (
              <CalendarClock className="size-4" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            {scheduled ? 'Zamanla' : `${total} cihaza gönder`}
          </button>
          <button
            type="button"
            onClick={tryHere}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
          >
            {testing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <TestTube2 className="size-4" aria-hidden />}
            Önce bu cihaza gönder
          </button>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          &quot;Önce bu cihaza gönder&quot; bildirimi sadece şu an panelin açık olduğu tarayıcıya yollar; nasıl göründüğüne bakıp sonra herkese gönderirsin. Bu tarayıcıda siteden bildirim izni verilmiş
          olmalı.
        </p>
        {status ? (
          <p role="status" className={status.ok ? 'text-sm text-primary' : 'text-sm text-destructive'}>
            {status.text}
          </p>
        ) : null}
      </form>

      <aside className="col-span-12 flex flex-col gap-4 lg:col-span-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
            <Smartphone className="size-4 text-primary" aria-hidden />
            <span className="font-display text-2xl font-bold text-foreground">{total}</span>
            <span className="text-xs text-muted-foreground">Bildirimi açık cihaz (misafir dahil)</span>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
            <Users className="size-4 text-primary" aria-hidden />
            <span className="font-display text-2xl font-bold text-foreground">{members}</span>
            <span className="text-xs text-muted-foreground">Bu cihazlardan üye hesaba bağlı</span>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Burada sayılan şey cihaz. Bir üyenin telefonu ve bilgisayarı ayrı ayrı sayılır, misafirler de dahildir. Mobil sekmesindeki sayılar ise üye hesabı başına tutulur, o yüzden ikisi farklı olabilir.
        </p>
        <OutboxList items={outbox} empty="Zamanlanmış bildirim yok." />
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold text-foreground">Son toplu gönderimler</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Sadece bu ekrandan herkese gönderilenler listelenir. Oyun, ödül ve görev gibi kişiye özel otomatik bildirimler ile deneme gönderimleri burada görünmez.
          </p>
          {log.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz toplu bildirim gönderilmedi.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {log.map((l) => (
                <li key={l.id} className="flex flex-col gap-0.5 py-2">
                  <span className="text-sm font-semibold text-foreground">{l.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(l.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Istanbul' })} · {l.sent} gönderildi
                    {l.failed ? ` · ${l.failed} başarısız` : ''}
                    {l.sentBy ? ` · Gönderen: ${l.sentBy}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  )
}
