'use client'


import { askConfirm } from '@/components/panel/confirm-dialog'
import { useState, useTransition } from 'react'
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { deleteStaffAccount, resetAccountTotp, saveStaffAccount, type StaffInput } from '@/app/panel/auth-actions'
import { PANEL_GROUPS } from '@/lib/panel-modules'
import { cn } from '@/lib/utils'

export type StaffRow = {
  id: number
  username: string
  displayName: string
  isOwner: boolean
  permissions: string[]
  totpEnabled: boolean
  totpRequired: boolean
  active: boolean
  lastLoginAt: string | null
}

const field = 'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-primary'
const EMPTY: StaffInput = { username: '', displayName: '', password: '', permissions: [], totpRequired: true, active: true }

function formatDate(value: string | null) {
  if (!value) return 'Hiç giriş yapmadı'
  return new Date(value).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Istanbul' })
}

export function StaffManager({ accounts }: { accounts: StaffRow[] }) {
  const [editing, setEditing] = useState<StaffInput | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  function act(fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>, after?: () => void) {
    start(async () => {
      const res = await fn()
      setMsg(res.ok ? { ok: true, text: res.message ?? 'Kaydedildi.' } : { ok: false, text: res.error })
      if (res.ok) after?.()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
        Personel hesabı aç, her hesaba sadece göreceği bölümleri işaretle. Yetkisi olmayan bölüm menüde görünmez ve sunucu da o bölümün işlemlerini reddeder.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing({ ...EMPTY })}
          className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="size-4" aria-hidden="true" />
          Yeni personel
        </button>
        {msg && (
          <p className={cn('text-sm', msg.ok ? 'text-success' : 'text-destructive')} aria-live="polite">
            {msg.text}
          </p>
        )}
      </div>
      {editing && (
        <StaffForm
          key={editing.id ?? 'new'}
          value={editing}
          pending={pending}
          onCancel={() => setEditing(null)}
          onSave={(input) => act(() => saveStaffAccount(input), () => setEditing(null))}
        />
      )}
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
        {accounts.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <div className={cn('flex min-w-0 flex-1 flex-col', !a.active && 'opacity-50')}>
              <span className="font-medium text-foreground">
                {a.displayName || a.username}
                <span className="ml-2 font-normal text-muted-foreground">@{a.username}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {a.isOwner ? 'Ana yönetici, tüm bölümler' : `${a.permissions.length} bölüm`} · Son giriş: {formatDate(a.lastLoginAt)}
              </span>
            </div>
            <span
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold',
                a.totpEnabled ? 'bg-success/15 text-success' : 'bg-secondary text-muted-foreground',
              )}
            >
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              {a.totpEnabled ? '2FA açık' : a.totpRequired ? '2FA zorunlu, kurulmadı' : '2FA kapalı'}
            </span>
            {!a.active && <span className="text-xs font-bold uppercase text-muted-foreground">Pasif</span>}
            {!a.isOwner && (
              <div className="flex items-center gap-1">
                {a.totpEnabled && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      void askConfirm(`${a.username} için 2FA sıfırlansın mı? Hesap bir sonraki girişte yeniden kurar.`).then((ok) => {
      if (ok) act(() => resetAccountTotp(a.id))
    })
  }}
                    className="rounded-md px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    2FA sıfırla
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`${a.username} düzenle`}
                  onClick={() =>
                    setEditing({
                      id: a.id,
                      username: a.username,
                      displayName: a.displayName,
                      password: '',
                      permissions: a.permissions,
                      totpRequired: a.totpRequired,
                      active: a.active,
                    })
                  }
                  className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`${a.username} sil`}
                  disabled={pending}
                  onClick={() => {
                    void askConfirm(`${a.username} hesabı silinsin mi?`).then((ok) => {
      if (ok) act(() => deleteStaffAccount(a.id))
    })
  }}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function StaffForm({
  value,
  pending,
  onSave,
  onCancel,
}: {
  value: StaffInput
  pending: boolean
  onSave: (value: StaffInput) => void
  onCancel: () => void
}) {
  const [v, setV] = useState(value)
  const toggle = (id: string) =>
    setV((prev) => ({ ...prev, permissions: prev.permissions.includes(id) ? prev.permissions.filter((p) => p !== id) : [...prev.permissions, id] }))
  const toggleGroup = (ids: string[]) =>
    setV((prev) => {
      const all = ids.every((id) => prev.permissions.includes(id))
      return { ...prev, permissions: all ? prev.permissions.filter((p) => !ids.includes(p)) : [...new Set([...prev.permissions, ...ids])] }
    })
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSave(v)
      }}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
          Kullanıcı adı
          <input
            className={field}
            value={v.username}
            disabled={Boolean(v.id)}
            onChange={(e) => setV({ ...v, username: e.target.value })}
            placeholder="ornek.mod"
            autoComplete="off"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
          Görünen ad
          <input className={field} value={v.displayName} onChange={(e) => setV({ ...v, displayName: e.target.value })} placeholder="Ahmet (Moderatör)" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
          {v.id ? 'Yeni şifre (boş bırak = değişmez)' : 'Şifre (en az 10 karakter)'}
          <input
            className={field}
            type="password"
            value={v.password ?? ''}
            onChange={(e) => setV({ ...v, password: e.target.value })}
            autoComplete="new-password"
            minLength={v.id && !v.password ? undefined : 10}
            required={!v.id}
          />
        </label>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-semibold text-foreground">Görebileceği bölümler</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PANEL_GROUPS.map((g) => {
            const ids = g.modules.map((m) => m.id as string)
            const all = ids.every((id) => v.permissions.includes(id))
            return (
              <div key={g.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                  <input type="checkbox" checked={all} onChange={() => toggleGroup(ids)} className="accent-primary" />
                  {g.label}
                </label>
                {g.modules.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" checked={v.permissions.includes(m.id)} onChange={() => toggle(m.id)} className="accent-primary" />
                    {m.label}
                  </label>
                ))}
              </div>
            )
          })}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={v.totpRequired} onChange={(e) => setV({ ...v, totpRequired: e.target.checked })} className="accent-primary" />
          İki adımlı doğrulama (Google Authenticator) zorunlu
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} className="accent-primary" />
          Hesap aktif
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {pending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <button type="button" onClick={onCancel} className="h-10 rounded-lg border border-border px-4 text-sm text-foreground hover:bg-secondary">
          Vazgeç
        </button>
      </div>
    </form>
  )
}
