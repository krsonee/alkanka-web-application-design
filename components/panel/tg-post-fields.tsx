'use client'

import { useId, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CheckCircle2, Images, Loader2, Plus, RefreshCw, Trash2, Upload, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NumberField, Toggle, btnGhost, input } from '@/components/panel/tg-hub-ui'
import { BUTTON_ICON, MediaTile } from '@/components/panel/tg-post-preview'
import {
  BUTTON_KINDS,
  DEFAULT_ALT,
  DEFAULT_JOINED,
  LABEL_LIMIT,
  MAX_BUTTONS_PER_ROW,
  MAX_BUTTON_ROWS,
  MAX_DELETE_HOURS,
  MAX_MEDIA,
  MAX_UNPIN_HOURS,
  MEDIA_KIND_LABEL,
  PRESS_KINDS,
  UPLOAD_TYPES,
  botLink,
  buttonText,
  extensionOf,
  mediaUrl,
  newButtonId,
  signatureHtml,
  uploadProblem,
  type PostButton,
  type PostButtonKind,
  type PostCenterData,
  type PostMedia,
  type PostOptions,
  type PostSponsor,
  type PostTarget,
  type TargetCheck,
} from '@/lib/tg-posts-shared'

/** State setters here take an updater, so an upload that finishes late never overwrites newer edits. */
export type Update<T> = (fn: (prev: T) => T) => void

const iconButton = 'inline-flex size-9 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted disabled:opacity-40'
const fieldLabel = 'flex flex-col gap-1 text-xs text-muted-foreground'

// --- Media -----------------------------------------------------------------------

const ACCEPT = Object.keys(UPLOAD_TYPES)
  .map((ext) => `.${ext}`)
  .join(',')
const MULTIPART_OVER_BYTES = 8 * 1024 * 1024

export async function uploadPostMedia(file: File): Promise<PostMedia> {
  const problem = uploadProblem(file)
  if (problem) throw new Error(`${file.name}: ${problem}`)
  const ext = extensionOf(file.name)
  const type = UPLOAD_TYPES[ext]
  const { upload } = await import('@vercel/blob/client')
  const blob = await upload(`tgposts/${Date.now().toString(36)}${newButtonId()}.${ext}`, file, {
    access: 'private',
    handleUploadUrl: '/api/tg/post-media/token',
    contentType: type.mime,
    multipart: file.size > MULTIPART_OVER_BYTES,
  }).catch(() => {
    throw new Error(`${file.name} yüklenemedi. Oturumun açık olduğundan emin olup tekrar dene.`)
  })
  return { kind: type.kind, path: blob.pathname, name: file.name, size: file.size }
}

/**
 * `fixed` is for a post that is already in Telegram: the number of files cannot change there,
 * so each one can only be swapped for another.
 */
export function MediaField({ media, update, library, fixed = false }: { media: PostMedia[]; update: Update<PostMedia[]>; library: PostCenterData['library']; fixed?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const replaceAt = useRef<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [picker, setPicker] = useState(false)
  const room = MAX_MEDIA - media.length

  async function handleFiles(files: File[]) {
    const at = replaceAt.current
    replaceAt.current = null
    const problems: string[] = []
    const accepted = at != null ? files.slice(0, 1) : files.slice(0, room)
    if (at == null && files.length > room) problems.push(`Bir postta en fazla ${MAX_MEDIA} medya olur; fazlası eklenmedi.`)
    setBusy(true)
    for (const file of accepted) {
      try {
        const item = await uploadPostMedia(file)
        update((prev) => (at != null ? prev.map((m, i) => (i === at ? item : m)) : prev.length < MAX_MEDIA ? [...prev, item] : prev))
      } catch (error) {
        problems.push(error instanceof Error ? error.message : `${file.name} yüklenemedi.`)
      }
    }
    setErrors(problems)
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const pickFiles = (at: number | null) => {
    replaceAt.current = at
    fileRef.current?.click()
  }
  const move = (from: number, to: number) =>
    update((prev) => {
      if (to < 0 || to >= prev.length) return prev
      const next = [...prev]
      next.splice(to, 0, ...next.splice(from, 1))
      return next
    })
  const addFromLibrary = (path: string) =>
    update((prev) => (prev.length >= MAX_MEDIA || prev.some((m) => m.path === path) ? prev : [...prev, { kind: 'photo', path, name: path.split('/').pop() ?? 'gorsel', size: 0 }]))

  return (
    <div className="flex flex-col gap-3">
      {media.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {media.map((m, i) => (
            <li key={`${m.path}-${i}`} className="flex flex-col gap-1 rounded-lg border border-border bg-background p-1">
              <div className="aspect-square overflow-hidden rounded-md">
                <MediaTile item={m} />
              </div>
              <span className="truncate px-1 text-xs text-muted-foreground">{`${i + 1}. ${MEDIA_KIND_LABEL[m.kind]}`}</span>
              {fixed ? (
                <button type="button" className={cn(btnGhost, 'gap-1.5')} disabled={busy} onClick={() => pickFiles(i)}>
                  <RefreshCw className="size-3.5" aria-hidden="true" />
                  Değiştir
                </button>
              ) : (
                <div className="flex gap-1">
                  <button type="button" className={iconButton} disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`${i + 1}. medyayı öne al`}>
                    <ArrowLeft className="size-4" aria-hidden="true" />
                  </button>
                  <button type="button" className={iconButton} disabled={i === media.length - 1} onClick={() => move(i, i + 1)} aria-label={`${i + 1}. medyayı arkaya al`}>
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={cn(iconButton, 'text-destructive')}
                    onClick={() => update((prev) => prev.filter((_, at) => at !== i))}
                    aria-label={`${i + 1}. medyayı çıkar`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        multiple={!fixed}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) handleFiles(files)
        }}
      />
      {!fixed && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={cn(btnGhost, 'gap-1.5')} disabled={busy || room <= 0} onClick={() => pickFiles(null)}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
            {busy ? 'Yükleniyor…' : 'Dosya yükle'}
          </button>
          {library.length > 0 && (
            <button type="button" className={cn(btnGhost, 'gap-1.5')} aria-expanded={picker} disabled={room <= 0} onClick={() => setPicker((open) => !open)}>
              <Images className="size-4" aria-hidden="true" />
              {picker ? 'Stüdyo görsellerini kapat' : 'Stüdyo görsellerinden seç'}
            </button>
          )}
          <span className="text-xs text-muted-foreground">{`${media.length} / ${MAX_MEDIA}`}</span>
        </div>
      )}
      {fixed && busy && (
        <p role="status" className="text-xs text-muted-foreground">
          Yükleniyor…
        </p>
      )}

      {picker && !fixed && (
        <ul className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto rounded-lg border border-border bg-background p-2 sm:grid-cols-5">
          {library.map((item) => {
            const added = media.some((m) => m.path === item.path)
            return (
              <li key={item.path}>
                <button
                  type="button"
                  disabled={added || room <= 0}
                  onClick={() => addFromLibrary(item.path)}
                  className={cn('block aspect-square w-full overflow-hidden rounded-md border-2', added ? 'border-primary opacity-60' : 'border-transparent hover:border-border')}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- private panel media served by an authenticated route */}
                  <img src={mediaUrl(item.path)} alt={`${item.label}${added ? ' (eklendi)' : ''}`} loading="lazy" className="size-full object-cover" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {errors.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 text-xs text-destructive">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        {fixed
          ? 'Gönderilmiş postta medya sayısı değişmez; her dosyayı yenisiyle değiştirebilirsin.'
          : 'Fotoğraf 10 MB, video, GIF ve dosya 49 MB’a kadar. Birden çok fotoğraf ya da video albüm olarak gider; GIF tek başına, dosyalar kendi aralarında gönderilir.'}
      </p>
    </div>
  )
}

// --- Buttons ---------------------------------------------------------------------

/** Takes the button out and puts it back at the given spot. A row before the first or past the last opens a new row. */
function placeIn(rows: PostButton[][], id: string, row: number, index: number): PostButton[][] {
  const from = rows.findIndex((r) => r.some((b) => b.id === id))
  if (from < 0) return rows
  const button = rows[from].find((b) => b.id === id)!
  const without = rows.map((r) => r.filter((b) => b.id !== id))
  if (row < 0) without.unshift([button])
  else if (row >= without.length) without.push([button])
  else {
    if (row !== from && without[row].length >= MAX_BUTTONS_PER_ROW) return rows
    without[row].splice(Math.min(index, without[row].length), 0, button)
  }
  const next = without.filter((r) => r.length > 0)
  return next.length > MAX_BUTTON_ROWS ? rows : next
}

const allowDrop = (e: DragEvent) => e.preventDefault()

/** Kinds whose value is a piece of text shown to a person, so it survives a switch between them. */
const TEXT_KINDS: PostButtonKind[] = ['popup', 'copy', 'member', 'raffle']

function switchKind(b: PostButton, to: PostButtonKind): Partial<PostButton> {
  const limit = BUTTON_KINDS.find((k) => k.kind === to)!.limit
  return {
    kind: to,
    value: TEXT_KINDS.includes(b.kind) && TEXT_KINDS.includes(to) ? b.value.slice(0, limit) : '',
    track: to === 'link',
    alt: to === 'member' ? '' : undefined,
    gate: to === 'raffle' ? false : undefined,
  }
}

function TextValue({ label, value, limit, placeholder, onChange }: { label: string; value: string; limit: number; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <label className={fieldLabel}>
      <span className="flex items-center justify-between gap-2">
        {label}
        <span className="shrink-0 tabular-nums">{`${value.length} / ${limit}`}</span>
      </span>
      <textarea className={cn(input, 'h-24 resize-y py-2 leading-relaxed')} value={value} maxLength={limit} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

const BOT_PARTS = /^https:\/\/t\.me\/([A-Za-z0-9_]*)(?:\?start=([A-Za-z0-9_-]*))?$/

function BotValue({ value, bots, onChange }: { value: string; bots: PostCenterData['bots']; onChange: (v: string) => void }) {
  const listId = useId()
  const [, username = '', start = ''] = BOT_PARTS.exec(value) ?? []
  const named = bots.filter((b) => b.username)
  return (
    <div className="flex flex-col gap-2">
      <label className={fieldLabel}>
        Gidilecek botun kullanıcı adı (@ olmadan)
        <input
          className={input}
          value={username}
          list={listId}
          placeholder="ornek_bot"
          autoCapitalize="none"
          spellCheck={false}
          onChange={(e) => {
            const next = e.target.value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 32)
            onChange(next ? botLink(next, start) : '')
          }}
        />
        <datalist id={listId}>
          {named.map((b) => (
            <option key={b.id} value={b.username}>
              {b.name}
            </option>
          ))}
        </datalist>
      </label>
      <label className={fieldLabel}>
        Başlangıç kodu (boş bırakabilirsin)
        <input
          className={input}
          value={start}
          disabled={!username}
          placeholder="Örn: post"
          autoCapitalize="none"
          spellCheck={false}
          onChange={(e) => onChange(botLink(username, e.target.value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64)))}
        />
      </label>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Kişi butona basınca botla özel sohbeti açılır ve “Başlat”a basar. Başlangıç kodu bota /start ile birlikte gider; hangi posttan gelindiğini ayırmak için kullanılır.
      </p>
    </div>
  )
}

function ButtonValue({ button: b, bots, patch }: { button: PostButton; bots: PostCenterData['bots']; patch: (change: Partial<PostButton>) => void }) {
  const kind = BUTTON_KINDS.find((k) => k.kind === b.kind)!
  const setValue = (value: string) => patch({ value })
  switch (b.kind) {
    case 'link':
      return (
        <>
          <label className={fieldLabel}>
            {kind.valueLabel}
            <input className={input} value={b.value} maxLength={kind.limit} inputMode="url" placeholder="https://…" onChange={(e) => setValue(e.target.value)} />
          </label>
          <Toggle
            label="Tıklamayı say"
            hint="Link önce siteden geçer, sonra adrese gider; kaç kişinin bastığı gönderilenler listesinde görünür. Telegram kanalı ya da t.me linklerinde kapat: açıkken link uygulama yerine tarayıcıda açılır."
            checked={b.track}
            onChange={(v) => patch({ track: v })}
          />
        </>
      )
    case 'copy':
      return (
        <label className={fieldLabel}>
          <span className="flex items-center justify-between gap-2">
            {kind.valueLabel}
            <span className="shrink-0 tabular-nums">{`${b.value.length} / ${kind.limit}`}</span>
          </span>
          <input className={input} value={b.value} maxLength={kind.limit} placeholder="Örn: KANKA50" onChange={(e) => setValue(e.target.value)} />
        </label>
      )
    case 'popup':
      return <TextValue label={kind.valueLabel} value={b.value} limit={kind.limit} onChange={setValue} />
    case 'member':
      return (
        <>
          <TextValue label={kind.valueLabel} value={b.value} limit={kind.limit} placeholder="Örn: Kodun KANKA50" onChange={setValue} />
          <TextValue label="Üye olmayanın göreceği yazı (boş bırakırsan aşağıdaki hazır yazı çıkar)" value={b.alt ?? ''} limit={kind.limit} placeholder={DEFAULT_ALT} onChange={(alt) => patch({ alt })} />
        </>
      )
    case 'raffle':
      return (
        <>
          <TextValue label={kind.valueLabel} value={b.value} limit={kind.limit} placeholder={DEFAULT_JOINED} onChange={setValue} />
          <Toggle
            label="Sadece üyeler katılabilsin"
            hint="Basan kişi postun durduğu kanala ya da gruba üye değilse çekilişe yazılmaz, önce katılması istenir."
            checked={Boolean(b.gate)}
            onChange={(gate) => patch({ gate })}
          />
        </>
      )
    case 'bot':
      return <BotValue value={b.value} bots={bots} onChange={setValue} />
    case 'vote':
      return null
  }
}

/** `listens`: the sending bot receives button presses, which the kinds it answers itself depend on. */
export function ButtonsField({
  rows,
  update,
  listens,
  listenHelp,
  bots,
}: {
  rows: PostButton[][]
  update: Update<PostButton[][]>
  listens: boolean
  listenHelp?: ReactNode
  bots: PostCenterData['bots']
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)

  const rowAt = rows.findIndex((r) => r.some((b) => b.id === selected))
  const colAt = rowAt < 0 ? -1 : rows[rowAt].findIndex((b) => b.id === selected)
  const current = rowAt < 0 ? null : rows[rowAt][colAt]
  const kind = current ? BUTTON_KINDS.find((k) => k.kind === current.kind)! : null

  const patch = (id: string, change: Partial<PostButton>) => update((prev) => prev.map((row) => row.map((b) => (b.id === id ? { ...b, ...change } : b))))
  const remove = (id: string) => update((prev) => prev.map((row) => row.filter((b) => b.id !== id)).filter((row) => row.length > 0))
  const place = (id: string, row: number, index: number) => update((prev) => placeIn(prev, id, row, index))
  const add = (row: number | 'new') => {
    const button: PostButton = { id: newButtonId(), kind: 'link', label: '', value: '', track: true }
    update((prev) => (row === 'new' ? [...prev, [button]] : prev.map((r, i) => (i === row ? [...r, button] : r))))
    setSelected(button.id)
  }
  /** Dropping on a button swaps places with it: it lands after a button it came from before, and before any other. */
  const dropOn = (id: string, targetId: string) =>
    update((prev) => {
      if (id === targetId) return prev
      const row = prev.findIndex((r) => r.some((b) => b.id === targetId))
      if (row < 0) return prev
      const cameFrom = prev[row].findIndex((b) => b.id === id)
      const targetAt = prev[row].findIndex((b) => b.id === targetId)
      const index = prev[row].filter((b) => b.id !== id).findIndex((b) => b.id === targetId) + (cameFrom >= 0 && cameFrom < targetAt ? 1 : 0)
      return placeIn(prev, id, row, index)
    })
  const drop = (e: DragEvent, run: (id: string) => void) => {
    e.preventDefault()
    e.stopPropagation()
    if (dragging) run(dragging)
    setDragging(null)
  }

  const alone = rowAt >= 0 && rows[rowAt].length === 1
  const moves = current
    ? [
        { label: 'Sola al', icon: ArrowLeft, off: colAt === 0, run: () => place(current.id, rowAt, colAt - 1) },
        { label: 'Sağa al', icon: ArrowRight, off: colAt === rows[rowAt].length - 1, run: () => place(current.id, rowAt, colAt + 1) },
        { label: 'Üst satıra al', icon: ArrowUp, off: rowAt === 0 && alone, run: () => place(current.id, rowAt - 1, MAX_BUTTONS_PER_ROW) },
        { label: 'Alt satıra al', icon: ArrowDown, off: rowAt === rows.length - 1 && alone, run: () => place(current.id, rowAt + 1, MAX_BUTTONS_PER_ROW) },
      ]
    : []

  return (
    <div className="flex flex-col gap-3">
      {rows.length > 0 && (
        <ol aria-label="Buton satırları" className="flex flex-col gap-2">
          {rows.map((row, r) => (
            <li
              key={r}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-2"
              onDragOver={allowDrop}
              onDrop={(e) => drop(e, (id) => place(id, r, MAX_BUTTONS_PER_ROW))}
            >
              <span className="shrink-0 text-xs text-muted-foreground">{`${r + 1}. satır`}</span>
              {row.map((b) => {
                const Icon = BUTTON_ICON[b.kind]
                return (
                  <button
                    key={b.id}
                    type="button"
                    draggable
                    aria-pressed={selected === b.id}
                    onClick={() => setSelected(selected === b.id ? null : b.id)}
                    onDragStart={(e) => {
                      setDragging(b.id)
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', b.id)
                    }}
                    onDragEnd={() => setDragging(null)}
                    onDragOver={allowDrop}
                    onDrop={(e) => drop(e, (id) => dropOn(id, b.id))}
                    className={cn(
                      'flex h-9 min-w-0 max-w-full cursor-grab items-center gap-1.5 rounded-lg border px-3 text-sm font-medium',
                      selected === b.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-card text-foreground hover:bg-muted',
                      dragging === b.id && 'opacity-50',
                    )}
                  >
                    <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="truncate">{b.label || 'Adsız buton'}</span>
                  </button>
                )
              })}
              {row.length < MAX_BUTTONS_PER_ROW && (
                <button type="button" className={iconButton} onClick={() => add(r)} aria-label={`${r + 1}. satıra buton ekle`} title="Bu satıra buton ekle">
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      {rows.length < MAX_BUTTON_ROWS && (
        <button
          type="button"
          className={cn(btnGhost, 'gap-1.5 self-start border-dashed')}
          onClick={() => add('new')}
          onDragOver={allowDrop}
          onDrop={(e) => drop(e, (id) => place(id, rows.length, 0))}
        >
          <Plus className="size-4" aria-hidden="true" />
          {rows.length ? 'Yeni satıra buton ekle' : 'Buton ekle'}
        </button>
      )}

      {current && kind && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">Seçili buton</span>
            <div className="flex flex-wrap gap-1">
              {moves.map((m) => (
                <button key={m.label} type="button" className={iconButton} disabled={m.off} onClick={m.run} aria-label={m.label} title={m.label}>
                  <m.icon className="size-4" aria-hidden="true" />
                </button>
              ))}
              <button type="button" className={cn(iconButton, 'text-destructive')} onClick={() => remove(current.id)} aria-label="Butonu sil" title="Butonu sil">
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="pb-1 text-xs text-muted-foreground">Basınca ne olsun</legend>
            <div className="flex flex-wrap gap-1">
              {BUTTON_KINDS.map((k) => {
                const Icon = BUTTON_ICON[k.kind]
                const on = current.kind === k.kind
                return (
                  <button
                    key={k.kind}
                    type="button"
                    aria-pressed={on}
                    onClick={() => on || patch(current.id, switchKind(current, k.kind))}
                    className={cn(
                      'flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium',
                      on ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-muted',
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                    {k.label}
                  </button>
                )
              })}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{kind.hint}</p>
          </fieldset>

          <label className={fieldLabel}>
            Butonun üstündeki yazı
            <input className={input} value={current.label} maxLength={LABEL_LIMIT} placeholder="Örn: Siteye git" onChange={(e) => patch(current.id, { label: e.target.value })} />
          </label>
          {(current.kind === 'vote' || current.kind === 'raffle') && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {`Telegram’da yazının yanında sayı durur: “${buttonText({ ...current, label: current.label || 'Buton' }, {})}”`}
            </p>
          )}
          <ButtonValue button={current} bots={bots} patch={(change) => patch(current.id, change)} />
          {PRESS_KINDS.includes(current.kind) && !listens && listenHelp}
        </div>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Butona basıp içeriğini doldur. Sıralamak için butonu sürükle ya da seçip ok düğmelerini kullan. Bir satırda en fazla {MAX_BUTTONS_PER_ROW} buton, en fazla{' '}
        {MAX_BUTTON_ROWS} satır olur.
      </p>
    </div>
  )
}

// --- Options ---------------------------------------------------------------------

const clampHours = (v: number, max: number) => (Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v))) : 0)

/** `sent` hides what Telegram fixes at send time (silent, protected, pin, timers). */
export function OptionsField({ options, set, sponsors, sent = false }: { options: PostOptions; set: (patch: Partial<PostOptions>) => void; sponsors: PostSponsor[]; sent?: boolean }) {
  const sponsor = sponsors.find((s) => s.id === options.sponsorId)
  return (
    <div className="flex flex-col gap-3">
      {!sent && (
        <>
          <Toggle label="Sessiz gönder" hint="Üyelere bildirim sesi gitmez." checked={options.silent} onChange={(v) => set({ silent: v })} />
          <Toggle
            label="İletmeyi ve kaydetmeyi kapat"
            hint="Post başka sohbete iletilemez, içindeki medya kaydedilemez. Gönderdikten sonra değiştirilemez."
            checked={options.protect}
            onChange={(v) => set({ protect: v })}
          />
          <Toggle label="Sabitle" hint="Post gönderilince sohbetin üstüne sabitlenir. Bot o sohbette yönetici olmalı." checked={options.pin} onChange={(v) => set({ pin: v, unpinHours: v ? options.unpinHours : 0 })} />
          {options.pin && (
            <NumberField label="Sabitten kendiliğinden kaldır (0 = sabit kalsın)" value={options.unpinHours} onChange={(v) => set({ unpinHours: clampHours(v, MAX_UNPIN_HOURS) })} suffix="saat sonra" />
          )}
          <NumberField
            label={`Postu kendiliğinden sil (0 = silinmesin, en çok ${MAX_DELETE_HOURS})`}
            value={options.deleteHours}
            onChange={(v) => set({ deleteHours: clampHours(v, MAX_DELETE_HOURS) })}
            suffix="saat sonra"
          />
          {(options.deleteHours > 0 || options.unpinHours > 0) && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Zamanlı işler sitedeki ziyaretçi trafiğiyle tetiklenir. Saatinde değil birkaç dakika sonra çalışabilir; sitede kimse yoksa ilk ziyarette çalışır.
            </p>
          )}
        </>
      )}
      <Toggle
        label="Link önizlemesi"
        hint="Yazıdaki ilk linkin kartı postun altında çıkar. Medyalı postta etkisi yoktur."
        checked={options.preview}
        onChange={(v) => set({ preview: v })}
      />
      <label className={fieldLabel}>
        Sponsor imzası
        <select className={input} value={sponsor ? options.sponsorId : ''} onChange={(e) => set({ sponsorId: e.target.value })}>
          <option value="">İmza ekleme</option>
          {sponsors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {sponsor && (
        <p
          className="text-xs leading-relaxed text-muted-foreground [&_a]:text-primary [&_a]:underline"
          onClickCapture={(e) => e.preventDefault()}
          // Built by signatureHtml from an escaped name and address.
          dangerouslySetInnerHTML={{ __html: `Yazının sonuna eklenir: ${signatureHtml(sponsor)}` }}
        />
      )}
    </div>
  )
}

// --- Targets ---------------------------------------------------------------------

export function TargetField({ targets, selected, onChange }: { targets: PostTarget[]; selected: string[]; onChange: (chatIds: string[]) => void }) {
  if (!targets.length) {
    return <p className="text-sm leading-relaxed text-muted-foreground">Bu botun kayıtlı hedefi yok. Aşağıdan kanal ya da grup ekle.</p>
  }
  return (
    <ul className="flex flex-col gap-1">
      {targets.map((t) => {
        const on = selected.includes(t.chatId)
        return (
          <li key={t.chatId}>
            <label className={cn('flex items-center gap-3 rounded-lg border p-3', on ? 'border-primary bg-primary/5' : 'border-border')}>
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={on}
                onChange={(e) => onChange(e.target.checked ? [...selected, t.chatId] : selected.filter((id) => id !== t.chatId))}
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-foreground">{t.title || t.chatId}</span>
                <span className="truncate text-xs text-muted-foreground">{t.chatId}</span>
              </span>
            </label>
          </li>
        )
      })}
    </ul>
  )
}

export function CheckList({ checks }: { checks: TargetCheck[] }) {
  if (!checks.length) return null
  return (
    <ul className="flex flex-col gap-1.5 rounded-lg border border-border bg-background p-3">
      {checks.map((c) => (
        <li key={c.chatId} className="flex items-start gap-2 text-xs leading-relaxed">
          {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />}
          <span className="min-w-0 [overflow-wrap:anywhere]">
            <span className="font-semibold text-foreground">{c.title}</span>
            <span className={c.ok ? 'text-muted-foreground' : 'text-destructive'}>{c.ok ? ' · bot buraya gönderebilir' : ` · ${c.problem ?? 'Gönderilemiyor'}`}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
