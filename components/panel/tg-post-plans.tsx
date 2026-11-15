'use client'

import { useId, useState } from 'react'
import { CalendarClock, ChevronLeft, ChevronRight, FileText, LayoutTemplate, Send, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { Card, btn, btnDanger, btnGhost, input } from '@/components/panel/tg-hub-ui'
import { Note, badge, useRun, when, type Run } from '@/components/panel/tg-post-ui'
import { deletePlanAction, planToDraftAction, reschedulePlanAction, sendPlanNowAction } from '@/app/panel/tg-post-actions'
import {
  DEFAULT_GRACE_MIN,
  GRACE_CHOICES,
  REPEAT_LABEL,
  TEMPLATE_FIELD_LABEL,
  isoToLocal,
  localToIso,
  plainText,
  runsBetween,
  trDay,
  type PlanRepeat,
  type PlanRow,
  type PlanStatus,
  type PostCenterData,
  type PostSponsor,
  type TemplateField,
} from '@/lib/tg-posts-shared'

const fieldLabel = 'flex flex-col gap-1 text-xs text-muted-foreground'
const snippetOf = (plan: PlanRow) => plainText(plan.content.text).replace(/\s+/g, ' ').trim()

// --- When to send ----------------------------------------------------------------

export type Timing = { at: string; repeat: PlanRepeat; graceMin: number }
export const NO_TIMING: Timing = { at: '', repeat: 'none', graceMin: DEFAULT_GRACE_MIN }

export function ScheduleField({ value, onChange }: { value: Timing; onChange: (next: Timing) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={fieldLabel}>
          Tarih ve saat (Türkiye saati)
          <input type="datetime-local" className={input} value={value.at} onChange={(e) => onChange({ ...value, at: e.target.value })} />
        </label>
        <label className={fieldLabel}>
          Tekrar
          <select className={input} value={value.repeat} onChange={(e) => onChange({ ...value, repeat: e.target.value as PlanRepeat })}>
            {(Object.keys(REPEAT_LABEL) as PlanRepeat[]).map((r) => (
              <option key={r} value={r}>
                {REPEAT_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={fieldLabel}>
        Saatinde çıkamazsa ne kadar geç gidebilir
        <select className={input} value={value.graceMin} onChange={(e) => onChange({ ...value, graceMin: Number(e.target.value) })}>
          {GRACE_CHOICES.map((g) => (
            <option key={g.min} value={g.min}>
              {g.label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Zamanlı post, sitedeki ziyaretçi trafiğiyle ya da bota gelen bir Telegram bildirimiyle tetiklenir. Saatinde değil birkaç dakika sonra çıkabilir; o sırada ikisi de yoksa ilk
        harekette çıkar. Gecikme yukarıdaki sınırı aşarsa post gönderilmez ve “Zamanlı postlar” sekmesinde “Kaçırıldı” yazar.
      </p>
    </div>
  )
}

// --- Template fields -------------------------------------------------------------

export function TemplateFill({ fields, sponsors, onFill }: { fields: TemplateField[]; sponsors: PostSponsor[]; onFill: (values: Partial<Record<TemplateField, string>>) => void }) {
  const listId = useId()
  const [values, setValues] = useState<Partial<Record<TemplateField, string>>>({})
  const set = (field: TemplateField, value: string) =>
    setValues((prev) => {
      const next = { ...prev, [field]: value }
      // Picking a known sponsor brings its address along, unless one was already typed.
      const known = field === 'sponsor' ? sponsors.find((s) => s.name === value) : null
      if (known && fields.includes('link') && !prev.link) next.link = known.url
      return next
    })
  const ready = fields.some((f) => (values[f] ?? '').trim())

  return (
    <Card title="Şablon alanları" hint="Yazıda ve butonlarda süslü parantezle duran yerlere ne geleceğini yaz. Boş bıraktığın alan yerinde kalır ve post gönderilemez.">
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f} className={fieldLabel}>
            {`${TEMPLATE_FIELD_LABEL[f]} · {${f}}`}
            <input
              className={input}
              value={values[f] ?? ''}
              list={f === 'sponsor' ? listId : undefined}
              inputMode={f === 'link' ? 'url' : undefined}
              placeholder={f === 'link' ? 'https://…' : f === 'kod' ? 'Örn: KANKA50' : undefined}
              onChange={(e) => set(f, e.target.value)}
            />
          </label>
        ))}
      </div>
      <datalist id={listId}>
        {sponsors.map((s) => (
          <option key={s.id} value={s.name} />
        ))}
      </datalist>
      <button
        type="button"
        className={cn(btn, 'self-start')}
        disabled={!ready}
        onClick={() => {
          onFill(values)
          setValues({})
        }}
      >
        Alanları yerine yaz
      </button>
    </Card>
  )
}

// --- Drafts and templates, on the new-post screen ---------------------------------

function ShelfList({ title, icon: Icon, plans, openId, pending, onOpen, run }: { title: string; icon: typeof FileText; plans: PlanRow[]; openId: number | null; pending: boolean; onOpen: (plan: PlanRow) => void; run: Run }) {
  if (!plans.length) return null
  const remove = async (plan: PlanRow) => {
    if (await askConfirm(`“${plan.name}” silinsin mi? Geri alınamaz.`)) run(() => deletePlanAction(plan.id))
  }
  return (
    <div className="flex flex-col gap-2">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
        {`${title} (${plans.length})`}
      </h4>
      <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
        {plans.map((plan) => {
          const snippet = snippetOf(plan)
          const open = plan.id === openId
          return (
            <li key={plan.id} className={cn('flex flex-wrap items-center gap-2 rounded-lg border p-2', open ? 'border-primary bg-primary/5' : 'border-border bg-background')}>
              <div className="flex min-w-0 flex-1 basis-40 flex-col">
                <span className="truncate text-sm font-medium text-foreground">{plan.name}</span>
                <span className="truncate text-xs text-muted-foreground">{`${when(plan.updatedAt)}${snippet && snippet !== plan.name ? ` · ${snippet}` : ''}`}</span>
              </div>
              <button type="button" className={btnGhost} disabled={pending || open} aria-label={`“${plan.name}” kaydını aç`} onClick={() => onOpen(plan)}>
                {open ? 'Açık' : 'Aç'}
              </button>
              <button type="button" className={cn(btnDanger, 'w-9 px-0')} disabled={pending} aria-label={`“${plan.name}” kaydını sil`} onClick={() => remove(plan)}>
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function PlanShelf({ plans, openId, pending, onOpen, run }: { plans: PlanRow[]; openId: number | null; pending: boolean; onOpen: (plan: PlanRow) => void; run: Run }) {
  const templates = plans.filter((p) => p.kind === 'template')
  const drafts = plans.filter((p) => p.kind === 'draft')
  if (!templates.length && !drafts.length) return null
  const shared = { openId, pending, onOpen, run }
  return (
    <Card title="Taslaklar ve şablonlar" hint="Açtığın kayıt aşağıdaki forma dolar. Şablon her kullanımda yerinde kalır; taslak gönderilince ya da zamanlanınca listeden çıkar.">
      <ShelfList title="Şablonlar" icon={LayoutTemplate} plans={templates} {...shared} />
      <ShelfList title="Taslaklar" icon={FileText} plans={drafts} {...shared} />
    </Card>
  )
}

// --- Scheduled posts -------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const clockOf = (at: number) => isoToLocal(at).slice(11)

type DayRun = { at: number; plan: PlanRow }

function Calendar({ plans }: { plans: PlanRow[] }) {
  const [today] = useState(() => trDay(Date.now()))
  const [month, setMonth] = useState(today.slice(0, 7))
  const [selected, setSelected] = useState<string | null>(null)
  const [year, monthNo] = month.split('-').map(Number)
  const start = Date.parse(`${month}-01T00:00:00+03:00`)
  const dayCount = new Date(Date.UTC(year, monthNo, 0)).getUTCDate()
  const lead = (new Date(Date.UTC(year, monthNo - 1, 1)).getUTCDay() + 6) % 7

  const byDay = new Map<string, DayRun[]>()
  for (const plan of plans) {
    for (const at of runsBetween(plan, start, start + dayCount * DAY_MS)) {
      const day = trDay(at)
      byDay.set(day, [...(byDay.get(day) ?? []), { at, plan }])
    }
  }
  for (const runs of byDay.values()) runs.sort((a, b) => a.at - b.at)
  const shift = (by: number) => {
    setMonth(new Date(Date.UTC(year, monthNo - 1 + by, 1)).toISOString().slice(0, 7))
    setSelected(null)
  }
  const picked: DayRun[] | null = selected ? (byDay.get(selected) ?? []) : null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className={cn(btnGhost, 'w-9 px-0')} onClick={() => shift(-1)} aria-label="Önceki ay">
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <p className="text-sm font-semibold text-foreground" aria-live="polite">{`${MONTHS[monthNo - 1]} ${year}`}</p>
        <button type="button" className={cn(btnGhost, 'w-9 px-0')} onClick={() => shift(1)} aria-label="Sonraki ay">
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1" aria-hidden="true">
        {WEEKDAYS.map((d) => (
          <span key={d} className="text-center text-xs font-medium text-muted-foreground">
            {d}
          </span>
        ))}
      </div>
      <ul className="grid grid-cols-7 gap-1" aria-label={`${MONTHS[monthNo - 1]} ${year} takvimi`}>
        {Array.from({ length: lead }, (_, i) => (
          <li key={`lead-${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length: dayCount }, (_, i) => {
          const day = `${month}-${String(i + 1).padStart(2, '0')}`
          const runs = byDay.get(day) ?? []
          return (
            <li key={day}>
              <button
                type="button"
                aria-pressed={selected === day}
                aria-label={`${i + 1} ${MONTHS[monthNo - 1]}${day === today ? ' (bugün)' : ''}, ${runs.length ? `${runs.length} zamanlı post` : 'post yok'}`}
                onClick={() => setSelected(selected === day ? null : day)}
                className={cn(
                  'flex h-16 w-full flex-col items-start gap-0.5 overflow-hidden rounded-lg border p-1.5 text-left',
                  selected === day ? 'border-primary bg-primary/10' : runs.length ? 'border-border bg-card hover:bg-muted' : 'border-transparent hover:bg-muted',
                  day < today && 'opacity-50',
                )}
              >
                <span className={cn('text-xs tabular-nums', day === today ? 'font-bold text-primary' : 'text-foreground')}>{i + 1}</span>
                {runs.length > 0 && (
                  <span className="flex w-full flex-col text-xs leading-tight tabular-nums text-muted-foreground">
                    <span className="truncate font-medium text-foreground">{clockOf(runs[0].at)}</span>
                    {runs.length > 1 && <span className="truncate">{`+${runs.length - 1} post`}</span>}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      {selected && picked && (
        <div role="status" className="flex flex-col gap-1 rounded-lg border border-border bg-background p-3">
          <p className="text-xs font-semibold text-foreground">{`${Number(selected.slice(8))} ${MONTHS[monthNo - 1]}`}</p>
          {picked.length ? (
            <ul className="flex flex-col gap-1">
              {picked.map((r) => (
                <li key={`${r.plan.id}-${r.at}`} className="flex items-baseline gap-2 text-xs leading-relaxed">
                  <span className="shrink-0 font-semibold tabular-nums text-foreground">{clockOf(r.at)}</span>
                  <span className="min-w-0 text-muted-foreground [overflow-wrap:anywhere]">
                    {`${r.plan.name}${r.plan.repeat !== 'none' ? ` · ${REPEAT_LABEL[r.plan.repeat].toLocaleLowerCase('tr-TR')}` : ''}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Bu gün için zamanlı post yok.</p>
          )}
        </div>
      )}
    </div>
  )
}

const PLAN_STATUS: Record<PlanStatus, { label: string; className: string }> = {
  waiting: { label: 'Bekliyor', className: 'bg-primary/10 text-primary' },
  sending: { label: 'Gönderiliyor', className: 'bg-muted text-foreground' },
  failed: { label: 'Gönderilemedi', className: 'bg-destructive/10 text-destructive' },
  missed: { label: 'Kaçırıldı', className: 'bg-destructive/10 text-destructive' },
}

function ScheduledCard({ plan, data, pending, run }: { plan: PlanRow; data: PostCenterData; pending: boolean; run: Run }) {
  const [editing, setEditing] = useState(false)
  const [timing, setTiming] = useState<Timing>(() => ({ at: plan.sendAt ? isoToLocal(plan.sendAt) : '', repeat: plan.repeat, graceMin: plan.graceMin }))
  const status = PLAN_STATUS[plan.status]
  const bot = data.bots.find((b) => b.id === plan.botId)
  const titles = plan.chatIds.map((id) => data.targets.find((t) => t.chatId === id && t.botId === plan.botId)?.title || id).join(', ')
  const snippet = snippetOf(plan)
  const busy = pending || plan.status === 'sending'
  const iso = localToIso(timing.at)
  const extras = [plan.content.media.length && `${plan.content.media.length} medya`, plan.content.buttons.flat().length && `${plan.content.buttons.flat().length} buton`].filter(Boolean)

  const sendNow = async () => {
    if (await askConfirm(`“${plan.name}” beklemeden şimdi şu hedeflere gönderilsin mi: ${titles}`)) run(() => sendPlanNowAction(plan.id))
  }
  const remove = async () => {
    if (await askConfirm(`“${plan.name}” zamanlı postu silinsin mi? Geri alınamaz.`)) run(() => deletePlanAction(plan.id))
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-semibold tabular-nums text-foreground">{when(plan.sendAt)}</span>
        <span className={cn(badge, status.className)}>{status.label}</span>
        {plan.repeat !== 'none' && <span className={cn(badge, 'bg-muted text-foreground')}>{REPEAT_LABEL[plan.repeat]}</span>}
        <span className="min-w-0 truncate text-sm text-foreground">{plan.name}</span>
      </div>
      {snippet && snippet !== plan.name && <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{snippet}</p>}
      <p className="text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
        {[bot ? (bot.username ? `@${bot.username}` : bot.name) : 'Bot silinmiş', titles || 'Hedef seçilmemiş', ...extras, plan.author && `hazırlayan: ${plan.author}`].filter(Boolean).join(' · ')}
      </p>
      {plan.lastError && (
        <p role="alert" className="text-xs leading-relaxed text-destructive [overflow-wrap:anywhere]">
          {plan.lastError}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={cn(btnGhost, 'gap-1.5')} disabled={busy} onClick={sendNow}>
          <Send className="size-4" aria-hidden="true" />
          Şimdi gönder
        </button>
        <button type="button" className={cn(btnGhost, 'gap-1.5')} disabled={busy} aria-expanded={editing} onClick={() => setEditing((open) => !open)}>
          <CalendarClock className="size-4" aria-hidden="true" />
          Zamanı değiştir
        </button>
        <button type="button" className={btnGhost} disabled={busy} onClick={() => run(() => planToDraftAction(plan.id))}>
          Taslağa al
        </button>
        <button type="button" className={cn(btnDanger, 'gap-1.5')} disabled={busy} onClick={remove}>
          <Trash2 className="size-4" aria-hidden="true" />
          Sil
        </button>
      </div>
      {editing && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3">
          <ScheduleField value={timing} onChange={setTiming} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btn}
              disabled={busy || !iso}
              onClick={() => run(() => reschedulePlanAction(plan.id, { sendAt: iso!, repeat: timing.repeat, graceMin: timing.graceMin }), (result) => result.ok && setEditing(false))}
            >
              Yeni zamanı kaydet
            </button>
            <button type="button" className={btnGhost} disabled={pending} onClick={() => setEditing(false)}>
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

export function ScheduledPosts({ data }: { data: PostCenterData }) {
  const { pending, msg, run } = useRun()
  const plans = data.plans.filter((p) => p.kind === 'scheduled')
  const onClock = plans.filter((p) => p.status === 'waiting' || p.status === 'sending')

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Bir postu zamanlamak için “Yeni post” sekmesinde “İleri bir zamanda”yı seç. Zamanlı postun içeriğini değiştirmek için “Taslağa al”a bas, “Yeni post” sekmesinde açıp düzenle ve
        yeniden zamanla.
      </p>
      <Card title="Takvim" hint="Bir güne basınca o gün çıkacak postları görürsün. Tekrarlayan postlar her turuyla görünür.">
        <Calendar plans={onClock} />
      </Card>
      <Note msg={msg} />
      {plans.length === 0 ? (
        <Card title="Zamanlı post yok">
          <p className="text-sm leading-relaxed text-muted-foreground">Zamanladığın postlar burada sırayla durur.</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Zamanlı postlar">
          {plans.map((p) => (
            <ScheduledCard key={`${p.id}-${p.sendAt}`} plan={p} data={data} pending={pending} run={run} />
          ))}
        </ul>
      )}
    </div>
  )
}
