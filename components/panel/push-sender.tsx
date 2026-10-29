'use client'

import { useActionState } from 'react'
import { Bell, Loader2, Send, Smartphone, Users } from 'lucide-react'
import { sendPushAction } from '@/app/panel/push-actions'
import type { ActionState } from '@/app/panel/actions'
import type { PushLog } from '@/lib/push'

type Props = { total: number; members: number; log: PushLog[]; configured: boolean }

const PRESETS = [
  { title: 'Çark yenilendi!', body: 'Ücretsiz çark hakkın hazır, hemen çevir ve KC kazan.', url: '/oyunlar/cark' },
  { title: 'Sandık açıldı', body: 'Günlük gizemli sandığın seni bekliyor.', url: '/oyunlar/sandik' },
  { title: 'Yeni turnuva başladı', body: 'Kafa Topu turnuvasına katıl, ödül havuzunu kap.', url: '/oyunlar' },
]

const input =
  'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'

export function PushSender({ total, members, log, configured }: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(sendPushAction, {})

  return (
    <div className="grid grid-cols-12 gap-6">
      <form action={action} className="col-span-12 flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 lg:col-span-7">
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
              onClick={(e) => {
                const f = e.currentTarget.form
                if (!f) return
                ;(f.elements.namedItem('title') as HTMLInputElement).value = p.title
                ;(f.elements.namedItem('body') as HTMLTextAreaElement).value = p.body
                ;(f.elements.namedItem('url') as HTMLInputElement).value = p.url
              }}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
            >
              {p.title}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
          Başlık (en fazla 60)
          <input name="title" maxLength={60} required className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
          Mesaj (en fazla 180)
          <textarea name="body" maxLength={180} required rows={3} className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
          Tıklanınca açılacak sayfa
          <input name="url" defaultValue="/" placeholder="/oyunlar/cark" className={input} />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending || total === 0}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
            {total} cihaza gönder
          </button>
          {state.message ? (
            <p role="status" className={state.ok ? 'text-sm text-primary' : 'text-sm text-destructive'}>
              {state.message}
            </p>
          ) : null}
        </div>
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
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold text-foreground">Son toplu gönderimler</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Sadece bu ekrandan herkese gönderilenler listelenir. Oyun, ödül ve görev gibi kişiye özel otomatik bildirimler burada görünmez.
          </p>
          {log.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz toplu bildirim gönderilmedi.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {log.map((l) => (
                <li key={l.id} className="flex flex-col gap-0.5 py-2">
                  <span className="text-sm font-semibold text-foreground">{l.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(l.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })} · {l.sent} gönderildi
                    {l.failed ? ` · ${l.failed} başarısız` : ''}
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
