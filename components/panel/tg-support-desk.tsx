'use client'

import { useState, useTransition } from 'react'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { Card, btn, btnGhost, input, useAction, type ActionResult } from '@/components/panel/tg-hub-ui'
import { when } from '@/components/panel/tg-post-ui'
import { closeTicketAction, deleteTicketAction, searchTicketsAction } from '@/app/panel/tg-hub-actions'
import type { CannedReply, TicketPage, TicketRow } from '@/lib/tg-hub-shared'

type Tab = 'open' | 'closed'

const waitText = (min: number) => (min < 60 ? `${min} dk` : min < 2880 ? `${Math.floor(min / 60)} sa ${min % 60} dk` : `${Math.floor(min / 1440)} gün`)

function TicketItem({ t, canned, alertMinutes, onChanged }: { t: TicketRow; canned: CannedReply[]; alertMinutes: number; onChanged: () => void }) {
  const [answer, setAnswer] = useState('')
  const a = useAction()
  const open = t.status === 'open' || t.status === 'claimed'
  const late = t.status === 'open' && alertMinutes > 0 && t.waitMin >= alertMinutes
  const run = (fn: () => Promise<ActionResult>) =>
    a.run(async () => {
      const result = await fn()
      if (result.ok) onChanged()
      return result
    })
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">#{t.id}</span> · {t.name}
          {t.username ? ` (@${t.username})` : ''} · {t.sponsor} · {t.category}
        </span>
        <span>{when(t.createdAt)}</span>
      </div>
      {open && (
        <p className="flex flex-wrap items-center gap-2 text-xs">
          <span className={late ? 'rounded-full bg-destructive/10 px-2 py-0.5 font-semibold text-destructive' : 'rounded-full bg-muted px-2 py-0.5 text-muted-foreground'}>
            {late ? `Cevapsız: ${waitText(t.waitMin)}` : `${waitText(t.waitMin)} bekliyor`}
          </span>
          <span className="text-muted-foreground">{t.status === 'claimed' ? `Üstlenen: ${t.claimedBy ?? 'yetkili'}` : 'Henüz kimse üstlenmedi'}</span>
        </p>
      )}
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">{t.text}</p>
      {open ? (
        <>
          {canned.length > 0 && (
            <select
              aria-label="Hazır cevap seç"
              className={input}
              value=""
              onChange={(e) => {
                const pick = canned[Number(e.target.value)]
                if (pick) setAnswer((current) => (current.trim() ? `${current.trimEnd()}\n${pick.text}` : pick.text))
              }}
            >
              <option value="">Hazır cevap ekle…</option>
              {canned.map((c, i) => (
                <option key={i} value={i}>
                  {c.title}
                </option>
              ))}
            </select>
          )}
          <textarea aria-label="Cevap" className="min-h-16 rounded-lg border border-border bg-background p-2 text-sm text-foreground" placeholder="Üyeye gidecek cevap ya da red nedeni" value={answer} onChange={(e) => setAnswer(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} disabled={a.pending} onClick={() => run(() => closeTicketAction(t.id, 'resolved', answer))}>
              Çözüldü olarak gönder
            </button>
            <button type="button" className={btnGhost} disabled={a.pending} onClick={() => run(() => closeTicketAction(t.id, 'rejected', answer))}>
              Reddet
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="min-w-0 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
            {t.status === 'resolved' ? 'Çözüldü' : 'Reddedildi'}
            {t.closedAt ? ` · ${when(t.closedAt)}` : ''}
            {t.claimedBy ? ` · ${t.claimedBy}` : ''}
            {t.rating ? ` · Puan ${t.rating}/5` : ''}
            {t.answer ? `\n${t.answer}` : ''}
          </p>
          <button
            type="button"
            className="shrink-0 text-xs text-destructive hover:underline disabled:opacity-50"
            disabled={a.pending}
            onClick={() => {
              void askConfirm(`#${t.id} numaralı bilet kalıcı olarak silinsin mi? Sponsor karnesinden de düşer, geri alınamaz.`).then((ok) => {
                if (ok) run(() => deleteTicketAction(t.id))
              })
            }}
          >
            {a.pending ? 'Siliniyor…' : 'Sil'}
          </button>
        </div>
      )}
      {a.note}
    </li>
  )
}

/**
 * `tickets` is the fresh first page from the server and is what the desk shows by default. A search or "older" click
 * replaces it with its own result, kept under the tab and query it belongs to so it never leaks into another view.
 */
export function TicketDesk({ tickets, canned, alertMinutes }: { tickets: TicketRow[]; canned: CannedReply[]; alertMinutes: number }) {
  const [tab, setTab] = useState<Tab>('open')
  const [typed, setTyped] = useState('')
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<({ key: string } & TicketPage) | null>(null)
  const [pending, start] = useTransition()

  const openList = tickets.filter((t) => t.status === 'open' || t.status === 'claimed')
  const closedList = tickets.filter((t) => t.status === 'resolved' || t.status === 'rejected')
  const base = tab === 'open' ? openList : closedList
  const key = `${tab}|${query}`
  const own = found?.key === key ? found : null
  const list = own ? own.rows : base
  // The first page holds 40 open and 30 closed tickets; a full page means there may be older ones.
  const hasMore = own ? own.hasMore : base.length >= (tab === 'open' ? 40 : 30)
  const late = alertMinutes > 0 ? openList.filter((t) => t.status === 'open' && t.waitMin >= alertMinutes).length : 0

  const load = (nextTab: Tab, nextQuery: string, append: TicketRow[] = []) =>
    start(async () => {
      const page = await searchTicketsAction(nextTab, nextQuery, append.at(-1)?.id)
      setFound({ key: `${nextTab}|${nextQuery}`, rows: [...append, ...page.rows], hasMore: page.hasMore })
    })

  const search = (value: string) => {
    const q = value.trim()
    setQuery(q)
    if (q) load(tab, q)
    else setFound(null)
  }
  const switchTab = (next: Tab) => {
    setTab(next)
    if (query) load(next, query)
    else setFound(null)
  }
  // After an answer or a delete the server page refreshes by itself; a search result has to be asked for again.
  const onChanged = () => {
    if (own) load(tab, query)
  }

  const tabClass = (active: boolean) =>
    active
      ? 'rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground'
      : 'rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted'

  return (
    <Card title="Biletler" hint="Biletleri Telegram grubundan da cevaplayabilirsin; burası aynı işin panel hali. Deneme için açılmış kapalı bir bileti silebilirsin; silinen bilet sponsor karnesinden de düşer.">
      {late > 0 && (
        <p role="status" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {late} bilet {alertMinutes} dakikadan uzun süredir kimse tarafından üstlenilmedi.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Bilet durumu" className="flex gap-1">
          <button type="button" aria-pressed={tab === 'open'} className={tabClass(tab === 'open')} onClick={() => switchTab('open')}>
            Açık ({openList.length})
          </button>
          <button type="button" aria-pressed={tab === 'closed'} className={tabClass(tab === 'closed')} onClick={() => switchTab('closed')}>
            Kapalı
          </button>
        </div>
        <form
          className="flex min-w-0 flex-1 gap-2"
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            search(typed)
          }}
        >
          <input aria-label="Biletlerde ara" className={input} placeholder="Bilet no, isim, @kullanıcı, sponsor ya da metin" value={typed} onChange={(e) => setTyped(e.target.value)} />
          <button type="submit" className={`${btnGhost} shrink-0`} disabled={pending}>
            Ara
          </button>
          {query && (
            <button
              type="button"
              className={`${btnGhost} shrink-0`}
              onClick={() => {
                setTyped('')
                search('')
              }}
            >
              Temizle
            </button>
          )}
        </form>
      </div>
      {query && (
        <p role="status" className="text-xs text-muted-foreground">
          {pending ? 'Aranıyor…' : `"${query}" için ${tab === 'open' ? 'açık' : 'kapalı'} biletlerde ${list.length}${hasMore ? '+' : ''} sonuç.`}
        </p>
      )}
      {list.length ? (
        <ul className="flex flex-col gap-2">
          {list.map((t) => (
            <TicketItem key={t.id} t={t} canned={canned} alertMinutes={alertMinutes} onChanged={onChanged} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{pending ? 'Yükleniyor…' : query ? 'Bu aramaya uyan bilet yok.' : tab === 'open' ? 'Açık bilet yok.' : 'Kapanan bilet yok.'}</p>
      )}
      {hasMore && list.length > 0 && (
        <button type="button" className={`${btnGhost} self-start`} disabled={pending} onClick={() => load(tab, query, list)}>
          {pending ? 'Yükleniyor…' : 'Daha eski biletler'}
        </button>
      )}
    </Card>
  )
}
