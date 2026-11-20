'use client'

import { useState, useTransition, type FormEvent } from 'react'
import useSWR from 'swr'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { addEmojiPackAction, emojiPacksAction, removeEmojiPackAction } from '@/app/panel/tg-post-actions'
import { EMOJI_GROUPS } from '@/components/panel/emoji-picker'
import { btn, btnDanger, btnGhost, input } from '@/components/panel/tg-hub-ui'
import { retryEmojiImages } from '@/components/panel/tg-post-preview'
import { EMOJI_IMAGE_PATH, type EmojiPack } from '@/lib/tg-posts-shared'

type Bot = { id: number; name: string; username: string }
type Result = { ok: boolean; message: string }

const NORMAL = 'normal'
const ADD = 'add'
const cell = 'flex size-9 items-center justify-center rounded-md text-lg hover:bg-secondary focus-visible:bg-secondary'

/** The still picture of a premium emoji; the plain emoji stands in when the picture cannot be loaded. */
function EmojiImage({ id, emoji }: { id: string; emoji: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <span aria-hidden="true">{emoji}</span>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`${EMOJI_IMAGE_PATH}${id}`} alt="" loading="lazy" draggable={false} className="size-7 object-contain" onError={() => setFailed(true)} />
}

function PackGrid({ pack, onPremium, onRemoved }: { pack: EmojiPack; onPremium: (id: string, emoji: string) => void; onRemoved: (result: Result) => void }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, start] = useTransition()

  return (
    <div className="flex flex-col gap-2">
      <div className="grid max-h-56 grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-0.5 overflow-y-auto">
        {pack.emojis.map((e) => (
          <button
            key={e.id}
            type="button"
            aria-label={`${e.emoji} premium emoji`}
            className={cell}
            // Keeps the caret in the writing area while an emoji is picked.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPremium(e.id, e.emoji)}
          >
            <EmojiImage id={e.id} emoji={e.emoji} />
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-xs text-muted-foreground">{pack.emojis.length} emoji. Hareketli olanlar burada durağan görünür, Telegram’da hareket eder.</p>
        {confirming ? (
          <>
            <button type="button" className={btnDanger} disabled={busy} onClick={() => start(async () => onRemoved(await removeEmojiPackAction(pack.name)))}>
              {busy ? 'Kaldırılıyor…' : 'Evet, kaldır'}
            </button>
            <button type="button" className={btnGhost} disabled={busy} onClick={() => setConfirming(false)}>
              Vazgeç
            </button>
          </>
        ) : (
          <button type="button" className={btnGhost} onClick={() => setConfirming(true)}>
            Paketi kaldır
          </button>
        )}
      </div>
    </div>
  )
}

function AddPack({ bots, onAdded }: { bots: Bot[]; onAdded: (name: string | null, result: Result) => void }) {
  const [botId, setBotId] = useState(bots[0]?.id ?? 0)
  const [link, setLink] = useState('')
  const [busy, start] = useTransition()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    // The post form around the writing area must not be submitted by this one.
    e.stopPropagation()
    start(async () => {
      const result = await addEmojiPackAction(botId, link)
      if (result.ok) setLink('')
      onAdded('name' in result && typeof result.name === 'string' ? result.name : null, result)
    })
  }

  if (!bots.length) return <p className="text-xs text-muted-foreground">Paket eklemek için önce bir bot bağla.</p>
  return (
    <form className="flex flex-col gap-2" onSubmit={submit}>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Telegram’da emoji paketini aç, linkini kopyala ve buraya yapıştır. Link <span className="font-mono">t.me/addemoji/…</span> biçimindedir. Paket bir kez
        eklenir, sonra her postta kullanılır.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        {bots.length > 1 && (
          <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:w-48">
            Paketi okuyacak bot
            <select className={input} value={botId} onChange={(e) => setBotId(Number(e.target.value))}>
              {bots.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
          Paket linki
          <input className={input} value={link} placeholder="https://t.me/addemoji/PaketAdi" onChange={(e) => setLink(e.target.value)} />
        </label>
      </div>
      <div>
        <button type="submit" className={btn} disabled={busy || !link.trim()}>
          {busy ? 'Paket okunuyor…' : 'Paketi ekle'}
        </button>
      </div>
    </form>
  )
}

/** Emoji picker of the post writing area: ordinary emoji, plus the premium packs the team has added. */
export function EmojiPanel({
  bots,
  onEmoji,
  onPremium,
  onClose,
}: {
  bots: Bot[]
  onEmoji: (emoji: string) => void
  onPremium: (id: string, emoji: string) => void
  onClose: () => void
}) {
  const { data: packs = [], isLoading, mutate } = useSWR('tg-emoji-packs', emojiPacksAction, { revalidateOnFocus: false })
  const [tab, setTab] = useState(NORMAL)
  const [result, setResult] = useState<Result | null>(null)
  const pack = packs.find((p) => p.name === tab)
  const current = pack || tab === ADD ? tab : NORMAL

  const tabs = [{ id: NORMAL, label: 'Normal emoji' }, ...packs.map((p) => ({ id: p.name, label: p.title }))]
  const tabClass = (on: boolean) =>
    cn('inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-medium', on ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground')

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <div role="tablist" aria-label="Emoji grupları" className="flex flex-1 flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={current === t.id} className={tabClass(current === t.id)} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
          <button type="button" role="tab" aria-selected={current === ADD} className={tabClass(current === ADD)} onClick={() => setTab(ADD)}>
            <Plus className="size-3.5" aria-hidden="true" />
            Premium paket ekle
          </button>
        </div>
        <button type="button" aria-label="Emoji panelini kapat" className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={onClose}>
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {current === NORMAL && (
        <div className="flex flex-col gap-2">
          {EMOJI_GROUPS.map((g) => (
            <div key={g.label} className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground">{g.label}</span>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-0.5">
                {g.emojis.map((e) => (
                  <button key={e} type="button" aria-label={e} className={cell} onMouseDown={(event) => event.preventDefault()} onClick={() => onEmoji(e)}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {isLoading && <p className="text-xs text-muted-foreground">Premium paketler yükleniyor…</p>}
        </div>
      )}

      {pack && (
        <PackGrid
          key={pack.name}
          pack={pack}
          onPremium={onPremium}
          onRemoved={(r) => {
            setResult(r)
            if (r.ok) setTab(NORMAL)
            void mutate()
          }}
        />
      )}

      {current === ADD && (
        <AddPack
          bots={bots}
          onAdded={(name, r) => {
            setResult(r)
            if (!r.ok) return
            retryEmojiImages()
            void mutate()
            if (name) setTab(name)
          }}
        />
      )}

      {result && (
        <p role={result.ok ? 'status' : 'alert'} className={cn('text-xs', result.ok ? 'text-muted-foreground' : 'text-destructive')}>
          {result.message}
        </p>
      )}

      {current !== NORMAL && (
        <p className="border-t border-border pt-2 text-xs leading-relaxed text-muted-foreground">
          Premium emojiyi herkes gönderemez, kuralı Telegram koyuyor: botun Fragment’ten alınmış ek kullanıcı adı varsa her yerde çıkar; yoksa sadece bot
          sahibinin Telegram Premium’u varsa ve mesaj kanala değil gruba ya da özele gidiyorsa çıkar. Hak yoksa post bozulmaz, emojinin normal hali gider ve
          gönderim sonucunda bunu yazarım. Önce “Deneme gönder” ile bak.
        </p>
      )}
    </div>
  )
}
