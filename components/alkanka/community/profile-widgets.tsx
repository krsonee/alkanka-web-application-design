'use client'

import { useState } from 'react'
import { Bell, Check, Copy, Gift, Plus, Send, X } from 'lucide-react'
import { addAlertAction, claimReferralAction, removeAlertAction } from '@/app/actions/community'
import { usePoints } from '../points-context'
import { StatusLine, useAction } from './use-action'

export function ReferralCard({
  url,
  pending,
  ready,
  reward,
  friendReward,
  minGames,
}: {
  url: string
  pending: number
  ready: number
  reward: number
  friendReward: number
  minGames: number
}) {
  const { setBalance } = usePoints()
  const { pending: busy, status, run } = useAction()
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  async function share() {
    const text = `AL KANKA'ya katıl, oyna ve Kanka Coin kazan: ${url}`
    if (navigator.share) await navigator.share({ title: 'AL KANKA daveti', text, url }).catch(() => null)
    else window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('AL KANKA\'ya katıl, KC kazan!')}`, '_blank')
  }

  return (
    <section aria-labelledby="davet" className="panel-gold flex flex-col gap-4 rounded-xl p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="davet" className="font-display text-lg font-bold text-foreground">Arkadaşını getir</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Arkadaşın linkinle üye olup {minGames} oyun oynadığında sen <b className="text-primary">{reward} KC</b>, o{' '}
            <b className="text-primary">{friendReward} KC</b> kazanır.
          </p>
        </div>
        <Gift className="size-6 shrink-0 text-primary" aria-hidden />
      </header>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-1.5">
        <code className="min-w-0 flex-1 truncate px-2 text-sm text-foreground">{url}</code>
        <button onClick={copy} className="flex h-9 items-center gap-1.5 rounded-md bg-secondary px-3 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80">
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? 'Kopyalandı' : 'Kopyala'}
        </button>
        <button onClick={share} className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground">
          <Send className="size-4" aria-hidden />
          Paylaş
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Bekleyen: <b className="text-foreground">{pending}</b> · Ödüle hazır: <b className="text-primary">{ready}</b>
        </p>
        <button
          disabled={busy || ready === 0}
          onClick={() => run(claimReferralAction, (r) => typeof r.balance === 'number' && setBalance(r.balance))}
          className="h-10 rounded-lg bg-primary px-4 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-40"
        >
          {busy ? 'Ekleniyor...' : 'Ödülleri al'}
        </button>
      </div>
      <StatusLine status={status} />
    </section>
  )
}

export function AlertsCard({ alerts, telegramLinked }: { alerts: string[]; telegramLinked: boolean }) {
  const { pending, status, run } = useAction()
  const [value, setValue] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const v = value.trim()
    if (!v) return
    run(() => addAlertAction(v), () => setValue(''))
  }

  return (
    <section aria-labelledby="alarm" className="panel-gold flex flex-col gap-4 rounded-xl p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="alarm" className="font-display text-lg font-bold text-foreground">Oran alarmı</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Takım ya da lig yaz. Telegram kanallarından bu takıma özel oran düştüğünde haber veririz.
          </p>
        </div>
        <Bell className="size-6 shrink-0 text-primary" aria-hidden />
      </header>
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor="alarm-input" className="sr-only">Takım veya lig</label>
        <input
          id="alarm-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Örn. Galatasaray, Premier Lig"
          maxLength={40}
          className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button disabled={pending} className="flex h-10 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50">
          <Plus className="size-4" aria-hidden />
          Ekle
        </button>
      </form>
      {alerts.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {alerts.map((a) => (
            <li key={a} className="flex items-center gap-1 rounded-full border border-border bg-background py-1 pl-3 pr-1 text-sm text-foreground">
              {a}
              <button onClick={() => run(() => removeAlertAction(a))} aria-label={`${a} alarmını sil`} className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Henüz alarm yok.</p>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        {telegramLinked
          ? 'Telegram hesabın bağlı: eşleşen oranlar sana özel mesajla da gelir.'
          : 'Telegram’ı bağlarsan eşleşen oranlar anında özel mesajla gelir. Bağlantı için sağdaki sohbet panelini kullan.'}
      </p>
      <StatusLine status={status} />
    </section>
  )
}
