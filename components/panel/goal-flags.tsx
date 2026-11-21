'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Loader2 } from 'lucide-react'
import { flagGoalMember, loadGoalFlags } from '@/app/panel/goal-actions'
import { GOAL_REPEAT_AT, goalTag, type GoalFlagAction, type GoalFlagRow, type GoalFlagState } from '@/lib/goal-rewards-shared'
import { TR_TZ } from '@/lib/tr-time'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { usePanelAction } from '@/components/panel/flash'
import { StatusLine } from '@/components/alkanka/community/use-action'
import { cn } from '@/lib/utils'

const field = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed text-foreground'
const hint = 'text-xs font-normal leading-relaxed text-muted-foreground'
const ghost = 'h-9 rounded-lg border border-border px-3 text-xs font-bold text-foreground hover:bg-secondary disabled:opacity-40'
const solid = 'h-9 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-40'
const when = (iso: string) => new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TR_TZ })

const TONE = { bad: 'bg-destructive/15 text-destructive', warn: 'bg-primary/15 text-primary', plain: 'bg-secondary text-foreground', good: 'bg-success/15 text-success' } as const

/** The tag a member carries: clean, invalid requests, warned, closed. */
export function GoalTag({ member, className }: { member: { state: GoalFlagState | null; warns: number; invalid: number }; className?: string }) {
  const tag = goalTag(member)
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold', TONE[tag.tone], className)}>{tag.label}</span>
}

const NOTES: Record<Exclude<GoalFlagAction, 'open'>, string[]> = {
  warn: ['Girdiğin kupon numaraları sponsorda bulunamadı.', 'Bahislerin etkinliğin oran şartının altında.', 'Maç günü yatırım şartını sağlamadan talep gönderiyorsun.'],
  block: ['Uyarıya rağmen geçersiz talep göndermeye devam ettin.', 'Sahte kupon numarasıyla talep gönderdin.'],
}

function MemberRow({ row, onChanged }: { row: GoalFlagRow; onChanged: () => void }) {
  const { pending, status, run } = usePanelAction()
  const [action, setAction] = useState<Exclude<GoalFlagAction, 'open'> | null>(null)
  const [note, setNote] = useState('')
  const blocked = row.state === 'blocked'
  const start = (next: Exclude<GoalFlagAction, 'open'>) => {
    setAction(action === next ? null : next)
    setNote('')
  }
  const send = async () => {
    if (!action) return
    if (action === 'block' && !(await askConfirm(`${row.userName} sponsor etkinliklerine katılamasın mı? Yeni kupon giremez; verdiği eski talepler ve Alkanka etkinlikleri etkilenmez. İstediğin zaman yeniden açabilirsin.`))) return
    run(
      () => flagGoalMember(row.userId, action, note),
      () => {
        setAction(null)
        setNote('')
        onChanged()
      },
    )
  }

  return (
    <li className="flex flex-col gap-3 border-t border-border py-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            {row.userName}
            <GoalTag member={row} />
          </p>
          <p className={hint}>
            {row.total} talepten <b className={cn(row.invalid >= GOAL_REPEAT_AT ? 'text-destructive' : 'text-foreground')}>{row.invalid} tanesi geçersiz</b>
            {row.warns > 0 ? ` · ${row.warns} uyarı` : ''}
            {row.lastReason ? ` · son neden: ${row.lastReason}` : ''}
            {row.lastAt ? ` (${when(row.lastAt)})` : ''}
          </p>
          {row.note && (
            <p className={hint}>
              Üyeye yazılan son açıklama: &quot;{row.note}&quot;
              {row.updatedBy ? ` · ${row.updatedBy}` : ''}
              {row.updatedAt ? `, ${when(row.updatedAt)}` : ''}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={pending} aria-expanded={action === 'warn'} onClick={() => start('warn')} className={ghost}>
            Uyar
          </button>
          {blocked ? (
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                if (await askConfirm(`${row.userName} sponsor etkinliklerine yeniden katılabilsin mi? Uyarı sayısı kayıtlı kalır.`)) run(() => flagGoalMember(row.userId, 'open', ''), onChanged)
              }}
              className={ghost}
            >
              Katılımı aç
            </button>
          ) : (
            <button type="button" disabled={pending} aria-expanded={action === 'block'} onClick={() => start('block')} className={cn(ghost, 'border-destructive/50 text-destructive hover:bg-destructive/10')}>
              Katılımı kapat
            </button>
          )}
        </div>
      </div>

      {action && (
        <div className="flex flex-col gap-2 rounded-lg bg-secondary/50 p-3">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
            {action === 'warn' ? 'Üyeye gidecek uyarı' : 'Katılımın neden kapatıldığı'}
            <textarea value={note} maxLength={300} rows={2} onChange={(e) => setNote(e.target.value)} className={field} />
            <span className={hint}>Bu açıklama üyeye mesaj olarak gider ve Gol Yağmuru sayfasında görünür. En az 5 harf.</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {NOTES[action].map((text) => (
              <button key={text} type="button" onClick={() => setNote(text)} className="min-h-8 rounded-full border border-dashed border-border px-3 py-1 text-left text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary">
                {text}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={pending || note.trim().length < 5} onClick={send} className={solid}>
              {pending ? 'İşleniyor...' : action === 'warn' ? 'Uyarıyı gönder' : 'Katılımı kapat'}
            </button>
            <button type="button" onClick={() => setAction(null)} className={ghost}>
              Vazgeç
            </button>
          </div>
        </div>
      )}
      <StatusLine status={status} />
    </li>
  )
}

/**
 * Members who sent sponsor requests that staff found invalid. From here a member is warned and,
 * if it goes on, shut out of sponsor events.
 */
export function GoalFlags() {
  const { data, isLoading, mutate } = useSWR('goal-flags', loadGoalFlags)
  const [query, setQuery] = useState('')
  if (isLoading || !data) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Liste okunuyor...
      </p>
    )
  }
  if (!data.ok) {
    return (
      <p role="alert" className="text-sm font-medium text-destructive">
        {data.error}
      </p>
    )
  }
  const needle = query.trim().toLocaleLowerCase('tr')
  const list = needle ? data.data.filter((r) => r.userName.toLocaleLowerCase('tr').includes(needle)) : data.data
  const repeat = data.data.filter((r) => r.invalid >= GOAL_REPEAT_AT && r.state !== 'blocked').length

  return (
    <section aria-label="Geçersiz talepler" data-find="goal-flags" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-base font-bold text-foreground">Geçersiz talep gönderenler</h3>
        <p className={hint}>
          Sponsor etkinliğinde bir talebi &quot;geçersiz&quot; saydığında üye bu listeye düşer ve etiketlenir. {GOAL_REPEAT_AT} ve üzeri geçersiz talep &quot;tekrarlayan&quot; sayılır. Önce uyar; devam ederse katılımını kapat. Katılımı kapalı üye yeni kupon
          giremez, Alkanka etkinlikleri etkilenmez.
        </p>
        {repeat > 0 && <p className="text-xs font-semibold text-primary">{repeat} üye tekrarlayan geçersiz talep gönderiyor ve henüz kapatılmadı.</p>}
      </div>
      {data.data.length > 8 && <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Üye ara" aria-label="Üyelerde ara" className={cn(field, 'h-10 max-w-xs py-0')} />}
      {list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm leading-relaxed text-muted-foreground">
          {data.data.length === 0 ? 'Geçersiz sayılan talep yok. Bir sponsor maçının katılımcı listesinde talebi "Geçersiz say" ile işaretlediğinde üye burada görünür.' : 'Aramaya uyan üye yok.'}
        </p>
      ) : (
        <ul className="flex flex-col">
          {list.map((row) => (
            <MemberRow key={row.userId} row={row} onChanged={() => void mutate()} />
          ))}
        </ul>
      )}
    </section>
  )
}
