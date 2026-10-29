'use client'

import { CheckCircle2, Send } from 'lucide-react'
import { LinkTelegramButton } from '@/components/alkanka/live-rail'

export function TelegramAccountCard({ linked }: { linked: boolean }) {
  return (
    <section aria-labelledby="tg-hesap" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Send className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col">
            <h2 id="tg-hesap" className="font-display text-base font-bold text-foreground">Telegram</h2>
            <span className="text-xs text-muted-foreground">Sohbet, oran alarmı ve özel mesajlar</span>
          </div>
        </div>
        {linked && (
          <span className="flex items-center gap-1 rounded-full bg-live/15 px-2.5 py-1 text-xs font-semibold text-live">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            Bağlandı
          </span>
        )}
      </div>
      {!linked && (
        <div className="flex flex-col gap-2">
          <LinkTelegramButton />
          <p className="text-xs leading-relaxed text-muted-foreground">{"Açılan Telegram sohbetinde Başlat'a bas, hesabın bağlanır."}</p>
        </div>
      )}
    </section>
  )
}
