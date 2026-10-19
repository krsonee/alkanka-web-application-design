'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { mutate } from 'swr'
import { Check, Coins, Download, Gift, ImageIcon, Lock, Send, Shirt, Sparkles, UserRound } from 'lucide-react'
import { buyAvatarAction, chooseAvatarAction, setCoverAction, setTeamAction } from '@/app/actions/look'
import { AVATAR_GROUPS, TEAMS, unlockLabel, type AvatarCard, type AvatarGroup, type LookState } from '@/lib/avatars-shared'
import { AVATAR_MAP_KEY } from '@/components/alkanka/member-avatar'
import { usePoints } from '@/components/alkanka/points-context'
import { cn } from '@/lib/utils'

type Section = 'avatar' | 'kapak' | 'takim'

const SECTIONS: { id: Section; label: string; icon: typeof UserRound }[] = [
  { id: 'avatar', label: 'Avatar', icon: UserRound },
  { id: 'kapak', label: 'Kapak', icon: ImageIcon },
  { id: 'takim', label: 'Takımım', icon: Shirt },
]

const canDownload = (a: AvatarCard) => a.status === 'selected' || a.status === 'owned' || a.status === 'unlocked'

export function LookStudio({ initial }: { initial: LookState }) {
  const [state, setState] = useState(initial)
  const [section, setSection] = useState<Section>('avatar')
  const [group, setGroup] = useState<AvatarGroup>('jako')
  const [focus, setFocus] = useState<string | null>(initial.avatarId ?? initial.avatars[0]?.id ?? null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  const { refresh } = usePoints()

  const focused = state.avatars.find((a) => a.id === focus) ?? null
  const shown = state.avatars.filter((a) => a.group === group)

  const act = (fn: () => ReturnType<typeof chooseAvatarAction>) =>
    start(async () => {
      const res = await fn()
      if (!res.ok) {
        setNotice({ tone: 'err', text: res.error })
        return
      }
      setState(res.state)
      setNotice({ tone: 'ok', text: res.message })
      mutate(AVATAR_MAP_KEY)
      mutate('look-summary')
      refresh()
      router.refresh()
    })

  return (
    <section aria-labelledby="gorunum" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 id="gorunum" className="font-display text-lg font-bold text-foreground">Görünümün</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Avatarın sohbette, liderlikte ve canlı akışta adının yanında görünür. Sahip olduklarını indirip Telegram profilinde de kullanabilirsin.
        </p>
      </div>

      {state.rewardPending && (
        <div className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-4">
          <Gift className="size-5 shrink-0 text-gold" aria-hidden />
          <p className="text-sm leading-relaxed text-foreground">
            İlk avatarını seç, hesabına <b className="text-gold">+{state.reward} KC</b> hoş geldin ödülü yatsın.
          </p>
        </div>
      )}

      <div role="tablist" aria-label="Görünüm bölümleri" className="flex gap-1 rounded-xl border border-border bg-card p-1">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={section === s.id}
            onClick={() => setSection(s.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
              section === s.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <s.icon className="size-4" aria-hidden />
            {s.label}
          </button>
        ))}
      </div>

      {notice && (
        <p role="status" className={cn('rounded-xl px-4 py-3 text-sm font-medium', notice.tone === 'ok' ? 'bg-live/10 text-live' : 'bg-destructive/10 text-destructive')}>
          {notice.text}
        </p>
      )}

      {section === 'avatar' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex gap-2">
              {(Object.keys(AVATAR_GROUPS) as AvatarGroup[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={group === g}
                  onClick={() => setGroup(g)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
                    group === g ? 'border-gold bg-gold/15 text-gold' : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {AVATAR_GROUPS[g]}
                </button>
              ))}
            </div>
            <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 xl:grid-cols-5">
              {shown.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setFocus(a.id)}
                    aria-pressed={focus === a.id}
                    aria-label={`${a.name}, ${statusText(a)}`}
                    className={cn(
                      'group relative flex w-full flex-col items-center gap-1.5 rounded-2xl border p-2 transition-colors',
                      focus === a.id ? 'border-gold bg-gold/10' : 'border-border bg-card hover:border-gold/40',
                    )}
                  >
                    <span className="relative aspect-square w-full overflow-hidden rounded-full bg-secondary">
                      <Image src={a.src} alt="" fill sizes="120px" className={cn('object-cover', a.status === 'locked' && 'opacity-40 grayscale')} />
                      {a.status === 'locked' && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <Lock className="size-5 text-foreground" aria-hidden />
                        </span>
                      )}
                      {a.status === 'selected' && (
                        <span className="absolute bottom-0.5 right-0.5 flex size-5 items-center justify-center rounded-full bg-gold text-gold-foreground">
                          <Check className="size-3" aria-hidden />
                        </span>
                      )}
                    </span>
                    <span className="w-full truncate text-center text-[11px] font-semibold text-foreground">{a.name}</span>
                    <StatusChip a={a} />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {focused && (
            <aside aria-label="Seçili avatar" className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-32 lg:self-start">
              <div className="relative size-40 overflow-hidden rounded-full border-4 border-gold bg-secondary">
                <Image src={focused.src} alt={focused.name} fill sizes="160px" className={cn('object-cover', focused.status === 'locked' && 'opacity-40 grayscale')} />
              </div>
              <div className="flex flex-col items-center gap-1 text-center">
                <span className="font-display text-lg font-bold text-foreground">{focused.name}</span>
                <span className="text-xs text-muted-foreground">{AVATAR_GROUPS[focused.group]} · {unlockLabel(focused)}</span>
              </div>
              <PrimaryAction a={focused} level={state.level} balance={state.balance} pending={pending} onChoose={() => act(() => chooseAvatarAction(focused.id))} onBuy={() => act(() => buyAvatarAction(focused.id))} />
              {canDownload(focused) ? (
                <div className="flex w-full flex-col gap-2 rounded-xl bg-background/60 p-3">
                  <a
                    href={`/api/avatar/indir/${focused.id}`}
                    download={`alkanka-${focused.id}.png`}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gold/50 text-sm font-bold text-gold hover:bg-gold/10"
                  >
                    <Download className="size-4" aria-hidden /> İndir (Telegram için)
                  </a>
                  <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                    <Send className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                    Telegram: Ayarlar, Profil fotoğrafı ayarla, indirdiğin görseli seç. Yuvarlak kırpılsa da AL KANKA imzası görselde kalır.
                  </p>
                </div>
              ) : (
                <p className="text-center text-xs leading-relaxed text-muted-foreground">Bu avatarı açınca indirip Telegram&apos;da da kullanabilirsin.</p>
              )}
            </aside>
          )}
        </div>
      )}

      {section === 'kapak' && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {state.covers.map((c) => {
            const active = c.id === state.coverId
            return (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={!c.unlocked || pending || active}
                  onClick={() => act(() => setCoverAction(c.id))}
                  className={cn(
                    'relative flex w-full flex-col overflow-hidden rounded-2xl border text-left transition-colors disabled:cursor-default',
                    active ? 'border-gold' : 'border-border hover:border-gold/40',
                  )}
                >
                  <span className="relative h-28 w-full">
                    <Image src={c.src} alt="" fill sizes="(min-width: 1024px) 33vw, 100vw" className={cn('object-cover', !c.unlocked && 'opacity-40 grayscale')} />
                  </span>
                  <span className="flex items-center justify-between gap-2 bg-card px-3 py-2.5">
                    <span className="text-sm font-semibold text-foreground">{c.name}</span>
                    <span className={cn('text-xs font-bold', active ? 'text-gold' : c.unlocked ? 'text-muted-foreground' : 'text-muted-foreground')}>
                      {active ? 'Kullanılıyor' : c.unlocked ? 'Seç' : `Seviye ${c.level}`}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {section === 'takim' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-muted-foreground">Taraftarı olduğun renkleri seç; profilinde görünür.</p>
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {TEAMS.map((t) => {
              const active = state.team === t.id
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    disabled={pending}
                    aria-pressed={active}
                    onClick={() => act(() => setTeamAction(active ? null : t.id))}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm font-semibold transition-colors',
                      active ? 'border-gold bg-gold/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <span aria-hidden className="size-7 shrink-0 rounded-full border border-border" style={{ background: `linear-gradient(90deg, ${t.colors[0]} 50%, ${t.colors[1]} 50%)` }} />
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    {active && <Check className="size-4 text-gold" aria-hidden />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}

function statusText(a: AvatarCard) {
  if (a.status === 'selected') return 'kullanılıyor'
  if (a.status === 'owned' || a.status === 'unlocked') return 'açık'
  if (a.status === 'buy') return `${a.price} KC ile satın al`
  return `${unlockLabel(a)} ile açılır`
}

function StatusChip({ a }: { a: AvatarCard }) {
  if (a.status === 'selected') return <span className="text-[10px] font-bold text-gold">Kullanılıyor</span>
  if (a.status === 'owned' || a.status === 'unlocked') return <span className="text-[10px] font-semibold text-live">Açık</span>
  if (a.status === 'buy') return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary"><Coins className="size-3" aria-hidden />{a.price.toLocaleString('tr-TR')}</span>
  return <span className="text-[10px] font-semibold text-muted-foreground">{unlockLabel(a)}</span>
}

function PrimaryAction({
  a,
  level,
  balance,
  pending,
  onChoose,
  onBuy,
}: {
  a: AvatarCard
  level: number
  balance: number
  pending: boolean
  onChoose: () => void
  onBuy: () => void
}) {
  const base = 'inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold disabled:opacity-60'
  if (a.status === 'selected') return <span className={cn(base, 'border border-gold/40 text-gold')}><Check className="size-4" aria-hidden /> Profilinde takılı</span>
  if (a.status === 'owned' || a.status === 'unlocked')
    return (
      <button type="button" disabled={pending} onClick={onChoose} className={cn(base, 'bg-primary text-primary-foreground')}>
        <Sparkles className="size-4" aria-hidden /> Bunu kullan
      </button>
    )
  if (a.status === 'buy') {
    const short = balance < a.price
    return (
      <button type="button" disabled={pending || short} onClick={onBuy} className={cn(base, 'bg-gold text-gold-foreground')}>
        <Coins className="size-4" aria-hidden />
        {short ? `${(a.price - balance).toLocaleString('tr-TR')} KC eksik` : `${a.price.toLocaleString('tr-TR')} KC ile al`}
      </button>
    )
  }
  return (
    <span className={cn(base, 'border border-border text-muted-foreground')}>
      <Lock className="size-4" aria-hidden /> Seviye {a.level} olunca açılır (şu an {level})
    </span>
  )
}
