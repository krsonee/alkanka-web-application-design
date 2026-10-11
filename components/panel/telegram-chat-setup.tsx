'use client'

import { useActionState } from 'react'
import { Loader2, MessagesSquare, Unplug } from 'lucide-react'
import { connectChatAction, disconnectChatAction } from '@/app/panel/telegram-actions'
import type { ActionState } from '@/app/panel/actions'
import type { MirrorBot } from '@/lib/telegram-mirror'

type Status = {
  title: string
  botUsername: string
  chatId: string
  messageCount: number
  linkedMembers: number
  webhook: { url: string; pending: number; lastError: string | null } | null
}

const input = 'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'

const STEPS = [
  'Telegram’da sohbet grubu oluştur (kanal değil, üyelerin yazabildiği grup). Grubu herkese açık yapıp bir kullanıcı adı verirsen sitedeki "Gruba katıl" butonu otomatik çalışır.',
  'Yukarıdaki "Bot hesapları" bölümünden bağladığın botu gruba üye olarak ekle.',
  'Botu grupta yönetici yap. Yönetici olunca gruptaki tüm mesajları okuyabilir. Yönetici yapmak istemezsen BotFather’da /setprivacy yazıp botu seç ve Disable de.',
  'Aşağıdan botu seç, grubun kullanıcı adını (@grubum) ya da ID’sini (-100…) yaz ve "Grubu bağla"ya bas. Site yayında olmalı, bağlantı yayındaki adrese kurulur.',
  'Gruba bir test mesajı yaz. Birkaç saniye içinde sitenin sağındaki "Telegram Canlı" panelinde görünmeli.',
]

export function TelegramChatSetup({ bots, status }: { bots: MirrorBot[]; status: Status | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(connectChatAction, {})

  return (
    <section aria-labelledby="tg-chat-title" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <MessagesSquare className="size-4" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="tg-chat-title" className="text-base font-semibold text-foreground">
            Sohbet grubu (site ile canlı sohbet)
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            Gruptaki mesajlar sitedeki canlı sohbette görünür. Telegram hesabını bağlayan üyeler siteden de yazabilir, mesajları bot
            aracılığıyla gruba {'"isim (site): mesaj"'} şeklinde düşer.
          </p>
        </div>
      </div>

      {status ? (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-foreground">
              <span className="font-semibold">{status.title}</span>{' '}
              <span className="text-muted-foreground">
                · @{status.botUsername} · {status.chatId}
              </span>
            </p>
            <form action={disconnectChatAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
              >
                <Unplug className="size-3.5" aria-hidden="true" />
                Bağlantıyı kaldır
              </button>
            </form>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">Kaydedilen mesaj</dt>
              <dd className="font-semibold text-foreground tabular-nums">{status.messageCount}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">Telegram bağlayan üye</dt>
              <dd className="font-semibold text-foreground tabular-nums">{status.linkedMembers}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">Bağlantı durumu</dt>
              <dd className={status.webhook?.url ? 'font-semibold text-primary' : 'font-semibold text-destructive'}>
                {status.webhook?.url ? 'Aktif' : 'Kopuk, tekrar bağla'}
              </dd>
            </div>
          </dl>
          {status.webhook?.lastError && (
            <p className="text-xs leading-relaxed text-destructive">Telegram’ın son hatası: {status.webhook.lastError}</p>
          )}
        </div>
      ) : null}

      <ol className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
        {STEPS.map((step, i) => (
          <li key={step} className="flex gap-2.5">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">
              {i + 1}
            </span>
            <span className="text-pretty">{step}</span>
          </li>
        ))}
      </ol>

      {bots.length === 0 ? (
        <p className="rounded-xl bg-secondary p-3 text-sm text-muted-foreground">Önce yukarıdan bir bot hesabı bağla.</p>
      ) : (
        <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-1.5 text-sm text-foreground">
            Bot
            <select name="botId" className={input} defaultValue={bots[0]?.id}>
              {bots.map((b) => (
                <option key={b.id} value={b.id}>
                  @{b.username}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm text-foreground">
            Grup
            <input name="chat" required placeholder="@alkankasohbet ya da -1001234567890" className={input} />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {status ? 'Yeniden bağla' : 'Grubu bağla'}
          </button>
        </form>
      )}
      {state.message && (
        <p role="status" className={`text-sm leading-relaxed ${state.ok ? 'text-primary' : 'text-destructive'}`}>
          {state.message}
        </p>
      )}
    </section>
  )
}
