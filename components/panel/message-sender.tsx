'use client'


import { askConfirm } from '@/components/panel/confirm-dialog'
import { useRef, useState, useTransition } from 'react'
import { ImagePlus, Loader2, Mail, Search, Send, Trash2, UserRound, Users, X } from 'lucide-react'
import { EmojiPicker } from './emoji-picker'
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
  const [imageUrl, setImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const insertAt = (el: HTMLInputElement | HTMLTextAreaElement | null, value: string, set: (v: string) => void, emoji: string, max: number) => {
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const next = (value.slice(0, start) + emoji + value.slice(end)).slice(0, max)
    set(next)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + emoji.length, start + emoji.length)
    })
  }

  const upload = async (file: File) => {
    setStatus(null)
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('id', 'mesaj')
      const res = await fetch('/api/logo-upload', { method: 'POST', body: form })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) setStatus({ ok: false, text: data.error ?? 'Görsel yüklenemedi.' })
      else setImageUrl(data.url)
    } catch {
      setStatus({ ok: false, text: 'Görsel yüklenemedi.' })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }
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
      const r = await sendInboxMessage({ userId: mode === 'one' ? target!.id : null, title, body, url, imageUrl })
      if (r.ok) {
        setStatus({ ok: true, text: r.message })
        setTitle('')
        setBody('')
        setUrl('')
        setImageUrl('')
      } else setStatus({ ok: false, text: r.error })
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:[&>*:first-child]:col-span-7 lg:[&>*:nth-child(2)]:col-span-5">
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

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="msg-title" className="text-xs font-semibold text-muted-foreground">Başlık (en fazla 80)</label>
            <EmojiPicker label="Başlığa emoji ekle" onPick={(e) => insertAt(titleRef.current, title, setTitle, e, 80)} />
          </div>
          <input id="msg-title" ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required className={input} />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="msg-body" className="text-xs font-semibold text-muted-foreground">Mesaj (en fazla 1000)</label>
            <EmojiPicker label="Mesaja emoji ekle" onPick={(e) => insertAt(bodyRef.current, body, setBody, e, 1000)} />
          </div>
          <textarea id="msg-body" ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} required={!imageUrl} rows={5} className={input} />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Görsel (isteğe bağlı · PNG, JPG, WEBP, GIF · en fazla 2 MB)</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            aria-label="Mesaj görseli seç"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) upload(f)
            }}
          />
          {imageUrl ? (
            <div className="relative overflow-hidden rounded-xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Mesaj görseli önizleme" className="max-h-56 w-full bg-secondary object-contain" />
              <button
                type="button"
                onClick={() => setImageUrl('')}
                aria-label="Görseli kaldır"
                className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow hover:text-destructive"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border px-3 py-5 text-sm font-semibold text-muted-foreground hover:border-primary hover:bg-primary/5 hover:text-foreground disabled:opacity-50"
            >
              {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
              {uploading ? 'Yükleniyor…' : 'Görsel ekle'}
            </button>
          )}
        </div>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
          Buton linki (isteğe bağlı)
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/bonuslar" className={input} />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={sending || uploading}
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
                      void askConfirm('Bu mesaj tüm üyelerin kutusundan silinsin mi?').then((ok) => {
      if (ok) startDelete(async () => void (await deleteInboxMessage(m.id)))
    })
  }}
                    className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-destructive"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
                {m.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.imageUrl} alt="" className="h-20 w-full rounded-lg bg-secondary object-cover" />
                )}
                <p className="line-clamp-2 text-xs text-muted-foreground">{m.body}</p>
                <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
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
