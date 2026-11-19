'use client'

import Image from 'next/image'
import { useActionState, useState } from 'react'
import { Loader2, Lock, Save } from 'lucide-react'
import {
  ARENA_GAMES,
  ARENA_META,
  BOT_DAILY_PROFIT_CAP,
  BOT_TABLE_EXTRA_COMMISSION,
  MARS_MIN_MULTIPLIER,
  MAX_COMMISSION,
  OKEY_BOT_SEATS,
  PAYOUT_RULE,
  botMatchGross,
  isBotTableGame,
  quickSeats,
  tablePot,
  usesCommission,
  type ArenaGame,
  type ArenaGameSettings,
  type ArenaSettings,
} from '@/lib/arena'
import { saveArenaSettings } from '@/app/panel/arena-actions'
import { HideButton } from '@/components/panel/hide-button'
import { ImageField } from '@/components/panel/image-field'
import type { ActionState } from '@/app/panel/actions'

const field = 'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'
const labelCls = 'flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground'
const kc = (n: number) => `${Math.floor(n).toLocaleString('tr-TR')} KC`

const ODDS_TEXT: Partial<Record<ArenaGame, string>> = {
  blackjack: 'Blackjack kendi oranlarıyla öder: galibiyet 1’e 1, blackjack 3’e 2, sigorta 2’ye 1.',
  rulet: 'Rulet kendi oranlarıyla öder: tek sayı 35’e 1, renk ve tek-çift 1’e 1.',
}

/** The stake the worked example uses: 100 KC when the game offers it, otherwise its smallest bet. */
function exampleStake(text: string) {
  const bets = text
    .split(/[,\s]+/)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
  return bets.includes(100) || bets.length === 0 ? 100 : Math.min(...bets)
}

/** What a win pays with the values typed in the card, worked out by the same code the games use. */
function PayoutExample({ game, stake, multiplier, commission }: { game: ArenaGame; stake: number; multiplier: number; commission: number }) {
  const rule = PAYOUT_RULE[game]
  const s: ArenaGameSettings = { enabled: true, pvpEnabled: true, bets: [stake], multiplier, commission }
  const seats = quickSeats(game)
  const full = tablePot(game, stake, commission, { humans: seats, bots: 0 })
  const lines: string[] = []
  if (rule === 'multiplier') {
    lines.push(`Bota karşı: ${kc(stake)} bahis, galibiyette ${kc(botMatchGross(game, s, stake, 'win'))} döner.`)
    if (game === 'tavla') lines.push(`Mars: ${kc(botMatchGross(game, s, stake, 'win', { for: 15, against: 0 }))} (en az ${MARS_MIN_MULTIPLIER} kat).`)
  }
  if (game === 'okey') {
    lines.push(`Bota karşı masa (${OKEY_BOT_SEATS} koltuk): ${kc(stake)} bahis, galibiyette ${kc(botMatchGross(game, s, stake, 'win'))} döner; okeyle ya da çiftten bitiş 2 kat.`)
  }
  if (rule !== 'odds') {
    lines.push(`Oyunculu masa (${seats} üye): ortada ${kc(full.pot)}, masa payından sonra ödenen ${kc(full.net)}.`)
    if (isBotTableGame(game)) {
      const solo = tablePot(game, stake, commission, { humans: 1, bots: seats - 1 })
      lines.push(`${game === 'okey' ? 'Rakip gelmeyip botla dolan masa (tek üye)' : 'Tek üye, kalan koltuklarda bot'}: ortada ${kc(solo.pot)}, ödenen ${kc(solo.net)}${solo.cut !== commission ? ` (botlu masada pay +${BOT_TABLE_EXTRA_COMMISSION} puan)` : ''}.`)
    }
  }
  if (!lines.length) return null
  return (
    <ul className="flex flex-col gap-1 rounded-xl bg-secondary px-3 py-2.5 text-xs leading-relaxed text-foreground" aria-live="polite">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  )
}

function GameCard({ game, settings }: { game: ArenaGame; settings: ArenaGameSettings }) {
  const meta = ARENA_META[game]
  const rule = PAYOUT_RULE[game]
  const [bets, setBets] = useState(settings.bets.join(', '))
  const [multiplier, setMultiplier] = useState(String(settings.multiplier))
  const [commission, setCommission] = useState(String(settings.commission))
  const num = (text: string, fallback: number) => {
    const n = Number(text.replace(',', '.'))
    return Number.isFinite(n) && text.trim() !== '' ? n : fallback
  }
  return (
    <fieldset className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative aspect-[16/9]">
        <Image src={settings.image || meta.image || '/placeholder.svg'} alt="" fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
        <legend className="absolute bottom-3 left-4 font-display text-2xl font-bold uppercase text-foreground">{meta.title}</legend>
      </div>
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary px-3 py-2.5 text-sm font-semibold text-foreground">
          {settings.enabled ? 'Sitede yayında' : 'Siteden gizli'}
          <input type="hidden" name={`${game}:enabled`} value={settings.enabled ? 'on' : ''} />
          <HideButton key={`${game}-${settings.enabled}`} kind="arena" id={game} hidden={!settings.enabled} label={meta.title} />
        </div>
        <label className={labelCls}>
          Bahis seçenekleri (KC, virgülle ayır, en fazla 8)
          <input name={`${game}:bets`} value={bets} onChange={(e) => setBets(e.target.value)} className={field} />
        </label>
        {rule === 'multiplier' ? (
          <label className={labelCls}>
            Bota karşı kazanç çarpanı
            <input
              name={`${game}:multiplier`}
              type="number"
              step="0.1"
              min={1}
              max={20}
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
              className={field}
            />
            <span className="font-normal">Bota karşı maçta galibiyet bahis × çarpan öder. Oyunculu masada çarpan kullanılmaz, ödeme ortadaki paradan yapılır.</span>
          </label>
        ) : (
          <div className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
            <span>Kazanç çarpanı</span>
            <p className="flex items-start gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 font-normal leading-relaxed">
              <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-semibold text-foreground">Bu oyunda çarpan kullanılmaz.</span>{' '}
                {rule === 'pot' ? 'Ödeme ortadaki paradan yapılır: kazanan masadaki bahisleri alır, masa payı kesilir. Kazancı aşağıdaki masa payı belirler.' : ODDS_TEXT[game]}
              </span>
            </p>
          </div>
        )}
        {usesCommission(game) && (
          <label className={labelCls}>
            Masa payı (%)
            <input
              name={`${game}:commission`}
              type="number"
              step="1"
              min={0}
              max={MAX_COMMISSION}
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              className={field}
            />
            <span className="font-normal">Ortadaki paradan kesilen pay. Yükseltirsen kazanan daha az alır.</span>
          </label>
        )}
        <PayoutExample game={game} stake={exampleStake(bets)} multiplier={Math.max(1, num(multiplier, settings.multiplier))} commission={Math.min(MAX_COMMISSION, Math.max(0, Math.round(num(commission, settings.commission))))} />
        <ImageField name={`${game}:image`} label="Kapak görseli (boş bırakırsan varsayılan görsel kullanılır)" defaultValue={settings.image ?? ''} uploadId={`arena-${game}`} compact />
        <p className="text-xs leading-relaxed text-muted-foreground">Oyuncu sayısı: {meta.players}</p>
      </div>
    </fieldset>
  )
}

export function ArenaSettingsEditor({ settings, winRate = 40 }: { settings: ArenaSettings; winRate?: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveArenaSettings, {})
  return (
    <form action={action} className="flex flex-col gap-5">
      <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4" aria-labelledby="payout-rules">
        <h3 id="payout-rules" className="text-sm font-bold text-foreground">
          Kazanç nasıl hesaplanır
        </h3>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-xs leading-relaxed text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">Çarpan</span> sadece Tavla, Bilardo, Kafa Topu ve Kafa Basketbolu&apos;nun bota karşı maçında işler: galibiyet bahis × çarpan öder.
          </li>
          <li>
            <span className="font-semibold text-foreground">Masa payı</span> oyuncuların oturduğu her masada ve bota karşı Okey masasında işler: kazanan ortadaki parayı alır, bu pay kesilir. Para yoktan var olmaz.
          </li>
          <li>Blackjack ve Rulet kendi oranlarıyla öder; ne çarpan ne masa payı kullanır.</li>
          <li>
            Botlara karşı kazanılan KC, çarpan kaç olursa olsun günde en fazla {BOT_DAILY_PROFIT_CAP.toLocaleString('tr-TR')} KC&apos;dir. Değişiklik kaydedildiği anda geçerli olur; o sırada süren maç da bittiğinde yeni değerle ödenir.
          </li>
        </ul>
      </section>
      <div className="grid gap-5 lg:grid-cols-3">
        {ARENA_GAMES.map((g) => (
          <GameCard key={g} game={g} settings={settings[g]} />
        ))}
      </div>
      <fieldset className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <legend className="px-1 text-sm font-bold text-foreground">Mini oyunlar (Şans Çarkı, Gizemli Sandık, Zar At)</legend>
        <label className="flex max-w-sm flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
          Büyük ödül çıkma oranı (%)
          <input name="house:winRate" type="number" min={0} max={100} defaultValue={winRate} className={field} />
        </label>
        <p className="text-xs leading-relaxed text-muted-foreground">Sonuç artık sunucuda belirleniyor. Örneğin 40 yazarsan, oyunların yaklaşık %40&apos;ında büyük ödül çıkar, geri kalanında küçük ödül çıkar.</p>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          Oyun ayarlarını kaydet
        </button>
        {state.message && (
          <p role="status" className={state.ok ? 'text-sm font-semibold text-primary' : 'text-sm font-semibold text-destructive'}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  )
}
