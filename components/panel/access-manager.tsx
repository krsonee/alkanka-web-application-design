'use client'

import { useState, useTransition } from 'react'
import { Award, DoorClosed, DoorOpen, Pencil, ShieldCheck, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { deleteRoleAction, saveRoleAction, signupGateAction } from '@/app/panel/members-actions'
import { ICONS, RoleChip } from '@/components/alkanka/kp/emblem'
import { BADGE_ICONS, NO_ROLE_LIMITS, ROLE_LIMITS, ROLE_STAFF_HINT, ROLE_STYLES, roleSummary } from '@/lib/kanka-puan-shared'
import type { RoleDef } from '@/lib/kanka-puan'
import type { SignupGate } from '@/lib/signup-gate'

type Result = { ok: true; message: string } | { ok: false; error: string }
type Msg = { ok: boolean; text: string } | null

const input = 'rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary'
const card = 'flex flex-col gap-3 rounded-xl border border-border bg-card p-4'
const toMsg = (r: Result): Msg => (r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error })
const clock = (iso: string) =>
  new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

const ICON_LABELS: Record<string, string> = {
  award: 'Ödül', trophy: 'Kupa', crown: 'Taç', target: 'Hedef', eye: 'Göz', message: 'Mesaj', feather: 'Tüy', flame: 'Alev',
  gem: 'Mücevher', medal: 'Madalya', shield: 'Kalkan', star: 'Yıldız', swords: 'Kılıç', zap: 'Şimşek', heart: 'Kalp', rocket: 'Roket',
}

const DURATIONS = [
  { value: '1', label: '1 saat' },
  { value: '3', label: '3 saat' },
  { value: '24', label: '24 saat' },
  { value: '0', label: 'Süresiz' },
]

export function AccessManager({ gate, roles, canRoles }: { gate: SignupGate; roles: RoleDef[]; canRoles: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SignupCard gate={gate} />
      <RolesCard roles={roles} canRoles={canRoles} />
    </div>
  )
}

function Note({ msg }: { msg: Msg }) {
  if (!msg) return null
  return (
    <p role="status" className={cn('rounded-lg px-3 py-2 text-sm', msg.ok ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive')}>
      {msg.text}
    </p>
  )
}

function SignupCard({ gate }: { gate: SignupGate }) {
  const [busy, start] = useTransition()
  const [hours, setHours] = useState('3')
  const [slots, setSlots] = useState('2')
  const [msg, setMsg] = useState<Msg>(null)
  const open = !gate.closed
  const timed = hours !== '0'

  const run = (next: boolean) =>
    start(async () => {
      setMsg(toMsg(await signupGateAction(next, Number(hours), timed ? Number(slots) : 0)))
    })

  return (
    <section className={card} aria-labelledby="signup-gate-title">
      <h3 id="signup-gate-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className={open ? 'text-primary' : 'text-muted-foreground'}>
          {open ? <DoorOpen className="size-4" aria-hidden="true" /> : <DoorClosed className="size-4" aria-hidden="true" />}
        </span>
        Yeni üyelik
        <span className={cn('ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold', open ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground')}>
          {open ? 'Açık' : 'Kapalı'}
        </span>
      </h3>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {!open
          ? 'Şu an kimse kayıt olamıyor. Kısa süreliğine açarsan süre dolunca ya da belirlediğin kayıt sayısına ulaşınca kendiliğinden kapanır.'
          : gate.openUntil
            ? `${clock(gate.openUntil)} saatinde kendiliğinden kapanır${gate.slots ? `; ${gate.slots} kayıt dolunca da kapanır (şu an ${gate.used}/${gate.slots})` : ''}.`
            : 'Süresiz açık. Sen kapatana kadar herkes kayıt olabilir.'}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Açık kalma süresi
          <select value={hours} onChange={(e) => setHours(e.target.value)} className={input}>
            {DURATIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        {timed && (
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Kaç kayıtta kapansın
            <input
              inputMode="numeric"
              value={slots}
              onChange={(e) => setSlots(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Sınırsız"
              className={cn(input, 'w-32')}
            />
          </label>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => run(true)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          {open ? 'Süreyi yenile' : 'Üyeliği aç'}
        </button>
        {open && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(false)}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-40"
          >
            Şimdi kapat
          </button>
        )}
      </div>
      <Note msg={msg} />
    </section>
  )
}

function RoleBox({ checked, onChange, label, hint }: { checked: boolean; onChange: (on: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex items-start gap-2 text-sm text-foreground">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary" />
      <span className="flex flex-col gap-0.5">
        {label}
        <span className="text-xs leading-relaxed text-muted-foreground">{hint}</span>
      </span>
    </label>
  )
}

const EMPTY = { id: '', name: '', style: 'moderator', icon: 'shield', staff: false, limits: NO_ROLE_LIMITS }

function RolesCard({ roles, canRoles }: { roles: RoleDef[]; canRoles: boolean }) {
  const [busy, start] = useTransition()
  const [form, setForm] = useState(EMPTY)
  const [msg, setMsg] = useState<Msg>(null)

  const run = (fn: () => Promise<Result>, reset = true) =>
    start(async () => {
      const r = await fn()
      setMsg(toMsg(r))
      if (r.ok && reset) setForm(EMPTY)
    })

  return (
    <section className={card} aria-labelledby="roles-title">
      <h3 id="roles-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="text-primary">
          <ShieldCheck className="size-4" aria-hidden="true" />
        </span>
        Roller ve özel yetkiler
      </h3>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Rol, üyenin adının yanında sohbette ve sitede seviye yerine kendi rengiyle görünür. Rolü vermek için aşağıdaki listeden üyeyi aç, &quot;Hediye ve rozet&quot; sekmesindeki
        &quot;Rol ver&quot; kartını kullan.
      </p>
      <ul className="flex flex-col gap-2">
        {roles.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-background px-3 py-2">
            <RoleChip name={r.name} style={r.style} icon={r.icon} />
            {roleSummary(r.staff, r.limits) && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">{roleSummary(r.staff, r.limits)}</span>
            )}
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">{r.holders} üye</span>
            {canRoles && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setForm({ id: r.id, name: r.name, style: r.style, icon: r.icon, staff: r.staff, limits: r.limits })}
                  aria-label={`${r.name} rolünü düzenle`}
                  title="Düzenle"
                  className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40"
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </button>
                {!r.builtIn && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void askConfirm(`${r.name} rolü silinsin mi? Bu roldeki ${r.holders} üyeden de kaldırılır.`).then(
                        (ok) => ok && run(() => deleteRoleAction(r.id)),
                      )
                    }
                    aria-label={`${r.name} rolünü sil`}
                    title="Sil"
                    className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/15 hover:text-destructive disabled:opacity-40"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      {canRoles ? (
        <form
          className="flex flex-col gap-3 border-t border-border pt-3"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => saveRoleAction({ ...form, id: form.id || undefined }))
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{form.id ? 'Rolü düzenle' : 'Yeni rol'}</h4>
            <RoleChip name={form.name.trim() || 'Rol adı'} style={form.style} icon={form.icon} className="ml-auto" />
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              aria-label="Rol adı"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value.slice(0, 24) })}
              placeholder="Örn. VIP, Yayıncı, Admin"
              className={cn(input, 'min-w-0 flex-1')}
            />
            <select aria-label="Rol rengi" value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })} className={input}>
              {ROLE_STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div role="radiogroup" aria-label="Rol simgesi" className="flex flex-wrap gap-1.5">
            {BADGE_ICONS.map((id) => {
              const Icon = ICONS[id] ?? Award
              const on = form.icon === id
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={ICON_LABELS[id] ?? id}
                  title={ICON_LABELS[id] ?? id}
                  onClick={() => setForm({ ...form, icon: id })}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-lg border',
                    on ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </button>
              )
            })}
          </div>
          <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <legend className="px-1 text-xs font-semibold text-muted-foreground">Bu rol neyi değiştirir</legend>
            <p className="text-xs leading-relaxed text-muted-foreground">Her kutu ayrıdır. Hiçbirini işaretlemezsen rol sadece adın görünümünü değiştirir.</p>
            <RoleBox checked={form.staff} onChange={(staff) => setForm({ ...form, staff })} label="Görevli" hint={ROLE_STAFF_HINT} />
            {ROLE_LIMITS.map((l) => (
              <RoleBox
                key={l.id}
                checked={form.limits[l.id]}
                onChange={(on) => setForm({ ...form, limits: { ...form.limits, [l.id]: on } })}
                label={l.label}
                hint={l.hint}
              />
            ))}
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy || form.name.trim().length < 2} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">
              {form.id ? 'Rolü kaydet' : 'Rol oluştur'}
            </button>
            {form.id && (
              <button type="button" disabled={busy} onClick={() => setForm(EMPTY)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-40">
                Vazgeç
              </button>
            )}
          </div>
        </form>
      ) : (
        <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">Rol oluşturmak ve vermek için hesabında &quot;Görevliler&quot; yetkisi olmalı.</p>
      )}
      <Note msg={msg} />
    </section>
  )
}
