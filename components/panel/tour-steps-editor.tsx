'use client'

import { useState } from 'react'
import { Eye, EyeOff, Flag, Pencil, Plus, Trash2 } from 'lucide-react'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { ImageField } from '@/components/panel/image-field'
import { SideSheet } from '@/components/panel/side-sheet'
import { SortableList } from '@/components/panel/sortable-list'
import { cn } from '@/lib/utils'
import { MAX_TOUR_STEPS, newTourStepId, tourScreen, TOUR_BODY_MAX, TOUR_SCREENS, TOUR_TITLE_MAX, type TourStep } from '@/lib/tour-config'

const field = 'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'
const iconButton = 'flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40'

const blankStep = (): TourStep => ({ id: newTourStepId(), title: '', body: '', image: '', screen: 'none', show: 'spot', enabled: true })

function StepSheet({ step, isNew, onApply, onClose }: { step: TourStep; isNew: boolean; onApply: (step: TourStep) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(step)
  const screen = tourScreen(draft.screen)
  const set = (patch: Partial<TourStep>) => setDraft((prev) => ({ ...prev, ...patch }))
  const ready = draft.title.trim().length > 0

  return (
    <SideSheet
      title={isNew ? 'Yeni adım' : 'Adımı düzenle'}
      eyebrow="Site turu"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!ready}
            onClick={() => onApply({ ...draft, title: draft.title.trim(), body: draft.body.trim(), show: screen.href ? draft.show : 'spot' })}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {isNew ? 'Adımı ekle' : 'Adımı uygula'}
          </button>
          <p className="text-xs leading-relaxed text-muted-foreground">Listeye işlenir; sitede görünmesi için sayfadaki “Kaydet” düğmesine bas.</p>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
          Başlık
          <input value={draft.title} onChange={(e) => set({ title: e.target.value })} maxLength={TOUR_TITLE_MAX} className={field} />
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
          <span className="flex items-center justify-between gap-2">
            Metin
            <span className="font-normal">
              {draft.body.length}/{TOUR_BODY_MAX}
            </span>
          </span>
          <textarea value={draft.body} onChange={(e) => set({ body: e.target.value })} maxLength={TOUR_BODY_MAX} rows={5} className={cn(field, 'resize-y leading-relaxed')} />
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
          Hedef ekran
          <select value={draft.screen} onChange={(e) => set({ screen: e.target.value })} className={field}>
            {TOUR_SCREENS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <span className="font-normal leading-relaxed">
            {screen.id === 'none'
              ? 'Adım ekranın ortasında, bir yeri işaret etmeden görünür.'
              : screen.inMenu
                ? 'Bilgisayarda menüdeki satırı işaretlenir. Telefonda menü kapalıysa menü düğmesi işaretlenir ve bölümün adı söylenir.'
                : 'Üst çubuktaki yeri işaretlenir.'}
          </span>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="pb-1.5 text-xs font-semibold text-muted-foreground">Bu adımda ne olsun?</legend>
          {(
            [
              { value: 'spot', label: 'Yerini göster', hint: 'Ziyaretçi bulunduğu sayfada kalır, bölümün yeri işaretlenir. Altında “git” düğmesi çıkar.' },
              { value: 'open', label: 'Sayfayı aç', hint: 'Adım gelince o sayfa açılır, kart ekranın altında durur; ziyaretçi sayfanın kendisini görür.' },
            ] as const
          ).map((option) => {
            const off = option.value === 'open' && !screen.href
            return (
              <label key={option.value} className={cn('flex items-start gap-2.5 rounded-xl border border-border bg-background p-3', off && 'opacity-50')}>
                <input
                  type="radio"
                  name="tour-step-show"
                  checked={(screen.href ? draft.show : 'spot') === option.value}
                  disabled={off}
                  onChange={() => set({ show: option.value })}
                  className="mt-0.5 size-4 accent-[var(--primary)]"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-foreground">{option.label}</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">{off ? 'Bu hedefin açılacak bir sayfası yok.' : option.hint}</span>
                </span>
              </label>
            )
          })}
        </fieldset>

        <ImageField
          label="Görsel (isteğe bağlı)"
          hint="Metnin üstünde, kartın genişliğinde görünür. Yatay görsel en iyi sonucu verir."
          value={draft.image}
          onChange={(image) => set({ image })}
          uploadId={`tour-${draft.id}`}
        />

        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input type="checkbox" checked={draft.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="size-4 accent-[var(--primary)]" />
          Bu adım turda gösterilsin
        </label>
      </div>
    </SideSheet>
  )
}

export function TourStepsEditor({ steps, onChange }: { steps: TourStep[]; onChange: (steps: TourStep[]) => void }) {
  const [open, setOpen] = useState<{ step: TourStep; isNew: boolean } | null>(null)
  const shownCount = steps.filter((s) => s.enabled).length
  const lastShown = steps.findLast((s) => s.enabled)?.id
  const full = steps.length >= MAX_TOUR_STEPS

  const apply = (next: TourStep) => {
    onChange(steps.some((s) => s.id === next.id) ? steps.map((s) => (s.id === next.id ? next : s)) : [...steps, next])
    setOpen(null)
  }

  const remove = async (target: TourStep) => {
    if (!(await askConfirm(`“${target.title}” adımı turdan silinsin mi?`))) return
    onChange(steps.filter((s) => s.id !== target.id))
  }

  return (
    <div className="flex flex-col gap-3">
      <SortableList
        items={steps}
        idOf={(s) => s.id}
        nameOf={(s) => s.title}
        onMove={(ids) => onChange(ids.flatMap((id) => steps.find((s) => s.id === id) ?? []))}
        className="flex flex-col gap-2"
        itemClassName="rounded-xl border border-border bg-background"
      >
        {(s, handle, i) => {
          const screen = tourScreen(s.screen)
          const onlyShown = s.enabled && shownCount === 1
          return (
            <div className={cn('flex flex-wrap items-center gap-3 p-3', !s.enabled && 'opacity-60')}>
              {handle}
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-foreground" aria-hidden="true">
                {i + 1}
              </span>
              {s.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- panel thumbnail of an address that can be any host
                <img src={s.image} alt="" className="size-10 shrink-0 rounded-lg border border-border object-cover" />
              ) : null}
              <div className="flex min-w-0 flex-1 basis-40 flex-col gap-0.5">
                <span className="truncate text-sm font-semibold text-foreground">{s.title}</span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{screen.id === 'none' ? 'Ekranın ortasında' : screen.label}</span>
                  {s.show === 'open' && <span>· sayfayı açar</span>}
                  {!s.enabled && <span>· gizli</span>}
                  {s.id === lastShown && (
                    <span className="flex items-center gap-1 font-semibold text-primary">
                      <Flag className="size-3" aria-hidden="true" />
                      Bitiş adımı
                    </span>
                  )}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  disabled={onlyShown}
                  onClick={() => onChange(steps.map((x) => (x.id === s.id ? { ...x, enabled: !x.enabled } : x)))}
                  aria-label={s.enabled ? `${s.title} adımını gizle` : `${s.title} adımını göster`}
                  title={onlyShown ? 'Turda en az bir adım görünmeli' : s.enabled ? 'Gizle' : 'Göster'}
                  className={iconButton}
                >
                  {s.enabled ? <Eye className="size-4" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" />}
                </button>
                <button type="button" onClick={() => setOpen({ step: s, isNew: false })} aria-label={`${s.title} adımını düzenle`} title="Düzenle" className={iconButton}>
                  <Pencil className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={steps.length <= 1 || onlyShown}
                  onClick={() => void remove(s)}
                  aria-label={`${s.title} adımını sil`}
                  title={steps.length <= 1 || onlyShown ? 'Turda en az bir adım görünmeli' : 'Sil'}
                  className={cn(iconButton, 'hover:text-destructive')}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )
        }}
      </SortableList>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={full}
          onClick={() => setOpen({ step: blankStep(), isNew: true })}
          className="flex items-center gap-2 rounded-xl border border-border px-3.5 py-2 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden="true" />
          Adım ekle
        </button>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {full ? `Bir turda en fazla ${MAX_TOUR_STEPS} adım olur.` : 'Tutamaçtan sürükleyerek sırala. Görünen son adım bitiş adımıdır: ödül ya da kayıt düğmesi orada çıkar.'}
        </p>
      </div>

      {open && <StepSheet key={open.step.id} step={open.step} isNew={open.isNew} onApply={apply} onClose={() => setOpen(null)} />}
    </div>
  )
}
