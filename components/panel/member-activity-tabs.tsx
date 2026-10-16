'use client'

import { useState, useTransition } from 'react'
import { Award, Gift, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { giftAction, memberBadgeAction, memberPointsAction } from '@/app/panel/members-actions'
import type { MemberActivity } from '@/lib/members-admin'

type Result = { ok: true; message: string } | { ok: false; error: string }

const input = 'rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary'
const when = (iso: string) => new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString('tr-TR')}`

const RESULT: Record<string, { label: string; cls: string }> = {
  win: { label: 'Kazandı', cls: 'text-primary' },
  loss: { label: 'Kaybetti', cls: 'text-destructive' },
  draw: { label: 'Berabere', cls: 'text-muted-foreground' },
  refund: { label: 'İade', cls: 'text-muted-foreground' },
}

const SOURCE: Record<string, string> = {
  admin: 'Panel düzeltmesi',
  rozet: 'Rozet bonusu',
  gorev: 'Görev',
  davet: 'Davet',
  checkin: 'Günlük giriş',
  tahmin: 'Tahmin',
  turnuva: 'Turnuva',
}

const MARKET: Record<string, string> = { beklemede: 'Bekliyor', onaylandi: 'Onaylandı', teslim: 'Teslim edildi', reddedildi: 'Reddedildi' }

export type ActivityTab = 'oyunlar' | 'islemler' | 'odul'

export function MemberActivityTabs({
  tab,
  userId,
  activity,
  badges,
  onDone,
}: {
  tab: ActivityTab
  userId: string
  activity: MemberActivity
  badges: { id: string; name: string; tier: string }[]
  onDone: (r: Result) => void
}) {
  if (tab === 'oyunlar') return <GamesTab activity={activity} />
  if (tab === 'islemler') return <TransactionsTab activity={activity} />
  return <RewardsTab userId={userId} activity={activity} badges={badges} onDone={onDone} />
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-lg bg-background px-3 py-6 text-center text-sm text-muted-foreground">{text}</p>
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      {children}
    </div>
  )
}

function GamesTab({ activity }: { activity: MemberActivity }) {
  const s = activity.gameSummary
  const rate = s.played ? Math.round((s.wins / s.played) * 100) : 0
  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-3 gap-3 text-sm">
        {[
          ['Oynanan', s.played.toLocaleString('tr-TR')],
          ['Kazanma', `%${rate}`],
          ['Net KC', signed(s.net)],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col rounded-lg bg-background px-3 py-2">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="font-display text-lg font-bold text-foreground">{v}</dd>
          </div>
        ))}
      </dl>

      {s.byGame.length > 0 && (
        <Block title="Oyuna göre">
          <ul className="flex flex-wrap gap-2">
            {s.byGame.map((g) => (
              <li key={g.game} className="rounded-full border border-border px-3 py-1 text-xs text-foreground">
                <span className="font-semibold capitalize">{g.game}</span> · {g.played} el ·{' '}
                <span className={g.net >= 0 ? 'text-primary' : 'text-destructive'}>{signed(g.net)} KC</span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      <Block title="Son oyunlar">
        {activity.games.length === 0 ? (
          <Empty text="Henüz oyun oynamamış." />
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {activity.games.map((g) => {
              const r = RESULT[g.result] ?? { label: g.result, cls: 'text-muted-foreground' }
              return (
                <li key={g.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium capitalize text-foreground">
                      {g.game} <span className="font-normal text-muted-foreground">· {g.mode}</span>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {g.opponent ? `Rakip: ${g.opponent} · ` : ''}Bahis {g.stake.toLocaleString('tr-TR')} KC · {when(g.createdAt)}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span className={cn('text-xs font-semibold', r.cls)}>{r.label}</span>
                    <span className={cn('text-sm font-semibold', g.delta >= 0 ? 'text-primary' : 'text-destructive')}>{signed(g.delta)} KC</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Block>
    </div>
  )
}

function TransactionsTab({ activity }: { activity: MemberActivity }) {
  return (
    <div className="flex flex-col gap-5">
      <Block title="Panel işlemleri">
        {activity.audit.length === 0 ? (
          <Empty text="Bu üye için panelden işlem yapılmamış." />
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {activity.audit.map((a) => (
              <li key={a.id} className="flex flex-col gap-0.5 px-3 py-2 text-sm">
                <span className="font-medium text-foreground">{a.action}</span>
                {a.detail && <span className="text-xs leading-relaxed text-muted-foreground">{a.detail}</span>}
                <span className="text-xs text-muted-foreground">
                  {a.actor} · {when(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title="Kanka puanı hareketleri">
        {activity.points.length === 0 ? (
          <Empty text="Puan hareketi yok." />
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {activity.points.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-foreground">{SOURCE[p.source] ?? p.source}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {p.note ? `${p.note} · ` : ''}
                    {when(p.createdAt)}
                  </span>
                </div>
                <span className={cn('shrink-0 font-semibold', p.points >= 0 ? 'text-primary' : 'text-destructive')}>{signed(p.points)} KP</span>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title="Market talepleri">
        {activity.market.length === 0 ? (
          <Empty text="Market talebi yok." />
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {activity.market.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-foreground">{m.itemName}</span>
                  <span className="text-xs text-muted-foreground">{when(m.createdAt)}</span>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <span className="font-semibold text-foreground">{m.price.toLocaleString('tr-TR')} KC</span>
                  <span className="text-xs text-muted-foreground">{MARKET[m.status] ?? m.status}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Block>
    </div>
  )
}

function RewardsTab({
  userId,
  activity,
  badges,
  onDone,
}: {
  userId: string
  activity: MemberActivity
  badges: { id: string; name: string; tier: string }[]
  onDone: (r: Result) => void
}) {
  const [busy, start] = useTransition()
  const [gift, setGift] = useState('')
  const [giftMsg, setGiftMsg] = useState('')
  const [badgeId, setBadgeId] = useState(badges[0]?.id ?? '')
  const [badgeNote, setBadgeNote] = useState('')
  const [kp, setKp] = useState('')
  const [kpNote, setKpNote] = useState('')

  const run = (fn: () => Promise<Result>, reset: () => void) =>
    start(async () => {
      const r = await fn()
      if (r.ok) reset()
      onDone(r)
    })

  return (
    <div className="flex flex-col gap-4">
      <Card icon={<Gift className="size-4" aria-hidden="true" />} title="Hediye gönder" hint="Kanka Coin hesabına eklenir ve gelen kutusuna hediye mesajı düşer.">
        <input aria-label="Hediye tutarı" inputMode="numeric" value={gift} onChange={(e) => setGift(e.target.value.replace(/\D/g, ''))} placeholder="Tutar (KC)" className={input} />
        <textarea aria-label="Hediye mesajı" value={giftMsg} onChange={(e) => setGiftMsg(e.target.value)} rows={2} placeholder="Mesaj (isteğe bağlı) — örn. Turnuva tesellisi, iyi şanslar!" className={cn(input, 'resize-y leading-relaxed')} />
        <button
          disabled={busy || !Number(gift)}
          onClick={() => run(() => giftAction(userId, Number(gift), giftMsg), () => (setGift(''), setGiftMsg('')))}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          Hediyeyi gönder
        </button>
      </Card>

      <Card icon={<Award className="size-4" aria-hidden="true" />} title="Rozet ver" hint="Rozetin bonus puanı varsa otomatik eklenir. Yeni rozetleri Kanka Puan bölümünden oluşturabilirsin.">
        {activity.badges.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {activity.badges.map((b) => (
              <li key={b.id} className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                {b.name}
                {b.count > 1 ? ` x${b.count}` : ''}
              </li>
            ))}
          </ul>
        )}
        {badges.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aktif rozet yok.</p>
        ) : (
          <>
            <select aria-label="Rozet" value={badgeId} onChange={(e) => setBadgeId(e.target.value)} className={input}>
              {badges.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <input aria-label="Rozet notu" value={badgeNote} onChange={(e) => setBadgeNote(e.target.value)} placeholder="Not (isteğe bağlı)" className={input} />
            <button
              disabled={busy || !badgeId}
              onClick={() => run(() => memberBadgeAction(userId, badgeId, badgeNote), () => setBadgeNote(''))}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-40"
            >
              Rozeti ver
            </button>
          </>
        )}
      </Card>

      <Card icon={<Sparkles className="size-4" aria-hidden="true" />} title="Kanka puanı düzelt" hint="Seviye ve sıralama Kanka puanına göre hesaplanır. Eksi değer puan düşer.">
        <input aria-label="Puan" inputMode="numeric" value={kp} onChange={(e) => setKp(e.target.value.replace(/[^\d-]/g, ''))} placeholder="Örn. 250 ya da -100" className={input} />
        <input aria-label="Puan gerekçesi" value={kpNote} onChange={(e) => setKpNote(e.target.value)} placeholder="Gerekçe (zorunlu)" className={input} />
        <button
          disabled={busy || !Number(kp) || kpNote.trim().length < 3}
          onClick={() => run(() => memberPointsAction(userId, Number(kp), kpNote), () => (setKp(''), setKpNote('')))}
          className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-40"
        >
          {Number(kp) < 0 ? 'Puanı düş' : 'Puan ekle'}
        </button>
      </Card>
    </div>
  )
}

function Card({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-4">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="text-primary">{icon}</span>
        {title}
      </h4>
      <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      {children}
    </div>
  )
}
