'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MemberAction, MemberCard } from '@/lib/tg-hub-shared'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { OWNER_ONLY, btnDanger, btnGhost, fmt, useAction, useTgAccess } from '@/components/panel/tg-hub-ui'
import { loadMemberCardAction, markTrusted, memberAction, unbanEverywhere, unlinkSiteAccount } from '@/app/panel/tg-hub-actions'

let openCard: ((tgId: number) => void) | null = null

/** Opens the member card from anywhere inside the Telegram section. */
export function openMemberCard(tgId: number) {
  openCard?.(tgId)
}

/** A person's name that opens their card; plain text when the record has no Telegram id. */
export function MemberName({ tgId, children, className }: { tgId: number | null | undefined; children: ReactNode; className?: string }) {
  if (!tgId) return <span className={className}>{children}</span>
  return (
    <button
      type="button"
      onClick={() => openMemberCard(tgId)}
      className={cn('rounded text-left underline decoration-border underline-offset-2 hover:decoration-foreground', className)}
    >
      {children}
    </button>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-foreground">{children}</dd>
    </div>
  )
}

function Tag({ tone, children }: { tone: 'good' | 'bad' | 'plain'; children: ReactNode }) {
  return (
    <span
      className={cn(
        'rounded-full border px-2 py-0.5 text-xs font-semibold',
        tone === 'good' && 'border-emerald/60 text-foreground',
        tone === 'bad' && 'border-destructive/40 text-destructive',
        tone === 'plain' && 'border-border text-muted-foreground',
      )}
    >
      {children}
    </span>
  )
}

function CardBody({ card, onChanged }: { card: MemberCard; onChanged: () => void }) {
  const access = useTgAccess()
  const a = useAction()
  const act = (action: MemberAction, confirm?: string) => {
    const go = () =>
      a.run(async () => {
        const r = await memberAction(card.tgId, action)
        onChanged()
        return r
      })
    if (confirm) void askConfirm(confirm).then((ok) => ok && go())
    else go()
  }
  const simple = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    a.run(async () => {
      const r = await fn()
      onChanged()
      return r
    })

  return (
    <div className="flex flex-col gap-4">
      {!card.known && (
        <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm leading-relaxed text-muted-foreground">
          Bu hesap hakkında hiçbir kayıt yok: korunan gruplarda yazmamış, girişi görülmemiş, siteye bağlı değil. ID doğruysa yine de banlayabilirsin.
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {card.trust.trusted && <Tag tone="good">Güvenilir</Tag>}
        {card.ban && <Tag tone="bad">Tüm gruplardan yasaklı</Tag>}
        {card.trust.needsCheck && <Tag tone="plain">Doğrulama bekliyor</Tag>}
        {card.site ? <Tag tone="good">Siteye bağlı</Tag> : <Tag tone="plain">Siteye bağlı değil</Tag>}
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact label="Gizli güven puanı">
          <span className={card.trust.score < 30 ? 'text-destructive' : undefined}>{card.trust.score}</span>
          <span className="font-normal text-muted-foreground">/100</span>
        </Fact>
        <Fact label="Uyarı">{card.warns}</Fact>
        <Fact label="Mesaj (son 35 gün)">{card.messages.total}</Fact>
        <Fact label="İlk görülme">{card.trust.firstSeen ? fmt(card.trust.firstSeen) : '—'}</Fact>
      </dl>

      {card.ban && (
        <p className="text-sm leading-relaxed text-foreground">
          <span className="font-semibold">Yasak nedeni:</span> {card.ban.reason || 'yazılmamış'} <span className="text-muted-foreground">· {fmt(card.ban.at)}</span>
        </p>
      )}

      <section className="flex flex-col gap-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Site hesabı</h3>
        {card.site ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 text-sm leading-relaxed text-foreground">
              {card.site.name}
              {card.site.email ? ` · ${card.site.email}` : ''}
              <span className="text-muted-foreground"> · {fmt(card.site.linkedAt)} tarihinde bağladı</span>
            </p>
            <button
              type="button"
              className={btnGhost}
              disabled={a.pending}
              onClick={() =>
                void askConfirm(`${card.site?.name ?? 'Üye'} üyeliğinin bu Telegram hesabıyla bağlantısı kaldırılsın mı? Üye doğru hesabı siteden yeniden bağlayabilir.`).then(
                  (ok) => ok && simple(() => unlinkSiteAccount(card.tgId)),
                )
              }
            >
              Site bağlantısını kaldır
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Telegram hesabını siteye bağlamamış.</p>
        )}
      </section>

      {(card.messages.chats.length > 0 || card.joins.length > 0) && (
        <section className="flex flex-col gap-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gruplar</h3>
          {card.messages.chats.length > 0 && (
            <p className="text-sm leading-relaxed text-foreground">
              {card.messages.chats.map((c) => `${c.title}: ${c.count} mesaj`).join(' · ')}
              {card.messages.lastAt ? <span className="text-muted-foreground"> · son mesaj {fmt(card.messages.lastAt)}</span> : null}
            </p>
          )}
          {card.joins.map((j, i) => (
            <p key={i} className="text-sm leading-relaxed text-muted-foreground">
              {fmt(j.at)} · {j.title} sohbetine girdi{j.via ? ` (${j.via})` : ''}
              {j.removed ? ' · çıkarıldı' : ''}
            </p>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">İşlemler</h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnGhost} disabled={a.pending} onClick={() => simple(() => markTrusted(card.tgId, !card.trust.trusted))}>
            {card.trust.trusted ? 'Güvenilir işaretini kaldır' : 'Güvenilir yap'}
          </button>
          <button type="button" className={btnGhost} disabled={a.pending} onClick={() => act('mute')}>
            24 saat sustur
          </button>
          <button type="button" className={btnGhost} disabled={a.pending} onClick={() => act('unmute')}>
            Susturmayı kaldır
          </button>
          {card.warns > 0 && (
            <button type="button" className={btnGhost} disabled={a.pending} onClick={() => act('clearWarns')}>
              Uyarıları sıfırla
            </button>
          )}
          <button
            type="button"
            className={btnDanger}
            disabled={a.pending}
            onClick={() => act('wipe', `${card.name} adlı kişinin son 48 saatteki tüm mesajları tüm gruplardan silinecek. Emin misin?`)}
          >
            Mesajlarını sil
          </button>
          {card.ban ? (
            <button
              type="button"
              className={btnGhost}
              disabled={a.pending || !access.owner}
              title={access.owner ? undefined : OWNER_ONLY}
              onClick={() => simple(() => unbanEverywhere(card.tgId))}
            >
              Yasağı kaldır
            </button>
          ) : (
            <button
              type="button"
              className={btnDanger}
              disabled={a.pending}
              onClick={() => act('ban', `${card.name} tüm gruplardan banlanacak ve genel yasak listesine girecek. Emin misin?`)}
            >
              Tüm gruplardan banla
            </button>
          )}
        </div>
        {card.ban && !access.owner && <p className="text-xs text-muted-foreground">Genel yasağı sadece ana yönetici kaldırabilir.</p>}
        {a.note}
      </section>

      <section className="flex flex-col gap-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Son kayıtlar</h3>
        {card.log.length ? (
          <ul className="flex flex-col divide-y divide-border">
            {card.log.map((l) => (
              <li key={l.id} className="flex flex-col gap-0.5 py-2 text-sm">
                <span className="font-semibold text-foreground">{l.action}</span>
                <span className="text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                  {l.chatTitle ? `${l.chatTitle} · ` : ''}
                  {l.reason} · {fmt(l.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Bu kişi için kayıt yok.</p>
        )}
      </section>
    </div>
  )
}

/** Mounted once per Telegram section; `openMemberCard` talks to it. */
export function MemberCardHost() {
  const [tgId, setTgId] = useState<number | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const { data, error, isLoading, mutate } = useSWR(tgId ? ['tg-member', tgId] : null, () => loadMemberCardAction(tgId!), { revalidateOnFocus: false })

  useEffect(() => {
    openCard = (id) => setTgId(id)
    return () => {
      openCard = null
    }
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (tgId && !dialog.open) dialog.showModal()
    else if (!tgId && dialog.open) dialog.close()
  }, [tgId])

  const close = () => setTgId(null)
  const title = data ? data.name : tgId ? `ID ${tgId}` : ''

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="tg-member-title"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => e.target === e.currentTarget && close()}
      className="m-auto max-h-[88dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-foreground/40"
    >
      {tgId && (
        <div className="flex flex-col gap-4 p-5">
          <header className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 id="tg-member-title" className="text-base font-semibold text-foreground [overflow-wrap:anywhere]">
                {title}
              </h2>
              <p className="text-xs text-muted-foreground">
                {data?.username ? (
                  <>
                    <a href={`https://t.me/${data.username}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      @{data.username}
                    </a>
                    {' · '}
                  </>
                ) : null}
                Telegram ID <span className="select-all font-mono text-foreground">{tgId}</span>
              </p>
            </div>
            <button type="button" onClick={close} className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted">
              <X className="size-4" aria-hidden="true" />
              <span className="sr-only">Kartı kapat</span>
            </button>
          </header>
          {isLoading && <p className="text-sm text-muted-foreground">Yükleniyor…</p>}
          {error && <p className="text-sm text-destructive">Kart yüklenemedi. Kapatıp tekrar dene.</p>}
          {!isLoading && !error && data === null && <p className="text-sm text-destructive">Bu kartı görmek için Telegram moderasyon izni gerekli.</p>}
          {data && (
            <CardBody
              card={data}
              onChanged={() => {
                void mutate()
                router.refresh()
              }}
            />
          )}
        </div>
      )}
    </dialog>
  )
}
