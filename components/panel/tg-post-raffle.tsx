'use client'

import { useState } from 'react'
import { Gift, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { btnGhost, input } from '@/components/panel/tg-hub-ui'
import { badge, type Run } from '@/components/panel/tg-post-ui'
import { announceRaffleAction, closeRaffleAction, drawRaffleAction } from '@/app/panel/tg-post-actions'
import type { PostRow } from '@/lib/tg-posts-shared'

const MAX_DRAW = 50

export function RafflePanel({ post, pending, run }: { post: PostRow; pending: boolean; run: Run }) {
  const [count, setCount] = useState(1)
  const raffle = post.stats.raffle
  if (!raffle) return null

  const live = post.sends.some((s) => s.status === 'sent')
  const left = raffle.entries - raffle.winners.length
  const wanted = Math.min(Math.max(1, Math.round(count) || 1), MAX_DRAW, Math.max(1, left))
  const spare = raffle.winners.length > 0

  const draw = async () => {
    const ask = spare
      ? `Daha önce kazanmamış katılımcılar arasından ${wanted} yedek kazanan rastgele seçilsin mi?`
      : `${raffle.entries} katılımcı arasından ${wanted} kazanan rastgele seçilsin mi? Çekiliş katılıma kapanır.`
    if (await askConfirm(ask)) run(() => drawRaffleAction(post.id, wanted))
  }
  const announce = async () => {
    if (await askConfirm('Kazananlar, postun durduğu her sohbette postun altına yanıt olarak yazılsın mı?')) run(() => announceRaffleAction(post.id))
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3" aria-label="Çekiliş">
      <div className="flex flex-wrap items-center gap-2">
        <Gift className="size-4 text-muted-foreground" aria-hidden="true" />
        <h4 className="text-sm font-semibold text-foreground">Çekiliş</h4>
        <span className="text-sm tabular-nums text-foreground">{`${raffle.entries} katılımcı`}</span>
        <span className={cn(badge, raffle.closed ? 'bg-muted text-muted-foreground' : 'bg-success/15 text-success')}>{raffle.closed ? 'Katılım kapalı' : 'Katılım açık'}</span>
      </div>

      {spare && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-foreground">{raffle.winners.length > 1 ? 'Kazananlar' : 'Kazanan'}</p>
          <ol className="flex flex-col gap-0.5 text-xs leading-relaxed text-muted-foreground">
            {raffle.winners.map((w, i) => (
              <li key={w.tgId} className="[overflow-wrap:anywhere]">
                <span className="tabular-nums">{`${i + 1}. `}</span>
                <span className="font-medium text-foreground">{w.name || 'Adsız'}</span>
                {w.username ? ` @${w.username}` : ''}
                <span className="tabular-nums">{` · ID ${w.tgId}`}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex w-28 flex-col gap-1 text-xs text-muted-foreground">
          Kaç kazanan
          <input type="number" min={1} max={MAX_DRAW} className={input} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </label>
        <button type="button" className={btnGhost} disabled={pending || left <= 0} onClick={draw}>
          {spare ? 'Yedek kazanan seç' : 'Kazanan seç'}
        </button>
        <button type="button" className={btnGhost} disabled={pending} onClick={() => run(() => closeRaffleAction(post.id, !raffle.closed))}>
          {raffle.closed ? 'Katılımı yeniden aç' : 'Katılımı kapat'}
        </button>
        <button type="button" className={cn(btnGhost, 'gap-1.5')} disabled={pending || !spare || !live} onClick={announce}>
          <Megaphone className="size-4" aria-hidden="true" />
          Kazananları duyur
        </button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {left <= 0 && raffle.entries > 0
          ? 'Katılan herkes kazanan olarak seçildi.'
          : 'Kazanan, katılanlar arasından eşit şansla seçilir. Seçim panelde kalır; Telegram’a ancak “Kazananları duyur”a basınca yazılır.'}
      </p>
    </section>
  )
}
