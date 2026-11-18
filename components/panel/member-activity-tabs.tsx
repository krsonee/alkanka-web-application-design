'use client'

import { useState, useTransition } from 'react'
import { Award, Gift, ShieldCheck, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { askConfirm, confirmed } from '@/components/panel/confirm-dialog'
import { giftAction, memberBadgeAction, memberPointsAction, memberRevokeBadgeAction, memberRoleAction } from '@/app/panel/members-actions'
import type { MemberActivity } from '@/lib/members-admin'
import { TOURNAMENT_MONEY_GAME } from '@/lib/tournaments-shared'

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

const TOURNAMENT_COINS: Record<string, { label: string; cls: string }> = {
  win: { label: 'Turnuva ödülü', cls: 'text-primary' },
  loss: { label: 'Giriş ücreti', cls: 'text-muted-foreground' },
  refund: { label: 'Ücret iadesi', cls: 'text-muted-foreground' },
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

type RoleOption = { id: string; name: string; staff: boolean }

export function MemberActivityTabs({
  tab,
  userId,
  activity,
  badges,
  roles,
  roleId,
  canRoles,
  onDone,
}: {
  tab: ActivityTab
  userId: string
  activity: MemberActivity
  badges: { id: string; name: string; tier: string }[]
  roles: RoleOption[]
  roleId: string | null
  canRoles: boolean
  onDone: (r: Result) => void
}) {
  if (tab === 'oyunlar') return <GamesTab activity={activity} />
  if (tab === 'islemler') return <TransactionsTab activity={activity} />
  return <RewardsTab userId={userId} activity={activity} badges={badges} roles={roles} roleId={roleId} canRoles={canRoles} onDone={onDone} />
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
              const coins = g.game === TOURNAMENT_MONEY_GAME ? TOURNAMENT_COINS[g.result] : undefined
              const r = coins ?? RESULT[g.result] ?? { label: g.result, cls: 'text-muted-foreground' }
              return (
                <li key={g.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium capitalize text-foreground">
                      {g.game} {!coins && <span className="font-normal text-muted-foreground">· {g.mode === 'admin' ? 'turnuva, sonucu yönetim girdi' : g.mode}</span>}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {coins
                        ? `${g.opponent ? `${g.opponent} · ` : ''}${when(g.createdAt)}`
                        : `${g.opponent ? `Rakip: ${g.opponent} · ` : ''}Bahis ${g.stake.toLocaleString('tr-TR')} KC · ${when(g.createdAt)}`}
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
  roles,
  roleId,
  canRoles,
  onDone,
}: {
  userId: string
  activity: MemberActivity
  badges: { id: string; name: string; tier: string }[]
  roles: RoleOption[]
  roleId: string | null
  canRoles: boolean
  onDone: (r: Result) => void
}) {
  const [busy, start] = useTransition()
  const [pickedRole, setPickedRole] = useState(roleId ?? roles[0]?.id ?? '')
  const currentRole = roles.find((r) => r.id === roleId)
  const nextRole = roles.find((r) => r.id === pickedRole)
  const ownBadges = activity.badges.filter((b) => !roles.some((r) => r.id === b.id))
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
        <input aria-label="Hediye tutarı" inputMode="numeric" value={gift} onChange={(e) => setGift(e.target.value.replace(/[^\d-]/g, ''))} placeholder="Tutar (KC)" className={input} />
        {gift !== '' && !(Number(gift) >= 1 && Number(gift) <= 100000) && (
          <p role="alert" className="text-xs text-destructive">
            Hediye 1 ile 100.000 KC arasında olmalı. Bakiye düşmek için &quot;Bakiye düzeltme&quot; bölümünü kullan.
          </p>
        )}
        <textarea aria-label="Hediye mesajı" value={giftMsg} onChange={(e) => setGiftMsg(e.target.value)} rows={2} placeholder="Mesaj (isteğe bağlı) — örn. Turnuva tesellisi, iyi şanslar!" className={cn(input, 'resize-y leading-relaxed')} />
        <button
          disabled={busy || !(Number(gift) >= 1 && Number(gift) <= 100000)}
          onClick={() =>
            confirmed(`Bu üyeye ${Number(gift).toLocaleString('tr-TR')} KC hediye gönderilsin mi? Hesabına hemen eklenir ve gelen kutusuna mesaj düşer.`, () =>
              run(() => giftAction(userId, Number(gift), giftMsg), () => (setGift(''), setGiftMsg(''))),
            )
          }
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          Hediyeyi gönder
        </button>
      </Card>

      <Card
        icon={<ShieldCheck className="size-4" aria-hidden="true" />}
        title="Rol ver"
        hint="Rol, üyenin adının yanında sohbette ve sitede seviye yerine kendi rengiyle görünür. Bir üyede tek rol olur; yenisini verince eskisi kalkar."
      >
        <p className="text-sm text-foreground">
          Şu anki rol: <span className="font-semibold">{currentRole?.name ?? 'Yok'}</span>
        </p>
        {!canRoles ? (
          <p className="text-sm text-muted-foreground">Rol vermek için hesabında &quot;Görevliler&quot; yetkisi olmalı.</p>
        ) : roles.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz rol yok. Üye listesinin üstündeki &quot;Roller ve özel yetkiler&quot; kartından oluşturabilirsin.</p>
        ) : (
          <>
            <select aria-label="Rol" value={pickedRole} onChange={(e) => setPickedRole(e.target.value)} className={input}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.staff ? ' (görevli)' : ''}
                </option>
              ))}
            </select>
            {nextRole?.staff && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Görevli rolü: bu üye Kanka Puan kazanmaz, sıralamada görünmez, marketten alışveriş yapamaz ve etkinliklere katılamaz.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !pickedRole || pickedRole === roleId}
                onClick={() =>
                  confirmed(
                    `${currentRole ? `Üyenin şu anki "${currentRole.name}" rolü kalkar, yerine "${nextRole?.name ?? ''}" verilir.` : `Üyeye "${nextRole?.name ?? ''}" rolü verilir.`}${
                      nextRole?.staff ? ' Görevli rolüyle Kanka Puan kazanamaz, alışveriş yapamaz ve etkinliklere katılamaz.' : ''
                    } Onaylıyor musun?`,
                    () => run(() => memberRoleAction(userId, pickedRole), () => {}),
                  )
                }
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
              >
                Rolü ver
              </button>
              {currentRole && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void askConfirm(`${currentRole.name} rolü bu üyeden kaldırılsın mı?`).then((ok) => ok && run(() => memberRoleAction(userId, null), () => {}))
                  }
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-40"
                >
                  Rolü kaldır
                </button>
              )}
            </div>
          </>
        )}
      </Card>

      <Card icon={<Award className="size-4" aria-hidden="true" />} title="Rozet ver" hint="Rozetin bonus puanı varsa otomatik eklenir. Yeni rozetleri Kanka Puan bölümünden oluşturabilirsin.">
        {ownBadges.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {ownBadges.map((b) => (
              <li key={b.id} className="flex items-center gap-1 rounded-full bg-primary/15 py-1 pl-3 pr-1 text-xs font-semibold text-primary">
                {b.name}
                {b.count > 1 ? ` x${b.count}` : ''}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void askConfirm(`${b.name} rozeti${b.count > 1 ? ' (son verilen)' : ''} ve bonus puanı geri alınsın mı?`).then(
                      (ok) => ok && run(() => memberRevokeBadgeAction(userId, b.lastAwardId), () => {}),
                    )
                  }
                  aria-label={`${b.name} rozetini geri al`}
                  title="Geri al"
                  className="flex size-5 items-center justify-center rounded-full text-primary hover:bg-destructive/15 hover:text-destructive disabled:opacity-40"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
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
              onClick={() => {
                const give = () => run(() => memberBadgeAction(userId, badgeId, badgeNote), () => setBadgeNote(''))
                const held = activity.badges.find((b) => b.id === badgeId)
                if (!held) return confirmed(`Bu üyeye "${badges.find((b) => b.id === badgeId)?.name ?? ''}" rozeti verilsin mi? Bonus puanı varsa hemen eklenir.`, give)
                void askConfirm(`Bu üyede "${held.name}" rozeti zaten var. Bir kez daha verirsen bonus puanı da tekrar eklenir. Yine de verilsin mi?`).then((ok) => ok && give())
              }}
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
          onClick={() =>
            confirmed(
              Number(kp) < 0
                ? `Bu üyeden ${Math.abs(Number(kp)).toLocaleString('tr-TR')} Kanka Puan düşülsün mü? Seviyesi ve sıralaması değişebilir.`
                : `Bu üyeye ${Number(kp).toLocaleString('tr-TR')} Kanka Puan eklensin mi? Seviyesi ve sıralaması değişebilir.`,
              () => run(() => memberPointsAction(userId, Number(kp), kpNote), () => (setKp(''), setKpNote(''))),
            )
          }
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
