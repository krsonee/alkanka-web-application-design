'use client'

import { useTransition } from 'react'
import { CalendarClock, X } from 'lucide-react'
import { askConfirm, notify } from '@/components/panel/confirm-dialog'
import { cancelOutbox } from '@/app/panel/outbox-actions'
import { OUTBOX_GRACE_MIN, type OutboxItem, type OutboxStatus } from '@/lib/outbox-shared'
import { isoToLocal } from '@/lib/tg-posts-shared'
import { cn } from '@/lib/utils'

const input = 'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'

export const sendTimeFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })

const STATUS: Record<OutboxStatus, { label: string; tone: string }> = {
  waiting: { label: 'Bekliyor', tone: 'bg-primary/10 text-foreground' },
  sending: { label: 'Gönderiliyor', tone: 'bg-primary/10 text-foreground' },
  sent: { label: 'Gönderildi', tone: 'bg-success/15 text-foreground' },
  failed: { label: 'Gönderilemedi', tone: 'bg-destructive/15 text-destructive' },
  cancelled: { label: 'İptal edildi', tone: 'bg-secondary text-muted-foreground' },
  missed: { label: 'Zamanı geçti', tone: 'bg-destructive/15 text-destructive' },
}

export function ScheduleField({
  what,
  on,
  at,
  onToggle,
  onAt,
}: {
  what: string
  on: boolean
  at: string
  onToggle: (on: boolean) => void
  onAt: (at: string) => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
      <label className="flex items-center gap-3 text-sm font-medium text-foreground">
        <input
          type="checkbox"
          name="scheduled"
          className="size-4 accent-primary"
          checked={on}
          onChange={(e) => {
            onToggle(e.target.checked)
            if (e.target.checked && !at) onAt(isoToLocal(Date.now() + 60 * 60 * 1000))
          }}
        />
        İleri bir saate zamanla
      </label>
      {on && (
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
          Gönderim zamanı (Türkiye saati)
          <input type="datetime-local" name="sendAt" className={input} value={at} onChange={(e) => onAt(e.target.value)} />
          <span className="font-normal leading-relaxed">
            Dakikası dakikasına garanti yok: sitede dakikalık zamanlayıcı çalışmıyor. {what}, bu saatten sonraki ilk site ziyaretinde çıkar. Site {OUTBOX_GRACE_MIN / 60} saatten uzun süre hiç ziyaret
            almazsa gönderilmez ve listede &quot;Zamanı geçti&quot; diye görünür.
          </span>
        </label>
      )}
    </div>
  )
}

export function OutboxList({ items, empty }: { items: OutboxItem[]; empty: string }) {
  const [, startCancel] = useTransition()

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="size-4 text-primary" aria-hidden />
        <h3 className="text-sm font-bold text-foreground">Zamanlananlar</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => {
            const state = item.stuck ? { label: 'Yarıda kaldı', tone: STATUS.failed.tone } : STATUS[item.status]
            return (
              <li key={item.id} className="flex items-start justify-between gap-2 py-2.5">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm font-semibold text-foreground text-pretty">{item.title}</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {sendTimeFmt.format(new Date(item.sendAt))} · {item.target}
                    {item.createdBy ? ` · Zamanlayan: ${item.createdBy}` : ''}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className={cn('rounded-full px-2 py-0.5 font-semibold', state.tone)}>{state.label}</span>
                    {item.stuck ? 'Gönderim başladı ama bitmedi; gidip gitmediği belli değil. Kendiliğinden tekrar denenmez.' : item.result}
                  </span>
                </div>
                {item.status === 'waiting' && (
                  <button
                    type="button"
                    aria-label={`${item.title} gönderimini iptal et`}
                    onClick={() => {
                      void askConfirm(`"${item.title}" için zamanlanmış gönderim iptal edilsin mi?`).then((ok) => {
                        if (!ok) return
                        startCancel(async () => {
                          const r = await cancelOutbox(item.id)
                          notify(r.ok, r.ok ? r.message : r.error)
                        })
                      })
                    }}
                    className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-destructive"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
