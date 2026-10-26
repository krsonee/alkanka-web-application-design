'use client'


import { askConfirm } from '@/components/panel/confirm-dialog'
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import { deleteAvatarAction, saveAvatarAction } from '@/app/panel/avatar-actions'
import { AVATAR_GROUPS, type AvatarDef, type AvatarGroup, type AvatarUnlock, type CoverDef } from '@/lib/avatars-shared'
import { cn } from '@/lib/utils'

type Stats = Record<string, { users: number; sold: number }>
type Draft = { id: string | null; name: string; src: string; group: AvatarGroup; unlock: AvatarUnlock; level: number; price: number; active: boolean; sort: number }
type Msg = { ok: boolean; text: string } | null

const EMPTY: Draft = { id: null, name: '', src: '', group: 'jako', unlock: 'free', level: 2, price: 500, active: true, sort: 100 }
const UNLOCK_LABEL: Record<AvatarUnlock, string> = { free: 'Ücretsiz', level: 'Seviye ile', coin: 'KC ile satın al' }

const field = 'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground'

export function AvatarManager({ avatars, stats, covers, coverUsage }: { avatars: AvatarDef[]; stats: Stats; covers: CoverDef[]; coverUsage: Record<string, number> }) {
  const router = useRouter()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [msg, setMsg] = useState<Msg>(null)
  const [pending, start] = useTransition()
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const totalSold = Object.values(stats).reduce((s, v) => s + v.sold, 0)
  const totalUsers = Object.values(stats).reduce((s, v) => s + v.users, 0)

  function edit(a: AvatarDef) {
    setMsg(null)
    setDraft({ id: a.id, name: a.name, src: a.src, group: a.group, unlock: a.unlock, level: a.level, price: a.price || 500, active: a.active, sort: a.sort })
  }

  async function upload(file: File) {
    setUploading(true)
    setMsg(null)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('id', `avatar-${Date.now().toString(36)}`)
      const res = await fetch('/api/logo-upload', { method: 'POST', body })
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Yükleme başarısız oldu.')
      setDraft((d) => (d ? { ...d, src: data.url! } : d))
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Yükleme başarısız oldu.' })
    } finally {
      setUploading(false)
    }
  }

  function run(p: Promise<{ ok: true; message: string } | { ok: false; error: string }>, close = false) {
    start(async () => {
      const r = await p
      setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error })
      if (r.ok) {
        if (close) setDraft(null)
        router.refresh()
      }
    })
  }

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-4 md:p-5" aria-labelledby="avatar-manager-title">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="avatar-manager-title" className="font-display text-lg font-bold text-foreground">Avatarlar & kapaklar</h2>
          <p className="text-sm text-muted-foreground">
            {avatars.length} avatar · {totalUsers} üye kullanıyor · {totalSold} satış
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setMsg(null)
            setDraft({ ...EMPTY })
          }}
          className="ml-auto flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-bold text-primary-foreground"
        >
          <Plus className="size-4" aria-hidden />
          Yeni avatar
        </button>
      </header>

      {msg && (
        <p role="status" className={cn('rounded-lg px-3 py-2 text-sm', msg.ok ? 'bg-primary/10 text-foreground' : 'bg-destructive/10 text-destructive')}>
          {msg.text}
        </p>
      )}

      {draft && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            run(saveAvatarAction({ ...draft, id: draft.id }), true)
          }}
          className="flex flex-col gap-4 rounded-xl border border-primary/30 bg-background p-4"
        >
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-foreground">{draft.id ? 'Avatarı düzenle' : 'Yeni avatar'}</h3>
            <button type="button" onClick={() => setDraft(null)} className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:text-foreground" aria-label="Formu kapat">
              <X className="size-4" />
            </button>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex shrink-0 flex-col items-center gap-2">
              <div className="flex size-24 items-center justify-center overflow-hidden rounded-full border-2 border-gold bg-secondary">
                {draft.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.src} alt="Önizleme" className="size-full object-cover" />
                ) : (
                  <span className="text-xs text-muted-foreground">Görsel yok</span>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold text-foreground disabled:opacity-60"
              >
                <Upload className="size-3.5" aria-hidden />
                {uploading ? 'Yükleniyor...' : 'Görsel yükle'}
              </button>
            </div>

            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                Ad
                <input required maxLength={40} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={field} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                Grup
                <select value={draft.group} onChange={(e) => setDraft({ ...draft, group: e.target.value as AvatarGroup })} className={field}>
                  {Object.entries(AVATAR_GROUPS).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground sm:col-span-2">
                Görsel adresi
                <input required value={draft.src} onChange={(e) => setDraft({ ...draft, src: e.target.value })} placeholder="/images/... veya https://..." className={field} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                Kilit türü
                <select value={draft.unlock} onChange={(e) => setDraft({ ...draft, unlock: e.target.value as AvatarUnlock })} className={field}>
                  {(Object.keys(UNLOCK_LABEL) as AvatarUnlock[]).map((u) => (
                    <option key={u} value={u}>
                      {UNLOCK_LABEL[u]}
                    </option>
                  ))}
                </select>
              </label>
              {draft.unlock === 'level' && (
                <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                  Gereken seviye
                  <input type="number" min={1} max={100} value={draft.level} onChange={(e) => setDraft({ ...draft, level: Number(e.target.value) })} className={field} />
                </label>
              )}
              {draft.unlock === 'coin' && (
                <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                  Fiyat (KC)
                  <input type="number" min={1} value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} className={field} />
                </label>
              )}
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                Sıra
                <input type="number" value={draft.sort} onChange={(e) => setDraft({ ...draft, sort: Number(e.target.value) })} className={field} />
              </label>
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-foreground">
                <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="size-4 accent-primary" />
                Üyelere görünsün
              </label>
            </div>
          </div>

          <button type="submit" disabled={pending || uploading} className="h-10 self-end rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60">
            {pending ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </form>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {avatars.map((a) => {
          const s = stats[a.id] ?? { users: 0, sold: 0 }
          return (
            <li key={a.id} className={cn('flex flex-col gap-2 rounded-xl border border-border bg-background p-3', !a.active && 'opacity-55')}>
              <div className="relative mx-auto size-16 overflow-hidden rounded-full border border-border bg-secondary">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.src} alt={a.name} loading="lazy" className="size-full object-cover" />
              </div>
              <div className="flex flex-col items-center gap-0.5 text-center">
                <p className="line-clamp-1 text-sm font-bold text-foreground">{a.name}</p>
                <p className="text-xs text-muted-foreground">
                  {a.unlock === 'free' ? 'Ücretsiz' : a.unlock === 'level' ? `Seviye ${a.level}` : `${a.price.toLocaleString('tr-TR')} KC`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.users} kullanıyor{a.unlock === 'coin' ? ` · ${s.sold} satış` : ''}
                </p>
              </div>
              <div className="mt-auto flex justify-center gap-1">
                <button type="button" onClick={() => edit(a)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label={`${a.name} düzenle`}>
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(saveAvatarAction({ ...a, active: !a.active }))}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label={a.active ? `${a.name} gizle` : `${a.name} göster`}
                >
                  {a.active ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void askConfirm(`${a.name} silinsin mi?`).then((ok) => ok && run(deleteAvatarAction(a.id)))}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`${a.name} sil`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <h3 className="font-bold text-foreground">Profil kapakları</h3>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {covers.map((c) => (
            <li key={c.id} className="flex flex-col overflow-hidden rounded-xl border border-border bg-background">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.src} alt={c.name} loading="lazy" className="aspect-[3/1] w-full object-cover" />
              <div className="flex flex-col gap-0.5 p-2.5">
                <p className="text-sm font-bold text-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  Seviye {c.level} · {coverUsage[c.id] ?? 0} üye
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
