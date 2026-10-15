'use client'

import { useState, useTransition } from 'react'
import { Loader2, Mail, Search, Send, Trash2, UserRound, Users, X } from 'lucide-react'
import { deleteInboxMessage, searchMembersForMessage, sendInboxMessage } from '@/app/panel/inbox-actions'
import type { SentMessage } from '@/lib/inbox'
import { cn } from '@/lib/utils'

type Member = { id: string; name: string; email: string }

const input = 'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'
const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })

export function MessageSender({ sent }: { sent: SentMessage[] }) {
  const [mode, setMode] = useState<'all' | 'one'>('all')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Member[]>([])
  const [target, setTarget] = useState<Member | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [searching, startSearch] = useTransition()
  const [sending, startSend] = useTransition()
  const [, startDelete] = useTransition()

  const search = () => {
    if (query.trim().length < 2) return
    startSearch(async () => setResults(await searchMembersForMessage(query)))
  }

  const send = () => {
    setStatus(null)
    if (mode === 'one' && !target) return setStatus({ ok: false, text: 'Önce bir üye seç.' })
    startSend(async () => {
      const r = await sendInboxMessage({ userId: mode === 'one' ? target!.id : null, title, body, url })
      if (r.ok) {
        setStatus({ ok: true, text: r.message })
        setTitle('')
        setBody('')
        setUrl('')
      } else setStatus({ ok: false, text: r.error })
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
        className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5"
      >
        <div className="flex items-center gap-2">
          <Mail className="size-5 text-primary" aria-hidden />
          <h2 className="font-display text-xl font-bold uppercase text-foreground">Site içi mesaj gönder</h2>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Mesaj üyenin profilindeki <strong className="text-foreground">Mesajlar</strong> kutusuna düşer ve Jako sitede ekrana çıkıp
          &quot;Sana özel mesaj geldi&quot; diye haber verir.
        </p>

        <div role="radiogroup" aria-label="Alıcı" className="grid grid-cols-2 gap-2">
          {(
            [
              { id: 'all', label: 'Tüm üyeler', icon: Users },
              { id: 'one', label: 'Tek üye', icon: UserRound },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={mode === o.id}
              onClick={() => setMode(o.id)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold',
                mode === o.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-secondary',
              )}
            >
              <o.icon className="size-4" aria-hidden />
              {o.label}
            </button>
          ))}
        </div>

        {mode === 'one' && (
          <div className="flex flex-col gap-2">
            {target ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">
                  <strong className="text-foreground">{target.name || 'İsimsiz'}</strong> <span className="text-muted-foreground">{target.email}</span>
                </span>
                <button type="button" onClick={() => setTarget(null)} aria-label="Seçimi kaldır" className="rounded-full p-1 text-muted-foreground hover:bg-secondary">
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return
                      e.preventDefault()
                      search()
                    }}
                    placeholder="Kullanıcı adı veya e-posta"
                    aria-label="Üye ara"
                    className={cn(input, 'flex-1')}
                  />
                  <button type="button" onClick={search} className="flex items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold text-foreground hover:bg-secondary">
                    {searching ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
                    Ara
                  </button>
                </div>
                {results.length > 0 && (
                  <ul className="flex max-h-48 flex-col overflow-y-auto rounded-xl border border-border">
                    {results.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setTarget(m)
                            setResults([])
                          }}
                          className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-secondary"
                        >
                          <span className="font-semibold text-foreground">{m.name || 'İsimsiz'}</span>
                          <span className="text-xs text-muted-foreground">{m.email}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}

        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
          Başlık (en fazla 80)
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
          Mesaj (en fazla 1000)
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} required rows={5} className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
          Buton linki (isteğe bağlı)
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/bonuslar" className={input} />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={sending}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
            {mode === 'all' ? 'Tüm üyelere gönder' : 'Üyeye gönder'}
          </button>
          {status && (
            <p role="status" className={status.ok ? 'text-sm text-primary' : 'text-sm text-destructive'}>
              {status.text}
            </p>
          )}
        </div>
      </form>

      <aside className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display text-base font-bold uppercase text-foreground">Gönderilenler</h3>
        {sent.length ? (
          <ul className="flex flex-col gap-2">
            {sent.map((m) => (
              <li key={m.id} className="flex flex-col gap-1 rounded-xl border border-border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-foreground text-pretty">{m.title}</span>
                  <button
                    type="button"
                    aria-label={`${m.title} mesajını sil`}
                    onClick={() => {
                      if (confirm('Bu mesaj tüm üyelerin kutusundan silinsin mi?')) startDelete(async () => void (await deleteInboxMessage(m.id)))
                    }}
                    className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-destructive"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{m.body}</p>
                <p className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                  <span>{m.target}</span>·<span>{m.reads} okundu</span>·<span>{dateFmt.format(new Date(m.createdAt))}</span>
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Henüz mesaj gönderilmedi.</p>
        )}
      </aside>
    </div>
  )
}
