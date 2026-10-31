'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const QUICK = ['Hadi kanka', 'Şans seninle', 'Güzel hamle', 'Bekletme be', 'Bu el benim', 'Helal olsun']
const REPLIES = ['Sakin ol kanka', 'Göreceğiz', 'Bu el bizde', 'Haha', 'Taş gelmiyor ya', 'Okey bende olabilir', 'Bakalım']

type Msg = { id: number; from: string; text: string; mine?: boolean }

/** Bot tables have no real players to talk to, so chat is quick phrases and the bots answer now and then. */
export function OkeyBotChat({ bots }: { bots: string[] }) {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [unread, setUnread] = useState(0)
  const nextId = useRef(0)
  const listRef = useRef<HTMLOListElement>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [msgs, open])

  const push = (m: Omit<Msg, 'id'>) => setMsgs((cur) => [...cur.slice(-30), { ...m, id: nextId.current++ }])

  const send = (text: string) => {
    push({ from: 'Sen', text, mine: true })
    if (Math.random() < 0.65) {
      const from = bots[Math.floor(Math.random() * bots.length)]
      const reply = REPLIES[Math.floor(Math.random() * REPLIES.length)]
      timers.current.push(
        setTimeout(() => {
          push({ from, text: reply })
          setOpen((o) => {
            if (!o) setUnread((u) => u + 1)
            return o
          })
        }, 1200 + Math.random() * 1800),
      )
    }
  }

  return (
    <>
      <button
        type="button"
        className="okt-chat-btn"
        onClick={() => {
          setOpen((o) => !o)
          setUnread(0)
        }}
        aria-expanded={open}
        aria-label={unread ? `Masa sohbeti, ${unread} yeni mesaj` : 'Masa sohbeti'}
      >
        <MessageCircle aria-hidden="true" />
        {unread > 0 && <span className="okt-chat-badge">{unread}</span>}
      </button>
      {open && (
        <div className="okt-chat" role="dialog" aria-label="Masa sohbeti">
          <div className="okt-chat-head">
            <span>Masa sohbeti</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Sohbeti kapat">
              <X aria-hidden="true" />
            </button>
          </div>
          <ol ref={listRef} className="okt-chat-list" aria-live="polite">
            {msgs.length === 0 && <li className="okt-chat-empty">Masaya bir laf at kanka</li>}
            {msgs.map((m) => (
              <li key={m.id} className={cn('okt-chat-msg', m.mine && 'mine')}>
                {!m.mine && <b>{m.from}</b>}
                {m.text}
              </li>
            ))}
          </ol>
          <div className="okt-chat-quick">
            {QUICK.map((q) => (
              <button key={q} type="button" onClick={() => send(q)}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
