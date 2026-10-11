'use client'

import { useActionState } from 'react'
import { Loader2, Megaphone, Unplug } from 'lucide-react'
import { connectInviteAction, disconnectInviteAction } from '@/app/panel/telegram-actions'
import type { ActionState } from '@/app/panel/actions'
import type { MirrorBot } from '@/lib/telegram-mirror'

const input = 'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'

const STEPS = [
  'Telegram’da davetlerin düşeceği kanalı (ya da grubu) aç.',
  'Yukarıdaki "Bot hesapları" bölümünden bağladığın botu kanala yönetici olarak ekle ve "Mesaj gönder" iznini aç.',
  'Aşağıdan botu seç, kanalın kullanıcı adını (@kanalim) ya da ID’sini (-100…) yaz ve "Kanalı bağla"ya bas.',
  'Üyeler masa açınca "Oyuncu davet et" butonu aktif olur. Her üye 4 dakikada bir davet gönderebilir.',
]

export function TelegramInviteSetup({ bots, status }: { bots: MirrorBot[]; status: { title: string; chatId: string } | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(connectInviteAction, {})

  return (
    <section aria-labelledby="tg-invite-title" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <Megaphone className="size-4" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="tg-invite-title" className="text-base font-semibold text-foreground">
            Masa davet kanalı
          </h2>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            Üye kanka masası açıp {'"Oyuncu davet et"'}e bastığında bu kanala {'"Oyuncu aranıyor"'} mesajı ve {'"Oyuna katıl"'} butonu düşer.
            Spam olmasın diye her üye 4 dakikada bir gönderebilir.
          </p>
        </div>
      </div>

      {status && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm text-foreground">
            <span className="font-semibold">{status.title}</span> <span className="text-muted-foreground">· {status.chatId}</span>
          </p>
          <form action={disconnectInviteAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
            >
              <Unplug className="size-3.5" aria-hidden="true" />
              Bağlantıyı kaldır
            </button>
          </form>
        </div>
      )}

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
            Kanal
            <input name="chat" required placeholder="@alkankaoyun ya da -1001234567890" className={input} />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {status ? 'Yeniden bağla' : 'Kanalı bağla'}
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
