'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import useSWR from 'swr'
import { Check, ChevronDown, Coins, Loader2, Lock, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buyAvatarAction, getLookShelf } from '@/app/actions/look'
import { formatAC, usePoints } from '../points-context'

/** Phones open the avatar shelf four rows deep; the rest waits behind one tap. */
const PHONE_FIRST = 12

export function LookShelf() {
  const { points, member, setBalance, requireLogin } = usePoints()
  const { data, isLoading, mutate } = useSWR(['market-look', member?.id ?? 'misafir'], () => getLookShelf())
  const [busy, setBusy] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [msg, setMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null)

  async function buy(id: string) {
    if (!requireLogin()) return
    setBusy(id)
    setMsg(null)
    const res = await buyAvatarAction(id)
    setBusy(null)
    if (!res.ok) return setMsg({ id, ok: false, text: res.error })
    setBalance(res.balance)
    setMsg({ id, ok: true, text: res.message })
    void mutate()
  }

  return (
    <section aria-labelledby="avatar-kapak-baslik" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="avatar-kapak-baslik" className="font-display text-2xl font-bold text-foreground text-balance">
            Profilini kendine benzet
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">
            Satın aldığın avatar kalıcı olarak senin olur ve hemen profiline takılır. Kapaklar satılmaz, rozet seviyen yükseldikçe açılır.
          </p>
        </div>
        <Link href="/profil" className="flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-bold text-foreground hover:bg-secondary">
          <UserRound className="size-4" aria-hidden="true" />
          Profilimde düzenle
        </Link>
      </div>

      {isLoading || !data ? (
        <p className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Avatarlar yükleniyor
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Avatarlar</h3>
            {data.avatars.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Şu an satışta avatar yok.</p>
            ) : (
              <ul className="grid grid-cols-3 gap-2 @md:gap-3 @3xl:grid-cols-4 @5xl:grid-cols-5">
                {data.avatars.map((a, i) => {
                  const mine = a.status === 'selected' || a.status === 'owned' || a.status === 'unlocked'
                  const short = data.signedIn && !mine && points < a.price
                  return (
                    <li key={a.id} className={cn('panel-gold flex flex-col gap-2 rounded-xl p-3 max-sm:gap-1.5 max-sm:p-2', !showAll && i >= PHONE_FIRST && 'max-sm:hidden')}>
                      {/* Avatars are drawn to be worn round; a square frame showed the white corners some of them have. */}
                      <div className="relative aspect-square overflow-hidden rounded-full bg-secondary ring-1 ring-primary/25">
                        <Image src={a.src || '/placeholder.svg'} alt="" fill sizes="(min-width: 1024px) 15vw, 33vw" className="object-cover" />
                      </div>
                      <div className="flex items-start justify-between gap-2 max-sm:flex-col max-sm:gap-0.5">
                        <p className="min-w-0 text-sm font-semibold leading-snug text-foreground text-pretty max-sm:text-xs max-sm:leading-tight">{a.name}</p>
                        {!mine && (
                          <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-primary tabular-nums max-sm:text-xs">
                            <Coins className="size-3.5 max-sm:size-3" aria-hidden="true" />
                            {formatAC(a.price)}
                          </span>
                        )}
                      </div>
                      {mine ? (
                        <p className="mt-auto flex h-10 items-center justify-center gap-1.5 rounded-lg bg-secondary text-xs font-bold text-foreground max-sm:h-8 max-sm:text-[11px]">
                          <Check className="size-3.5 max-sm:hidden" aria-hidden="true" />
                          {a.status === 'selected' ? 'Profilinde takılı' : 'Sende'}
                        </p>
                      ) : (
                        <button
                          type="button"
                          disabled={busy !== null || short}
                          onClick={() => void buy(a.id)}
                          className={cn(
                            'mt-auto flex h-10 items-center justify-center gap-1.5 rounded-lg text-xs font-bold uppercase tracking-wider disabled:cursor-not-allowed max-sm:h-8 max-sm:text-[11px] max-sm:normal-case max-sm:tracking-normal',
                            short ? 'border border-primary/40 text-primary' : 'bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50',
                          )}
                        >
                          {busy === a.id && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                          {short ? `${formatAC(a.price - points)} KC eksik` : 'Satın al'}
                        </button>
                      )}
                      {msg?.id === a.id && (
                        <p role={msg.ok ? 'status' : 'alert'} className={cn('text-xs font-medium leading-relaxed', msg.ok ? 'text-success' : 'text-destructive')}>
                          {msg.text}
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            {!showAll && data.avatars.length > PHONE_FIRST && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-sm font-bold text-foreground active:scale-[0.98] sm:hidden"
              >
                Kalan {data.avatars.length - PHONE_FIRST} avatarı göster
                <ChevronDown className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Kapaklar</h3>
            <ul className="grid grid-cols-1 gap-3 @md:grid-cols-2 @4xl:grid-cols-3">
              {data.covers.map((c) => (
                <li key={c.id} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
                  <div className="relative aspect-[3/1] bg-secondary">
                    <Image src={c.src || '/placeholder.svg'} alt="" fill sizes="(min-width: 1024px) 30vw, 90vw" className={cn('object-cover', !c.unlocked && data.signedIn && 'opacity-60')} />
                  </div>
                  <div className="flex items-center justify-between gap-2 p-3 text-sm">
                    <span className="font-semibold text-foreground">{c.name}</span>
                    <span className={cn('flex items-center gap-1.5 text-xs font-bold', c.unlocked ? 'text-success' : 'text-muted-foreground')}>
                      {c.unlocked ? <Check className="size-3.5" aria-hidden="true" /> : <Lock className="size-3.5" aria-hidden="true" />}
                      {c.unlocked ? 'Açık' : `Lv ${c.level} ile açılır`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  )
}
