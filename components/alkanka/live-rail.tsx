'use client'

import { useEffect, useRef, useState } from 'react'
import { Gift, Pin, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TELEGRAM_URL } from './data'

type Msg = { id: number; user: string; level: number; text: string; system?: boolean }

const SEED: Msg[] = [
  { id: 1, user: 'AL KANKA', level: 0, text: 'Hafta sonu drop’u başladı! Kod: ALKANKA250 — ilk 500 kişi.', system: true },
  { id: 2, user: 'mert_k', level: 64, text: 'çarktan 250 geldi ya bugün şanslıyım' },
  { id: 3, user: 'aylin.dev', level: 38, text: 'altın sandıktan 2x boost çıktı' },
  { id: 4, user: 'kaan_88', level: 103, text: 'derbi tahminine ev sahibi dedim' },
  { id: 5, user: 'selin.x', level: 120, text: '7 günlük seri tamam, VIP geldi' },
  { id: 6, user: 'emre.tr', level: 22, text: 'markette seri kalkanı kaldı mı?' },
  { id: 7, user: 'deniz_44', level: 51, text: 'evet 9 tane kaldı acele et' },
]

const POOL: Omit<Msg, 'id'>[] = [
  { user: 'burak.k', level: 17, text: 'zar turnuvasına katıldım' },
  { user: 'AL KANKA', level: 0, text: 'Yeni özel oran yayında: Kuzey derbi haftası.', system: true },
  { user: 'zeynep_s', level: 44, text: 'çift altı attım 400 AC' },
  { user: 'mert_k', level: 64, text: 'bilet çekilişi pazar mı?' },
  { user: 'selin.x', level: 120, text: 'pazar 21:00 kanka' },
  { user: 'kaan_88', level: 103, text: 'görevlerden 250 aldım davet ile' },
  { user: 'AL KANKA', level: 0, text: 'VIP ödül havuzu yenilendi — 500 kontenjan.', system: true },
  { user: 'aylin.dev', level: 38, text: 'sıralamada 4. oldum' },
]

function levelTone(level: number) {
  if (level >= 100) return 'text-primary'
  if (level >= 50) return 'text-accent'
  return 'text-foreground'
}

export function LiveRail() {
  const [messages, setMessages] = useState<Msg[]>(SEED)
  const listRef = useRef<HTMLOListElement>(null)
  const poolIndex = useRef(0)

  useEffect(() => {
    const t = setInterval(() => {
      const next = POOL[poolIndex.current % POOL.length]
      poolIndex.current += 1
      setMessages((m) => [...m.slice(-30), { ...next, id: Date.now() }])
    }, 4200)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  return (
    <aside aria-label="Telegram canlı akış" className="fixed inset-y-0 right-0 z-30 hidden w-80 flex-col border-l border-border bg-surface xl:flex">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
        <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Send className="size-4" aria-hidden="true" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-foreground">Telegram Canlı</span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-1.5 animate-glow rounded-full bg-live" aria-hidden="true" />
            2.384 çevrimiçi
          </span>
        </span>
      </div>

      <div className="flex items-start gap-2 border-b border-border bg-primary/5 px-4 py-2.5 text-xs">
        <Pin className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
        <p className="leading-relaxed text-foreground">
          <span className="font-semibold text-primary">Sabit: </span>
          Kuralları oku, hoş geldin sandığını al.
        </p>
      </div>

      <ol ref={listRef} aria-live="polite" className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-4 no-scrollbar">
        {messages.map((m) =>
          m.system ? (
            <li key={m.id} className="animate-slide-in rounded-lg border border-primary/30 bg-primary/10 p-2.5 text-sm leading-relaxed">
              <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Gift className="size-3.5" aria-hidden="true" />
                {m.user}
              </span>
              <span className="text-foreground">{m.text}</span>
            </li>
          ) : (
            <li key={m.id} className="animate-slide-in text-sm leading-relaxed">
              <span className="mr-1.5 rounded bg-secondary px-1 py-0.5 text-[10px] font-semibold text-muted-foreground tabular-nums">
                {m.level}
              </span>
              <span className={cn('font-semibold', levelTone(m.level))}>{m.user}:</span>{' '}
              <span className="text-muted-foreground">{m.text}</span>
            </li>
          ),
        )}
      </ol>

      <div className="border-t border-border p-3">
        <a
          href={TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
        >
          <Send className="size-4" aria-hidden="true" />
          {"Telegram'da sohbete katıl"}
        </a>
      </div>
    </aside>
  )
}
