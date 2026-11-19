'use client'

import { useId, useState, useTransition, type FormEvent } from 'react'
import { Loader2, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { saveEventCards } from '@/app/panel/catalog-actions'
import { askConfirm, notify } from '@/components/panel/confirm-dialog'
import { HideButton } from '@/components/panel/hide-button'
import { ImageField } from '@/components/panel/image-field'
import { SideSheet } from '@/components/panel/side-sheet'
import { SortableList, useOrder } from '@/components/panel/sortable-list'
import { EVENT_KINDS } from '@/lib/catalog-shared'
import type { EventCardInput, EventCardRow } from '@/lib/event-cards'
import { cn } from '@/lib/utils'

const MAX_CARDS = 40
const LIMITS = { title: 80, subtitle: 120, prize: 80 } as const
const BLANK: EventCardInput = { id: '', kind: 'Haftalık', title: '', subtitle: '', prize: '', image: '' }

const rowButton = 'flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40'
const input = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal text-foreground outline-none focus:border-primary'

const faceOf = (card: EventCardRow | EventCardInput): EventCardInput => ({ id: card.id, kind: card.kind, title: card.title, subtitle: card.subtitle, prize: card.prize, image: card.image })

/**
 * The cards of the events section, edited where their texts used to be three fixed rows. They are
 * the same events the content calendar lists; this screen changes how a card looks and in what order.
 */
export function EventCardsEditor({ cards, library, canManage, canOpenCalendar }: { cards: EventCardRow[]; library: string[]; canManage: boolean; canOpenCalendar: boolean }) {
  const order = useOrder(cards, (card) => card.id)
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState<string | null>(null)
  const known = cards.map((card) => card.id)
  const open = editing === '' ? BLANK : cards.find((card) => card.id === editing)

  function save(next: EventCardInput[], done?: (ok: boolean, text: string) => void) {
    start(async () => {
      const result = await saveEventCards(next, known)
      const text = result.ok ? result.message : result.error
      if (done) done(result.ok, text)
      else notify(result.ok, text)
      if (!result.ok) order.reset()
    })
  }

  function move(ids: string[]) {
    order.set(ids)
    const byId = new Map(cards.map((card) => [card.id, card]))
    save(ids.flatMap((id) => byId.get(id) ?? []).map(faceOf))
  }

  async function remove(card: EventCardRow) {
    const paid = card.entry > 0 ? ' Katılım ücreti ödemiş üyeler varsa ücretleri kendiliğinden iade edilmez.' : ''
    if (!(await askConfirm(`"${card.title}" etkinliği silinsin mi? Kart siteden kalkar, katılım listesi ve sıralaması da görünmez olur.${paid} Bu işlem geri alınamaz.`))) return
    save(order.ordered.filter((other) => other.id !== card.id).map(faceOf))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
          <h2 className="text-sm font-semibold text-foreground">
            Etkinlik kartları <span className="font-normal text-muted-foreground">{`· ${cards.length}`}</span>
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
            Ana sayfa ve kampanyalar sayfasındaki etkinlik kartları, sitedeki sırasıyla. Sırayı tutamaçtan sürükleyerek değiştir; bıraktığın an kaydedilir.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            disabled={cards.length >= MAX_CARDS}
            onClick={() => setEditing('')}
            className="flex h-9 shrink-0 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="size-4" aria-hidden="true" />
            Yeni etkinlik kartı
          </button>
        )}
      </div>
      {cards.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {canManage ? 'Henüz etkinlik kartı yok; sitede etkinlik bölümü gizli. "Yeni etkinlik kartı" ile ekle.' : 'Henüz etkinlik kartı yok; sitede etkinlik bölümü gizli.'}
        </p>
      ) : (
        <SortableList
          items={order.ordered}
          idOf={(card) => card.id}
          nameOf={(card) => card.title}
          onMove={move}
          disabled={pending}
          className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card"
          itemClassName="bg-card first:rounded-t-xl last:rounded-b-xl"
        >
          {(card, handle, i) => (
            <div data-find={`event-${card.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 p-1.5 pr-2.5">
              {handle}
              <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted-foreground">{i + 1}</span>
              <button
                type="button"
                onClick={() => setEditing(card.id)}
                aria-label={`${card.title} kartını düzenle`}
                className={cn('flex min-w-0 flex-1 basis-56 items-center gap-3 rounded-md p-1 text-left hover:bg-secondary/60', card.hidden && 'opacity-60')}
              >
                <span className="relative h-11 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-secondary">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a small preview of an image from any https host set in the panel */}
                  <img src={card.image || '/placeholder.svg'} alt="" loading="lazy" className="size-full object-cover" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">{card.title}</span>
                  <span className="truncate text-xs text-muted-foreground">{[card.subtitle, card.prize].filter(Boolean).join(' · ') || 'Alt yazı ve ödül yazısı yok'}</span>
                </span>
              </button>
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                <span className="rounded bg-secondary px-1.5 py-0.5 text-muted-foreground">{card.kind}</span>
                <span className="rounded bg-secondary px-1.5 py-0.5 text-muted-foreground">{card.entry > 0 ? `${card.entry.toLocaleString('tr-TR')} KC` : 'Ücretsiz'}</span>
                {card.hidden && <span className="rounded bg-secondary px-1.5 py-0.5 text-muted-foreground">Gizli</span>}
                {!card.endsAt && <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-destructive">Bitiş tarihi yok</span>}
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-0.5">
                <button type="button" onClick={() => setEditing(card.id)} className={rowButton} aria-label={`${card.title}: düzenle`} title="Düzenle">
                  <Pencil className="size-4" aria-hidden="true" />
                </button>
                {canManage && <HideButton key={`${card.id}-${card.hidden}`} kind="event" id={card.id} hidden={card.hidden} label={card.title} />}
                {canManage && (
                  <button type="button" disabled={pending} onClick={() => void remove(card)} className={cn(rowButton, 'hover:text-destructive')} aria-label={`${card.title}: sil`} title="Sil">
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          )}
        </SortableList>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
        Buradan kartın yazıları, görseli ve sırası değişir. Tarih, katılım ücreti, sıralama türü ve dağıtılacak ödüller{' '}
        {canOpenCalendar ? (
          <a href="/panel?b=catalog&s=events" className="font-semibold text-primary hover:underline">
            İçerik takvimi → Etkinlik & bilet
          </a>
        ) : (
          'İçerik takvimi → Etkinlik & bilet'
        )}{' '}
        ekranında ayarlanır.
        {!canManage && ' Kart eklemek ve silmek için İçerik takvimi yetkisi gerekir.'}
      </p>
      {open && (
        <CardEditor
          key={open.id || 'new'}
          card={open}
          library={library}
          pending={pending}
          onClose={() => setEditing(null)}
          onSave={(face, done) => {
            const list = order.ordered.map(faceOf)
            save(face.id ? list.map((other) => (other.id === face.id ? face : other)) : [...list, face], done)
          }}
        />
      )}
    </div>
  )
}

function CardEditor({
  card,
  library,
  pending,
  onClose,
  onSave,
}: {
  card: EventCardInput
  library: string[]
  pending: boolean
  onClose: () => void
  onSave: (card: EventCardInput, done: (ok: boolean, text: string) => void) => void
}) {
  const formId = useId()
  const [v, setV] = useState<EventCardInput>(() => faceOf(card))
  const [error, setError] = useState('')
  const set = <K extends keyof EventCardInput>(key: K, value: EventCardInput[K]) => setV((prev) => ({ ...prev, [key]: value }))
  const isNew = !card.id

  function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    onSave(v, (ok, text) => {
      if (!ok) {
        setError(text)
        return
      }
      notify(true, text)
      onClose()
    })
  }

  return (
    <SideSheet
      eyebrow={isNew ? 'Etkinlik kartları' : 'Etkinlik kartını düzenle'}
      title={isNew ? 'Yeni etkinlik kartı' : card.title}
      onClose={onClose}
      footer={
        <>
          <button form={formId} disabled={pending} className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
            {isNew ? 'Kartı ekle' : 'Kaydet'}
          </button>
          {error && (
            <p role="alert" className="w-full text-sm text-destructive">
              {error}
            </p>
          )}
        </>
      }
    >
      <form id={formId} data-no-guard onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex w-64 max-w-full flex-col overflow-hidden rounded-xl border border-border bg-background">
          <div className="relative h-24 bg-secondary">
            {/* eslint-disable-next-line @next/next/no-img-element -- preview of an image from any https host set in the panel */}
            <img src={v.image || '/images/banner-events.png'} alt="" className="size-full object-cover" />
            <span className="absolute left-2 top-2 rounded bg-primary px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-primary-foreground">{v.kind}</span>
          </div>
          <div className="flex flex-col gap-1 p-3">
            <span className="truncate font-display text-base font-bold text-foreground">{v.title || 'Başlık burada görünür'}</span>
            <span className="truncate text-xs text-muted-foreground">{v.subtitle || 'Alt yazı'}</span>
            <span className="truncate text-xs text-primary">{v.prize || 'Ödül yazısı'}</span>
          </div>
        </div>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
          Başlık
          <input value={v.title} onChange={(event) => set('title', event.target.value)} maxLength={LIMITS.title} required placeholder="Bilet Çekilişi" className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
          Alt yazı
          <input value={v.subtitle} onChange={(event) => set('subtitle', event.target.value)} maxLength={LIMITS.subtitle} placeholder="250.000 Kanka Coin havuz" className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
          Ödül yazısı
          <input value={v.prize} onChange={(event) => set('prize', event.target.value)} maxLength={LIMITS.prize} placeholder="1. ödül 50.000 KC" className={input} />
          <span className="font-normal leading-relaxed text-muted-foreground">Kartın sağ altında görünen kısa yazı. Ödülün kendisini değiştirmez.</span>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
          Etiket
          <select value={v.kind} onChange={(event) => set('kind', event.target.value as EventCardInput['kind'])} className={input}>
            {EVENT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>
        <ImageField label="Görsel" value={v.image} onChange={(image) => set('image', image)} library={library} uploadId="event-card" placeholder="Boşsa hazır etkinlik görseli kullanılır" hint="Kartın üstündeki görsel. Önerilen boyut 800×400." />
        {isNew && (
          <p className="rounded-lg border border-border bg-background p-3 text-xs leading-relaxed text-muted-foreground text-pretty">
            Yeni etkinlik ücretsiz ve 7 günlük açılır, otomatik sıralaması kapalıdır. Tarihini, katılım ücretini, kurallarını ve ödüllerini kaydettikten sonra İçerik takvimi → Etkinlik & bilet ekranından ayarla.
          </p>
        )}
      </form>
    </SideSheet>
  )
}
