'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition, type DragEvent } from 'react'
import { FolderUp, ImagePlus, Link2, Loader2, Star, Tags, Trash2, Upload } from 'lucide-react'
import { deleteAssetAction, pinAssetAction, setAssetRoleAction } from '@/app/panel/studio-actions'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { ASSET_ROLES, bestAssets, foldName, MAX_REFERENCES, ROLE_LABELS, type AssetRole } from '@/lib/studio-refs'
import type { StudioAsset } from '@/lib/studio-types'
import { cn } from '@/lib/utils'

const input =
  'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'
const card = 'flex flex-col gap-4 rounded-2xl border border-border bg-card p-5'
const label = 'flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground'
const primaryBtn =
  'flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50'
const ghostBtn =
  'flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50'

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']
/** One request stays under the host's 4.5 MB body limit, so a whole game folder goes up in parts. */
const REQUEST_BYTES = 3.5 * 1024 * 1024
const REQUEST_FILES = 6
const SORT_PER_REQUEST = 8
const LONG_SIDE = 1536

/** A file too heavy for one request is shrunk in the browser to the size the server keeps anyway. */
async function fitted(file: File): Promise<File | null> {
  if (file.size <= REQUEST_BYTES) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, LONG_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    for (const [type, quality] of [['image/png', undefined], ['image/webp', 0.92]] as const) {
      const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, type, quality))
      if (blob && blob.size <= REQUEST_BYTES) return new File([blob], file.name, { type })
    }
  } catch {
    // Falls through: the file is reported as not added.
  }
  return null
}

function inParts(files: File[]): File[][] {
  const parts: File[][] = []
  let part: File[] = []
  let bytes = 0
  for (const file of files) {
    if (part.length && (part.length >= REQUEST_FILES || bytes + file.size > REQUEST_BYTES)) {
      parts.push(part)
      part = []
      bytes = 0
    }
    part.push(file)
    bytes += file.size
  }
  if (part.length) parts.push(part)
  return parts
}

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = []
  for (let at = 0; at < list.length; at += size) out.push(list.slice(at, at + size))
  return out
}

type Progress = { done: number; total: number; what: string }
type Filter = 'all' | 'none' | AssetRole
type Group = { provider: string; game: string; items: StudioAsset[] }

const lower = foldName

export function StudioLibrary({ assets }: { assets: StudioAsset[] }) {
  const router = useRouter()
  const [provider, setProvider] = useState('')
  const [game, setGame] = useState('')
  const [links, setLinks] = useState('')
  const [progress, setProgress] = useState<Progress | null>(null)
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [over, setOver] = useState(false)
  const busy = progress !== null

  const providers = useMemo(() => [...new Set(assets.map((a) => a.provider))], [assets])
  const groups = useMemo(() => {
    const byGame = new Map<string, Group>()
    for (const asset of assets) {
      const key = `${asset.provider}\u0000${asset.game}`
      const group = byGame.get(key) ?? { provider: asset.provider, game: asset.game, items: [] }
      group.items.push(asset)
      byGame.set(key, group)
    }
    return [...byGame.values()]
  }, [assets])
  const needle = lower(search.trim())
  const shown = needle ? groups.filter((g) => lower(`${g.provider} ${g.game}`).includes(needle)) : groups

  async function send(chosen: File[], urls: string[]) {
    if (!provider.trim()) return setMessage('Önce sağlayıcı adını yaz.')
    const images = chosen.filter((file) => IMAGE_TYPES.includes(file.type))
    const skipped = chosen.length - images.length
    if (!images.length && !urls.length) return setMessage('Seçilenlerin içinde görsel dosyası yok.')
    const total = images.length + urls.length
    setMessage('')
    setProgress({ done: 0, total, what: 'yükleniyor' })

    const failed: string[] = []
    const ready: File[] = []
    for (const file of images) {
      const fit = await fitted(file)
      if (fit) ready.push(fit)
      else failed.push(file.name)
    }
    const requests = [
      ...inParts(ready).map((files) => ({ files, urls: [] as string[] })),
      ...chunks(urls, REQUEST_FILES).map((part) => ({ files: [] as File[], urls: part })),
    ]
    let added = 0
    let unlabelled = 0
    let done = failed.length
    let stopped = ''
    for (const part of requests) {
      const names = [...part.files.map((file) => file.name), ...part.urls]
      const form = new FormData()
      form.set('provider', provider)
      form.set('game', game)
      if (part.urls.length) form.set('urls', part.urls.join('\n'))
      for (const file of part.files) form.append('file', file)
      try {
        const res = await fetch('/api/studio/upload', { method: 'POST', body: form })
        const data = (await res.json().catch(() => null)) as { pathnames?: string[]; failed?: string[]; unlabelled?: number; error?: string } | null
        if (res.status === 401) {
          stopped = data?.error ?? 'Oturum süresi doldu, tekrar giriş yap.'
          break
        }
        added += data?.pathnames?.length ?? 0
        unlabelled += data?.unlabelled ?? 0
        failed.push(...(data?.failed ?? (res.ok ? [] : names)))
      } catch {
        failed.push(...names)
      }
      done += names.length
      setProgress({ done, total, what: 'yükleniyor' })
    }

    setProgress(null)
    setLinks('')
    setMessage(
      [
        stopped,
        `${added} görsel eklendi.`,
        failed.length ? `Eklenemeyen ${failed.length}: ${failed.slice(0, 5).join(', ')}${failed.length > 5 ? ' ...' : ''}` : '',
        unlabelled ? `${unlabelled} görselin türü belirlenemedi; oyunun satırındaki "Etiketle" düğmesiyle tamamlanır.` : '',
        skipped ? `${skipped} dosya görsel olmadığı için atlandı.` : '',
        added && !game.trim() ? 'Oyun adı yazılmadığı için bu görseller otomatik seçime girmez.' : '',
      ]
        .filter(Boolean)
        .join(' '),
    )
    router.refresh()
  }

  async function labelRest(ids: number[]) {
    setMessage('')
    setProgress({ done: 0, total: ids.length, what: 'etiketleniyor' })
    let labelled = 0
    let done = 0
    for (const part of chunks(ids, SORT_PER_REQUEST)) {
      try {
        const res = await fetch('/api/studio/sort', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: part }) })
        const data = (await res.json().catch(() => null)) as { done?: number } | null
        labelled += data?.done ?? 0
      } catch {
        // Counted as not labelled below.
      }
      done += part.length
      setProgress({ done, total: ids.length, what: 'etiketleniyor' })
    }
    setProgress(null)
    setMessage(
      labelled < ids.length
        ? `${labelled} görsel etiketlendi, ${ids.length - labelled} görsel etiketlenemedi (aylık harcama sınırı dolmuş ya da model yanıt vermemiş olabilir).`
        : `${labelled} görsel etiketlendi.`,
    )
    router.refresh()
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setOver(false)
    if (!busy) void send(Array.from(event.dataTransfer.files), [])
  }

  const filters: { id: Filter; name: string }[] = [
    { id: 'all', name: 'Hepsi' },
    ...ASSET_ROLES.map((role) => ({ id: role as Filter, name: ROLE_LABELS[role] })),
    { id: 'none', name: 'Etiketsiz' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className={card}>
        <div className="flex items-center gap-2">
          <ImagePlus className="size-5 text-primary" aria-hidden />
          <h2 className="font-display text-xl font-bold uppercase text-foreground">Görsel ekle</h2>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Sağlayıcı portalından indirdiğin oyun klasörünü olduğu gibi ekle. Her görselin ne olduğu (karakter, oyun logosu, arka plan, sembol) eklenirken
          belirlenir; üretimde oyunun adını yazdığında en iyi {MAX_REFERENCES} görsel kendiliğinden seçilir.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className={label}>
            Sağlayıcı
            <input value={provider} onChange={(e) => setProvider(e.target.value)} list="studio-providers" placeholder="Pragmatic Play" className={input} />
            <datalist id="studio-providers">
              {providers.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </label>
          <label className={label}>
            Oyun adı (otomatik seçim bu adla çalışır)
            <input value={game} onChange={(e) => setGame(e.target.value)} placeholder="Big Bass Halloween Splash 1000" className={input} />
          </label>
        </div>
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={drop}
          className={cn('flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-5 text-center', over ? 'border-primary bg-secondary' : 'border-border')}
        >
          <p className="text-sm text-muted-foreground">Görselleri buraya sürükle ya da seç. Sayı sınırı yok; parça parça yüklenir.</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <label className={cn(primaryBtn, 'cursor-pointer', busy && 'pointer-events-none opacity-50')}>
              <Upload className="size-4" aria-hidden />
              Dosyaları seç
              <input
                type="file"
                multiple
                disabled={busy}
                accept={IMAGE_TYPES.join(',')}
                className="sr-only"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  e.target.value = ''
                  if (files.length) void send(files, [])
                }}
              />
            </label>
            <label className={cn(ghostBtn, 'cursor-pointer py-2.5', busy && 'pointer-events-none opacity-50')}>
              <FolderUp className="size-4" aria-hidden />
              Klasör seç
              <input
                type="file"
                multiple
                disabled={busy}
                className="sr-only"
                {...{ webkitdirectory: '' }}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  e.target.value = ''
                  if (files.length) void send(files, [])
                }}
              />
            </label>
          </div>
        </div>
        <label className={label}>
          <span className="flex items-center gap-1.5">
            <Link2 className="size-3.5" aria-hidden /> Veya görsel linklerini yapıştır (her satıra bir link)
          </span>
          <textarea
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            rows={3}
            placeholder="https://.../big-bass-character.png"
            className={cn(input, 'resize-y font-mono text-xs')}
          />
        </label>
        <button
          type="button"
          disabled={busy || !links.trim()}
          onClick={() => void send([], links.split(/\s+/).filter((u) => /^https?:\/\//i.test(u)))}
          className={cn(ghostBtn, 'self-start')}
        >
          <Link2 className="size-3.5" aria-hidden />
          Linklerden ekle
        </button>
        <div role="status" className="text-sm text-muted-foreground">
          {progress ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {`${progress.done} / ${progress.total} ${progress.what}`}
            </span>
          ) : (
            message
          )}
        </div>
      </div>

      {groups.length ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-semibold',
                  filter === f.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-secondary',
                )}
              >
                {f.name}
              </button>
            ))}
          </div>
          {groups.length > 4 ? (
            <label className={label}>
              <span className="sr-only">Oyun ya da sağlayıcı ara</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Oyun ya da sağlayıcı ara" className={input} />
            </label>
          ) : null}
        </div>
      ) : null}

      {providers.map((p) => {
        const games = shown.filter((g) => g.provider === p)
        if (!games.length) return null
        return (
          <section key={p} className="flex flex-col gap-3">
            <h3 className="font-display text-lg font-bold uppercase text-foreground">{p}</h3>
            {games.map((group) => (
              <GameShelf key={`${group.provider}/${group.game}`} group={group} filter={filter} open={groups.length === 1} busy={busy} onLabel={labelRest} />
            ))}
          </section>
        )
      })}
    </div>
  )
}

function GameShelf({ group, filter, open, busy, onLabel }: { group: Group; filter: Filter; open: boolean; busy: boolean; onLabel: (ids: number[]) => void }) {
  const auto = group.game ? bestAssets(group.game, group.items, 'banner') : []
  const waiting = group.items.filter((a) => !a.role)
  const items = filter === 'all' ? group.items : group.items.filter((a) => (filter === 'none' ? !a.role : a.role === filter))

  return (
    <details open={open} className="rounded-2xl border border-border bg-card">
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-4">
        <span className="text-sm font-bold text-foreground">{group.game || 'Oyun adı yazılmamış'}</span>
        <span className="text-xs text-muted-foreground">
          {`${group.items.length} görsel`}
          {group.game ? (auto.length ? ` · ${auto.length} tanesi otomatik seçilir` : ' · otomatik seçilecek görsel yok') : ' · otomatik seçime girmez'}
          {waiting.length ? ` · ${waiting.length} etiketsiz` : ''}
        </span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-border p-4">
        {waiting.length ? (
          <button type="button" disabled={busy} onClick={() => onLabel(waiting.map((a) => a.id))} className={cn(ghostBtn, 'self-start')}>
            <Tags className="size-3.5" aria-hidden />
            {`${waiting.length} etiketsiz görseli etiketle`}
          </button>
        ) : null}
        {items.length ? (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3">
            {items.map((asset) => (
              <AssetCard key={asset.id} asset={asset} auto={auto.includes(asset.id)} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Bu türde görsel yok.</p>
        )}
      </div>
    </details>
  )
}

function AssetCard({ asset, auto }: { asset: StudioAsset; auto: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = (work: () => Promise<unknown>) =>
    start(async () => {
      await work()
      router.refresh()
    })

  return (
    <li className={cn('flex flex-col overflow-hidden rounded-xl border-2 bg-secondary', auto ? 'border-primary' : 'border-border', pending && 'opacity-60')}>
      <div className="relative">
        <img
          src={asset.url || '/placeholder.svg'}
          alt={asset.note || `${asset.game} ${asset.role ? ROLE_LABELS[asset.role] : 'görseli'}`}
          loading="lazy"
          className="aspect-square w-full object-contain p-1"
        />
        {auto ? (
          <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-xs font-bold text-primary-foreground">Otomatik</span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5 bg-card p-1.5">
        <select
          aria-label="Görselin türü"
          value={asset.role}
          disabled={pending}
          onChange={(e) => run(() => setAssetRoleAction(asset.id, e.target.value))}
          className="w-full rounded-md border border-input bg-background px-1.5 py-1 text-xs font-semibold text-foreground"
        >
          {asset.role ? null : <option value="">Etiketsiz</option>}
          {ASSET_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        <p className="line-clamp-2 min-h-8 px-0.5 text-xs leading-4 text-muted-foreground" title={asset.note}>
          {asset.role ? asset.note || 'Elle etiketlendi' : 'Türü belirlenmedi'}
        </p>
      </div>
      <div className="flex items-center gap-1 bg-card px-1.5 pb-1.5">
        <span className="flex-1 whitespace-nowrap px-0.5 text-xs font-semibold text-muted-foreground">
          {asset.role ? (
            <>
              <span className="sr-only">Puan </span>
              {`${asset.score}/10`}
            </>
          ) : null}
        </span>
        <button
          type="button"
          aria-pressed={asset.pinned}
          aria-label={asset.pinned ? 'Sabitlemeyi kaldır' : 'Bu oyun yazıldığında önce bunu kullan'}
          title={asset.pinned ? 'Sabitlemeyi kaldır' : 'Bu oyun yazıldığında önce bunu kullan'}
          disabled={pending || !asset.role}
          onClick={() => run(() => pinAssetAction(asset.id, !asset.pinned))}
          className={cn('rounded-md p-1 disabled:opacity-40', asset.pinned ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
        >
          <Star className="size-4" fill={asset.pinned ? 'currentColor' : 'none'} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Görseli sil"
          disabled={pending}
          onClick={() =>
            void askConfirm('Bu görsel kütüphaneden kalıcı olarak silinsin mi? Geri alınamaz.').then((ok) => ok && run(() => deleteAssetAction(asset.id)))
          }
          className="rounded-md p-1 text-destructive disabled:opacity-40"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
    </li>
  )
}

/** The game's pictures a job will start from on its own, shown in the form before anything is drawn. */
export function AutoReferences({
  assets,
  ids,
  on,
  onToggle,
  onEdit,
}: {
  assets: StudioAsset[]
  ids: number[]
  on: boolean
  onToggle: (on: boolean) => void
  onEdit: () => void
}) {
  const items = ids.flatMap((id) => assets.find((a) => a.id === id) ?? [])
  if (!items.length) return null
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
      <p className="text-xs font-semibold text-foreground">
        {on ? `${items[0].game}: kütüphaneden ${items.length} görsel kendiliğinden kullanılacak` : `${items[0].game} görselleri bu üretimde kullanılmayacak`}
      </p>
      {on ? (
        <ul className="flex flex-wrap gap-2">
          {items.map((asset) => (
            <li key={asset.id} className="flex w-20 flex-col gap-1">
              <img src={asset.url || '/placeholder.svg'} alt={asset.note || asset.game} className="aspect-square w-full rounded-lg border border-border bg-secondary object-contain p-1" />
              <span className="text-xs text-muted-foreground">{asset.role ? ROLE_LABELS[asset.role] : ''}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {on ? (
          <button type="button" onClick={onEdit} className={ghostBtn}>
            Kendim seçeyim
          </button>
        ) : null}
        <button type="button" onClick={() => onToggle(!on)} className={ghostBtn}>
          {on ? 'Kullanma' : 'Kullan'}
        </button>
      </div>
    </div>
  )
}

const PICKER_SHOWN = 80

export function ReferencePicker({ assets, picked, onPicked }: { assets: StudioAsset[]; picked: number[]; onPicked: (next: number[]) => void }) {
  const [query, setQuery] = useState('')
  const needle = lower(query.trim())
  const matching = needle ? assets.filter((a) => lower(`${a.provider} ${a.game}`).includes(needle)) : assets
  const shown = [...assets.filter((a) => picked.includes(a.id)), ...matching.filter((a) => !picked.includes(a.id))].slice(0, PICKER_SHOWN)

  return (
    <details className="rounded-xl border border-border p-3">
      <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
        Referans görseli elle seç ({picked.length}/{MAX_REFERENCES})
      </summary>
      <div className="mt-3 flex flex-col gap-2">
        <label className={label}>
          <span className="sr-only">Oyun ya da sağlayıcı ara</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Oyun ya da sağlayıcı ara" className={input} />
        </label>
        <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto">
          {shown.map((a) => {
            const on = picked.includes(a.id)
            const name = `${a.provider} ${a.game}${a.role ? ` · ${ROLE_LABELS[a.role]}` : ''}`
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={on}
                title={name}
                onClick={() => onPicked(on ? picked.filter((x) => x !== a.id) : picked.length < MAX_REFERENCES ? [...picked, a.id] : picked)}
                className={cn('overflow-hidden rounded-lg border-2 bg-secondary', on ? 'border-primary' : 'border-transparent')}
              >
                <img src={a.url || '/placeholder.svg'} alt={name} loading="lazy" className="aspect-square w-full object-contain" />
              </button>
            )
          })}
        </div>
        {matching.length > shown.length ? <p className="text-xs text-muted-foreground">Daha fazlası var; oyun adını yazarak daralt.</p> : null}
      </div>
    </details>
  )
}
