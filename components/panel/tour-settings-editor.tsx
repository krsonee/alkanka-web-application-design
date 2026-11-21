'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { Compass, Copy, Eye, Gift, ListOrdered, Loader2, RefreshCw, Save, ShieldAlert } from 'lucide-react'
import { clearTourBlockAction, previewTourAction, reshowTourAction, saveTourSettingsAction } from '@/app/panel/tour-actions'
import type { ActionState } from '@/app/panel/actions'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { TourFunnelCard } from '@/components/panel/tour-funnel'
import { TourStepsEditor } from '@/components/panel/tour-steps-editor'
import { cn } from '@/lib/utils'
import {
  TOUR_AUDIENCES,
  TOUR_AUDIENCE_LABELS,
  TOUR_PREVIEW_PARAM,
  TOUR_PREVIEW_TOKEN_PARAM,
  TOUR_PREVIEW_VALUES,
  type TourAudience,
  type TourSettings,
  type TourStep,
} from '@/lib/tour-config'
import type { TourFunnel, TourStats } from '@/lib/tour'

const FORM_ID = 'tour-settings-form'
const input = 'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'
const card = 'flex flex-col gap-4 rounded-2xl border border-border bg-card p-5'
const ghost = 'flex items-center gap-2 rounded-xl border border-border px-3.5 py-2 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-50'

const whole = (value: string, max: number) => Math.min(max, Math.max(0, Math.round(Number(value) || 0)))

function Heading({ icon: Icon, children }: { icon: typeof Compass; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
      <h2 className="font-display text-lg font-bold uppercase text-foreground">{children}</h2>
    </div>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-start gap-2.5 text-sm font-medium text-foreground">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]" />
      <span className="flex flex-col gap-0.5">
        {label}
        {hint && <span className="text-xs font-normal leading-relaxed text-muted-foreground">{hint}</span>}
      </span>
    </label>
  )
}

function NumberField({ label, hint, value, max, onChange }: { label: string; hint: string; value: number; max: number; onChange: (value: number) => void }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
      {label}
      <input type="number" inputMode="numeric" min={0} max={max} value={String(value)} onChange={(e) => onChange(whole(e.target.value, max))} className={input} />
      <span className="font-normal leading-relaxed">{hint}</span>
    </label>
  )
}

export function TourSettingsEditor({
  settings,
  stats,
  funnel,
  siteBase,
}: {
  settings: TourSettings
  stats: TourStats
  funnel: TourFunnel
  /** Address of the public site when the panel runs on its own domain; empty when both share one address. */
  siteBase: string
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveTourSettingsAction, {})
  const [previewing, startPreview] = useTransition()
  const [previewNote, setPreviewNote] = useState<{ text: string; href?: string } | null>(null)
  const [draft, setDraft] = useState(settings)
  const [tab, setTab] = useState<TourAudience>('member')
  const [note, setNote] = useState('')
  const [reshow, setReshow] = useState<ActionState>({})
  const [busy, startBusy] = useTransition()
  const payloadRef = useRef<HTMLInputElement>(null)
  const payload = JSON.stringify(draft)
  const first = useRef(true)

  // List edits (add, delete, reorder, the side pane) change no form field themselves; this tells the
  // page-wide "kaydedilmemiş değişiklik" bar that the hidden payload moved.
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    payloadRef.current?.dispatchEvent(new Event('change', { bubbles: true }))
  }, [payload])

  const set = (patch: Partial<TourSettings>) => setDraft((prev) => ({ ...prev, ...patch }))
  const list: TourAudience = draft.split ? tab : 'member'
  const setSteps = (steps: TourStep[]) => setDraft((prev) => ({ ...prev, tours: { ...prev.tours, [list]: steps } }))

  const copyFromMember = async () => {
    if (!(await askConfirm('Misafir turundaki adımlar silinip üye turunun adımları kopyalansın mı?'))) return
    setDraft((prev) => ({ ...prev, tours: { ...prev.tours, guest: prev.tours.member.map((s) => ({ ...s })) } }))
  }

  // The tab is opened inside the click (a tab opened after the server answers gets blocked as a pop-up),
  // then pointed at the site once the draft is parked.
  const preview = (audience: TourAudience) => {
    const tab = window.open('about:blank', '_blank')
    setPreviewNote(null)
    startPreview(async () => {
      const res = await previewTourAction(payload).catch(() => ({ token: undefined, message: 'Önizleme hazırlanamadı, tekrar dene.' }))
      if (!res.token) {
        tab?.close()
        return setPreviewNote({ text: res.message ?? 'Önizleme hazırlanamadı, tekrar dene.' })
      }
      const href = `${siteBase}/?${TOUR_PREVIEW_PARAM}=${TOUR_PREVIEW_VALUES[audience]}&${TOUR_PREVIEW_TOKEN_PARAM}=${res.token}`
      if (tab) {
        tab.opener = null
        tab.location.href = href
      } else setPreviewNote({ text: 'Tarayıcı yeni sekmeyi engelledi.', href })
    })
  }

  const showAgain = async () => {
    if (!(await askConfirm('Tur, daha önce görmüş herkese bir kez daha gösterilsin mi? Ödül yeniden verilmez.'))) return
    const form = new FormData()
    form.set('note', note)
    startBusy(async () => {
      setReshow(await reshowTourAction({}, form))
      setNote('')
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Turu gören üye', value: stats.done.toLocaleString('tr-TR') },
          { label: 'Ödül alan', value: stats.rewarded.toLocaleString('tr-TR') },
          { label: 'Multi engeli', value: stats.blocked.toLocaleString('tr-TR') },
          { label: 'Dağıtılan KC', value: stats.paidTotal.toLocaleString('tr-TR') },
        ].map((s) => (
          <div key={s.label} className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
            <span className="text-xs text-muted-foreground">{s.label}</span>
            <span className="font-display text-2xl font-bold text-foreground">{s.value}</span>
          </div>
        ))}
      </div>

      <form id={FORM_ID} action={action} className={card}>
        <input ref={payloadRef} type="hidden" name="payload" value={payload} readOnly />
        <Heading icon={Compass}>Site turu</Heading>
        <div className="flex flex-col gap-3">
          <Toggle label="Tur açık" hint="Kapalıyken otomatik başlamaz, menüdeki “Siteyi keşfet” düğmesi de turu açmaz." checked={draft.enabled} onChange={(enabled) => set({ enabled })} />
          <Toggle label="Yeni ziyaretçide otomatik başlasın" hint="Oyun masasındayken başlamaz." checked={draft.autoStart} onChange={(autoStart) => set({ autoStart })} />
          <Toggle
            label="Misafir ve üye için ayrı tur"
            hint="Kapalıyken herkes aynı turu görür. Açınca giriş yapmamış ziyaretçiye misafir turu, üyeye üye turu gösterilir."
            checked={draft.split}
            onChange={(split) => set({ split })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            label="Otomatik başlama gecikmesi (saniye)"
            hint="Sayfa açıldıktan kaç saniye sonra başlasın (0-60)."
            value={draft.autoStartDelay}
            max={60}
            onChange={(autoStartDelay) => set({ autoStartDelay })}
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <Heading icon={Gift}>Ödül kuralları</Heading>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            Ödül turu bitiren üyeye hesap başına bir kez verilir. Aynı ağdan, aynı tarayıcıdan ya da multi olarak işaretlenmiş hesaba verilmez. Turu misafirken bitirip
            sonra kayıt olan kişi ödülünü kayıt olur olmaz alır.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <NumberField label="Bitirme ödülü (KC)" hint="0 yazarsan ödül kapanır, tur yine gösterilir." value={draft.reward} max={100000} onChange={(reward) => set({ reward })} />
            <NumberField
              label="Sadece üyeliğin ilk kaç günü"
              hint="Örnek: 7 yazarsan bir haftadan eski üyeye ödül verilmez. 0 = süre yok."
              value={draft.rewardDays}
              max={365}
              onChange={(rewardDays) => set({ rewardDays })}
            />
            <NumberField
              label="Günde en fazla kaç ödül"
              hint="Sınır dolunca o gün ödül verilmez, üye ertesi gün turu bitirip alabilir. 0 = sınır yok."
              value={draft.rewardDailyCap}
              max={100000}
              onChange={(rewardDailyCap) => set({ rewardDailyCap })}
            />
          </div>
        </div>
      </form>

      <section className={card} aria-labelledby="tour-steps">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListOrdered className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <h2 id="tour-steps" className="font-display text-lg font-bold uppercase text-foreground">
              Adımlar
            </h2>
          </div>
          {draft.split && (
            <div role="tablist" aria-label="Tur" className="flex rounded-xl border border-border bg-background p-1">
              {TOUR_AUDIENCES.map((audience) => (
                <button
                  key={audience}
                  type="button"
                  role="tab"
                  aria-selected={tab === audience}
                  onClick={() => setTab(audience)}
                  className={cn('rounded-lg px-3 py-1.5 text-sm font-semibold', tab === audience ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
                >
                  {TOUR_AUDIENCE_LABELS[audience]} · {draft.tours[audience].filter((s) => s.enabled).length}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          {draft.split
            ? list === 'guest'
              ? 'Giriş yapmamış ziyaretçinin gördüğü tur. Bitiş adımında “Kayıt ol” düğmesi çıkar.'
              : 'Giriş yapmış üyenin gördüğü tur. Bitiş adımında ödül düğmesi çıkar.'
            : 'Herkes bu turu görür. Bitiş adımında üyeye ödül düğmesi, misafire “Kayıt ol” düğmesi çıkar.'}
        </p>

        <TourStepsEditor key={list} steps={draft.tours[list]} onChange={setSteps} />

        {draft.split && list === 'guest' && (
          <button type="button" onClick={() => void copyFromMember()} className={cn(ghost, 'self-start')}>
            <Copy className="size-4" aria-hidden="true" />
            Üye turunu buraya kopyala
          </button>
        )}

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" form={FORM_ID} disabled={pending} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
              Kaydet
            </button>
            <button type="button" disabled={previewing} onClick={() => preview('guest')} className={ghost}>
              <Eye className="size-4" aria-hidden="true" />
              Misafir olarak önizle
            </button>
            <button type="button" disabled={previewing} onClick={() => preview('member')} className={ghost}>
              <Eye className="size-4" aria-hidden="true" />
              Üye olarak önizle
            </button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Önizleme siteyi yeni sekmede açar ve ekrandaki hali gösterir (kaydetmeden de). Önizlemede ödül verilmez, sayıma girmez. Önizleme linki 30 dakika geçerlidir.
          </p>
          {previewNote ? (
            <p role="status" className="text-sm text-destructive">
              {previewNote.text}{' '}
              {previewNote.href ? (
                <a href={previewNote.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">
                  Önizlemeyi buradan aç
                </a>
              ) : null}
            </p>
          ) : null}
          {state.message ? (
            <p role="status" className={state.ok ? 'text-sm text-primary' : 'text-sm text-destructive'}>
              {state.message}
            </p>
          ) : null}
        </div>
      </section>

      <section className={card} aria-labelledby="tour-reshow">
        <div className="flex items-center gap-2">
          <RefreshCw className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <h2 id="tour-reshow" className="font-display text-lg font-bold uppercase text-foreground">
            Yeniden göster
          </h2>
        </div>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          Siteye yeni bir özellik eklediğinde adımları güncelle, kaydet, sonra buradan turu herkese bir kez daha göster. Daha önce turu görmüş üye ve ziyaretçilerde tur
          yeniden otomatik başlar. Ödül hesap başına bir kez verildiği için ödülünü almış üyeye yeniden ödenmez.
        </p>
        <p className="text-sm text-foreground">
          Şu anki sürüm: <strong className="font-semibold">{settings.version}</strong>
          {settings.versionNote ? <span className="text-muted-foreground"> · {settings.versionNote}</span> : null}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-1 basis-64 flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
            Not (isteğe bağlı, sadece panelde görünür)
            <input data-no-guard="" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="Örnek: Tahmin ligi eklendi" className={input} />
          </label>
          <button type="button" disabled={busy} onClick={() => void showAgain()} className={ghost}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
            Turu herkese yeniden göster
          </button>
        </div>
        {reshow.message ? (
          <p role="status" className={reshow.ok ? 'text-sm text-primary' : 'text-sm text-destructive'}>
            {reshow.message}
          </p>
        ) : null}
      </section>

      <TourFunnelCard funnel={funnel} />

      <BlockedList stats={stats} />
    </div>
  )
}

function BlockedList({ stats }: { stats: TourStats }) {
  const [clearing, startClear] = useTransition()
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5" aria-labelledby="tour-blocked">
      <div className="flex items-center gap-2">
        <ShieldAlert className="size-5 text-destructive" aria-hidden="true" />
        <h2 id="tour-blocked" className="font-display text-lg font-bold uppercase text-foreground">
          Engellenen ödül talepleri
        </h2>
      </div>
      {stats.recentBlocked.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz multi engeli yok.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {stats.recentBlocked.map((b) => (
            <li key={b.userId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold text-foreground">{b.name}</span>
                <span className="text-xs text-muted-foreground">
                  {b.reason} · {new Date(b.at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}
                </span>
              </div>
              <button
                type="button"
                disabled={clearing}
                onClick={() => startClear(() => void clearTourBlockAction(b.userId))}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
              >
                Engeli kaldır
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
