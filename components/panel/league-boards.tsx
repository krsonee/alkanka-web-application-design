'use client'

import { useState } from 'react'
import { Pencil, Plus, Trash2, Trophy } from 'lucide-react'
import { closeLeagueBoard, removeLeagueBoard, saveLeagueBoard } from '@/app/panel/community-actions'
import { MAX_BOARD_NAME, MAX_LEAGUE_PLACES, prizeText, type Board, type Prize } from '@/lib/predictions-shared'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { usePanelAction } from '@/components/panel/flash'
import { StatusLine } from '@/components/alkanka/community/use-action'
import { cn } from '@/lib/utils'
import { PrizeField, prizeProblem, type PrizeOptions } from './league-fields'

const card = 'flex flex-col gap-3 rounded-xl border border-border bg-card p-4'
const field = 'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring'
const caption = 'flex flex-col gap-1 text-xs font-semibold text-muted-foreground'

export const GENERAL_LEAGUE = 'Genel lig (haftalık ve aylık)'

/** Which league a match is filed under. Closed leagues are not offered: their table is final. */
export function BoardSelect({ boards, value, onChange, label = 'Hangi lig', className }: { boards: Board[]; value: number | null; onChange: (id: number | null) => void; label?: string; className?: string }) {
  const open = boards.filter((b) => b.open)
  if (!open.length) return null
  return (
    <label className={cn(caption, className)}>
      {label}
      <select value={value === null ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} className={field}>
        <option value="">{GENERAL_LEAGUE}</option>
        {open.map((b) => (
          <option key={b.id} value={String(b.id)}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  )
}

type Draft = { id: number | null; name: string; general: boolean; places: (Prize | null)[] }

const blank: Draft = { id: null, name: '', general: false, places: [] }

function BoardForm({ initial, options, onDone, onCancel }: { initial: Draft; options: PrizeOptions; onDone: () => void; onCancel: () => void }) {
  const { pending, status, run } = usePanelAction()
  const [d, setD] = useState<Draft>(initial)
  const firstBad = d.places.findIndex((p) => !p || prizeProblem(p))
  const problem =
    d.name.trim().length < 3
      ? 'Lige en az 3 harfli bir ad ver.'
      : firstBad >= 0
        ? `${firstBad + 1}. sıra: ${d.places[firstBad] ? prizeProblem(d.places[firstBad]) : 'ödül türünü seç ya da sırayı kaldır.'}`
        : null

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-background p-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => saveLeagueBoard({ id: d.id, name: d.name, general: d.general, places: d.places as Prize[] }), onDone)
      }}
    >
      <label className={cn(caption, 'sm:max-w-md')}>
        Ligin adı
        <input value={d.name} maxLength={MAX_BOARD_NAME} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Örn. Süper Lig Tahmin Ligi" className={field} />
      </label>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={d.general} onChange={(e) => setD({ ...d, general: e.target.checked })} className="mt-0.5 size-4 shrink-0 accent-primary" />
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-bold text-foreground">Maçları haftalık ve aylık genel lige de sayılsın</span>
          <span className="text-xs leading-relaxed text-muted-foreground">
            Kapalıyken bu ligin maçlarından gelen puan sadece ligin kendi tablosuna yazılır; haftalık ve aylık tabloya ve o tabloların ödüllerine karışmaz. Soru ödülleri (KC, KP) her durumda üyeye verilir.
          </span>
        </span>
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-muted-foreground">Lig ödülleri (isteğe bağlı)</span>
        {d.places.length > 0 && (
          <ol className="flex flex-col gap-2">
            {d.places.map((p, i) => (
              <li key={i} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
                <PrizeField label={`${i + 1}. sıranın ödülü`} value={p} options={options} onChange={(next) => setD({ ...d, places: d.places.map((x, j) => (j === i ? next : x)) })} />
              </li>
            ))}
          </ol>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={d.places.length >= MAX_LEAGUE_PLACES}
            onClick={() => setD({ ...d, places: [...d.places, null] })}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-40"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Kazanan sıra ekle
          </button>
          {d.places.length > 0 && (
            <button type="button" onClick={() => setD({ ...d, places: d.places.slice(0, -1) })} className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary">
              <Trash2 className="size-3.5" aria-hidden="true" />
              Son sırayı kaldır
            </button>
          )}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">Ödüller, ligi kapattığında tablonun ilk sıralarına dağıtılır. Ödül girmezsen lig sadece puan tablosu olarak çalışır.</p>
      </div>

      {problem && (d.name.trim() !== '' || d.places.length > 0) && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button disabled={pending || Boolean(problem)} className="h-10 rounded-lg bg-primary px-5 text-xs font-bold text-primary-foreground disabled:opacity-40">
          {pending ? 'Kaydediliyor...' : d.id ? 'Ligi kaydet' : 'Ligi aç'}
        </button>
        <button type="button" onClick={onCancel} className="h-10 rounded-lg border border-border px-4 text-xs font-semibold text-foreground hover:bg-secondary">
          Vazgeç
        </button>
      </div>
      <StatusLine status={status} />
    </form>
  )
}

function BoardRow({ b, options, onChanged }: { b: Board; options: PrizeOptions; onChanged: () => void }) {
  const { pending, status, run } = usePanelAction()
  const [editing, setEditing] = useState(false)
  const settled = b.matches - b.waiting
  const closeText = b.places.length
    ? `"${b.name}" kapatılsın mı? Tablo dondurulur ve ilk ${b.places.length} sıraya ödülleri hemen dağıtılır. Kapatılan lige maç eklenemez; bu işlem geri alınamaz.`
    : `"${b.name}" kapatılsın mı? Tablo dondurulur ve lige artık maç eklenemez. Bu işlem geri alınamaz.`

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-64 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2 text-sm font-bold text-foreground">
            {b.name}
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', b.open ? 'bg-success/15 text-success' : 'bg-secondary text-muted-foreground')}>{b.open ? 'Açık' : 'Kapatıldı'}</span>
          </span>
          <span className="text-xs leading-relaxed text-muted-foreground">
            {b.matches} maç{b.matches ? ` (${settled} sonuçlandı, ${b.waiting} bekliyor)` : ''} · {b.general ? 'haftalık ve aylık lige de sayılır' : 'sadece kendi tablosuna yazılır'}
          </span>
          <span className="text-xs leading-relaxed text-muted-foreground">
            Ödüller: {b.places.length ? <span className="text-foreground">{b.places.map((p, i) => `${i + 1}. ${prizeText(p)}`).join(' · ')}</span> : 'yok'}
          </span>
        </div>
        {b.open && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" aria-expanded={editing} onClick={() => setEditing((v) => !v)} className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary">
              <Pencil className="size-3.5" aria-hidden="true" />
              {editing ? 'Vazgeç' : 'Düzenle'}
            </button>
            <button
              type="button"
              disabled={pending || b.waiting > 0 || b.matches === 0}
              title={b.matches === 0 ? 'Lige henüz maç eklenmedi.' : b.waiting > 0 ? 'Önce bekleyen maçların sonucunu gir.' : undefined}
              onClick={() => void askConfirm(closeText).then((ok) => ok && run(() => closeLeagueBoard(b.id), onChanged))}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-40"
            >
              <Trophy className="size-3.5" aria-hidden="true" />
              {b.places.length ? 'Ligi bitir ve ödülleri dağıt' : 'Ligi bitir'}
            </button>
            {settled === 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  void askConfirm(b.waiting ? `"${b.name}" silinsin mi? İçindeki ${b.waiting} maç silinmez, genel lige döner.` : `"${b.name}" silinsin mi?`).then((ok) => ok && run(() => removeLeagueBoard(b.id), onChanged))
                }
                aria-label={`${b.name} ligini sil`}
                className="flex size-9 items-center justify-center rounded-lg bg-destructive/15 text-destructive disabled:opacity-50"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
      {b.open && b.waiting > 0 && <p className="text-xs leading-relaxed text-muted-foreground">Ligi bitirmek için bekleyen {b.waiting} maçın sonucunun girilmesi gerekir.</p>}
      {!b.open && (
        <div className="flex flex-col gap-1 rounded-lg bg-background p-3 text-xs">
          <p className="font-semibold text-foreground">Kazananlar</p>
          {b.winners.length ? (
            <ol className="flex flex-col gap-0.5 text-muted-foreground">
              {b.winners.map((w) => (
                <li key={w.place}>
                  {w.place}. {w.name} ({w.points} puan): <span className="text-foreground">{prizeText(w.prize)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground">{b.places.length ? 'Puan alan üye olmadığı için ödül dağıtılmadı.' : 'Bu lig ödülsüzdü.'}</p>
          )}
        </div>
      )}
      {editing && (
        <BoardForm
          initial={{ id: b.id, name: b.name, general: b.general, places: b.places }}
          options={options}
          onCancel={() => setEditing(false)}
          onDone={() => {
            setEditing(false)
            onChanged()
          }}
        />
      )}
      <StatusLine status={status} />
    </li>
  )
}

/** Special leagues: each has its own table and prizes, apart from the weekly and monthly general league. */
export function BoardsDesk({ boards, options, onChanged }: { boards: Board[]; options: PrizeOptions; onChanged: () => void }) {
  const [adding, setAdding] = useState(false)
  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="ozel-ligler" className={card}>
        <div className="flex flex-col gap-1">
          <h3 id="ozel-ligler" className="font-display text-base font-bold text-foreground">
            Özel ligler
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Lig seçilmeden eklenen her maç genel lige (haftalık ve aylık tablo) yazılır. Ayrı bir yarışma istiyorsan burada lig aç: maç eklerken ya da takvimden yayınlarken o ligi seçersin, puanlar ligin kendi tablosunda toplanır ve sitede lig
            tablosunun altında ayrı sekme olarak görünür. Lig bitince &quot;Ligi bitir&quot; ile tabloyu dondurup ödülleri dağıtırsın.
          </p>
        </div>
        {adding ? (
          <BoardForm
            initial={blank}
            options={options}
            onCancel={() => setAdding(false)}
            onDone={() => {
              setAdding(false)
              onChanged()
            }}
          />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="flex h-10 items-center gap-1.5 self-start rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground">
            <Plus className="size-3.5" aria-hidden="true" />
            Yeni lig aç
          </button>
        )}
      </section>
      {boards.length ? (
        <ul className="flex flex-col gap-2">
          {boards.map((b) => (
            <BoardRow key={b.id} b={b} options={options} onChanged={onChanged} />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm leading-relaxed text-muted-foreground">Henüz özel lig yok. Bütün maçlar genel lige yazılıyor.</p>
      )}
    </div>
  )
}
