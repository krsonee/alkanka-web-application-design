'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Download, Loader2, Plus } from 'lucide-react'
import {
  approveGoalPicks,
  cancelGoalMatch,
  createGoalMatch,
  deliverGoalPicks,
  finishGoalMatch,
  loadGoalAdmin,
  loadGoalPicks,
  removeGoalEvent,
  removeGoalMatch,
  retryGoalPay,
  saveGoalEventAction,
  type GoalAdminData,
} from '@/app/panel/goal-actions'
import {
  GOAL_APPROVAL_LABEL,
  GOAL_CATEGORIES,
  GOAL_MAX_GOALS,
  GOAL_MAX_PER_GOAL,
  checkGoalEvent,
  checkGoalScore,
  goalAmount,
  goalConditions,
  goalPickState,
  goalPickTotals,
  goalPicksCsv,
  goalReward,
  goalStatusLabel,
  type GoalCategory,
  type GoalEventInput,
  type GoalEventView,
  type GoalMatch,
} from '@/lib/goal-rewards-shared'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { GoalFixturePicker } from '@/components/panel/goal-fixture-picker'
import { usePanelAction } from '@/components/panel/flash'
import { SideSheet } from '@/components/panel/side-sheet'
import { StatusLine } from '@/components/alkanka/community/use-action'
import { cn } from '@/lib/utils'

const card = 'flex flex-col gap-3 rounded-xl border border-border bg-card p-4'
const field = 'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground'
const label = 'flex flex-col gap-1.5 text-xs font-semibold text-foreground'
const hint = 'text-xs font-normal leading-relaxed text-muted-foreground'
const ghost = 'h-9 rounded-lg border border-border px-3 text-xs font-bold text-foreground hover:bg-secondary disabled:opacity-40'
const solid = 'h-9 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-40'
const when = (iso: string) => new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })

type Draft = Omit<GoalEventInput, 'perGoal' | 'siteId'> & { perGoal: string; siteId: string }

const blank = (category: GoalCategory): Draft => ({ id: null, title: '', category, perGoal: category === 'sponsor' ? '20' : '10', unit: category === 'sponsor' ? 'freebet' : 'KC', siteId: '', viaLink: category === 'sponsor', minBet: '', terms: '', active: true })
const draftOf = (e: GoalEventView): Draft => ({ id: e.id, title: e.title, category: e.category, perGoal: String(e.perGoal), unit: e.unit, siteId: e.siteId === null ? '' : String(e.siteId), viaLink: e.viaLink, minBet: e.minBet, terms: e.terms, active: e.active })
const inputOf = (d: Draft) => ({ ...d, perGoal: d.perGoal.trim() === '' ? NaN : Number(d.perGoal), siteId: d.siteId === '' ? null : Number(d.siteId) })

function EventSheet({ initial, sites, onClose, onSaved }: { initial: Draft; sites: GoalAdminData['sites']; onClose: () => void; onSaved: () => void }) {
  const { pending, status, run } = usePanelAction()
  const [d, setD] = useState<Draft>(initial)
  const sponsor = d.category === 'sponsor'
  const checked = checkGoalEvent(inputOf(d))
  const perGoal = Number(d.perGoal)
  const example = Number.isInteger(perGoal) && perGoal > 0 ? `Örnek: takım 5 gol atarsa üye ${goalAmount(goalReward(perGoal, 5), sponsor ? d.unit || 'ödül' : 'KC')} kazanır.` : ''
  const siteName = sites.find((s) => s.id === d.siteId)?.name ?? null
  const preview = sponsor ? goalConditions({ category: 'sponsor', viaLink: d.viaLink, minBet: d.minBet.trim(), terms: d.terms.trim(), siteName }) : []

  return (
    <SideSheet
      title={d.id ? 'Etkinliği düzenle' : sponsor ? 'Yeni sponsor etkinliği' : 'Yeni Alkanka etkinliği'}
      eyebrow="Gol başı ödül"
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          {!checked.ok && (
            <p role="alert" className="text-xs font-medium text-destructive">
              {checked.error}
            </p>
          )}
          <StatusLine status={status} />
          <button
            type="button"
            disabled={pending || !checked.ok}
            onClick={() =>
              run(
                () => saveGoalEventAction(inputOf(d)),
                () => {
                  onSaved()
                  onClose()
                },
              )
            }
            className="h-11 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-40"
          >
            {pending ? 'Kaydediliyor...' : d.id ? 'Değişiklikleri kaydet' : 'Etkinliği aç'}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {!d.id && (
          <div role="radiogroup" aria-label="Etkinlik türü" className="grid grid-cols-2 gap-2">
            {GOAL_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={d.category === c.id}
                onClick={() => setD({ ...blank(c.id), title: d.title })}
                className={cn('flex flex-col gap-1 rounded-lg border p-3 text-left', d.category === c.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary')}
              >
                <span className="text-sm font-bold text-foreground">{c.id === 'alkanka' ? 'Alkanka' : 'Sponsor'}</span>
                <span className={hint}>{c.id === 'alkanka' ? 'Ödül KC. Maç sonuçlanınca kendiliğinden yatar.' : 'Ödülü sponsor verir (freebet, freespin). Şartı sen onaylarsın, teslimi sen işaretlersin.'}</span>
              </button>
            ))}
          </div>
        )}
        {d.id && <p className={hint}>Tür: {sponsor ? 'Sponsor etkinliği' : 'Alkanka etkinliği'}. Etkinliğin türü sonradan değişmez.</p>}

        <label className={label}>
          Etkinlik adı
          <input value={d.title} maxLength={80} onChange={(e) => setD({ ...d, title: e.target.value })} className={field} />
          <span className={hint}>Sitede kartın başlığı olur. Örnek: Derbi haftası gol şöleni.</span>
        </label>

        {sponsor && (
          <label className={label}>
            Sponsor
            <select value={d.siteId} onChange={(e) => setD({ ...d, siteId: e.target.value })} className={field}>
              <option value="">Sponsor seç</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>
            Gol başı ödül
            <input inputMode="numeric" value={d.perGoal} onChange={(e) => setD({ ...d, perGoal: e.target.value.replace(/\D/g, '').slice(0, 5) })} className={field} />
            <span className={hint}>1 - {GOAL_MAX_PER_GOAL.toLocaleString('tr-TR')}</span>
          </label>
          <label className={label}>
            Ödülün adı
            <input value={sponsor ? d.unit : 'KC'} disabled={!sponsor} maxLength={24} onChange={(e) => setD({ ...d, unit: e.target.value })} className={cn(field, !sponsor && 'opacity-60')} />
            <span className={hint}>{sponsor ? 'Sponsorun verdiği şey: freebet, freespin, TL bonus.' : 'Alkanka etkinliğinde ödül her zaman KC.'}</span>
          </label>
        </div>
        {example && <p className={hint}>{example}</p>}
        {d.id && <p className={hint}>Gol başı ödülü değiştirirsen sadece henüz kimsenin seçim yapmadığı maçlar yeni rakama geçer. Seçim yapılmış maçlar üyeye söz verilen eski rakamla ödenir.</p>}

        {sponsor && (
          <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <legend className="px-1 text-xs font-bold text-foreground">Katılım şartı (kartta yazar)</legend>
            <label className="flex items-start gap-2 text-xs font-semibold text-foreground">
              <input type="checkbox" checked={d.viaLink} onChange={(e) => setD({ ...d, viaLink: e.target.checked })} className="mt-0.5 size-4 accent-primary" />
              <span>Üyeliğini Alkanka linkiyle açmış olmalı</span>
            </label>
            <label className={label}>
              En az bahis tutarı
              <input value={d.minBet} maxLength={40} placeholder="100 TL" onChange={(e) => setD({ ...d, minBet: e.target.value })} className={field} />
              <span className={hint}>Şart yoksa boş bırak.</span>
            </label>
          </fieldset>
        )}

        <label className={label}>
          {sponsor ? 'Ek şart ve açıklama' : 'Kurallar (isteğe bağlı)'}
          <textarea value={d.terms} maxLength={600} rows={3} onChange={(e) => setD({ ...d, terms: e.target.value })} className={cn(field, 'h-auto py-2 leading-relaxed')} />
        </label>

        {preview.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-lg bg-secondary/60 p-3">
            <p className="text-xs font-bold text-foreground">Üyenin kartta göreceği şart</p>
            <ul className="flex list-disc flex-col gap-1 pl-4 text-xs leading-relaxed text-muted-foreground">
              {preview.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        <label className="flex items-start gap-2 text-xs font-semibold text-foreground">
          <input type="checkbox" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} className="mt-0.5 size-4 accent-primary" />
          <span className="flex flex-col gap-0.5">
            Sitede yayında
            <span className={hint}>Kapatırsan etkinlik siteden kalkar ve yeni seçim alınmaz; kayıtları ve katılımcı listesi panelde durur.</span>
          </span>
        </label>
      </div>
    </SideSheet>
  )
}

function AddMatch({ eventId, onSaved }: { eventId: number; onSaved: () => void }) {
  const { pending, status, run } = usePanelAction()
  const [f, setF] = useState({ league: '', home: '', away: '', kickoff: '' })
  const put = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const past = f.kickoff !== '' && new Date(f.kickoff).getTime() < Date.now()
  return (
    <form
      className="flex flex-col gap-3 rounded-lg bg-secondary/50 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(
          () => createGoalMatch(eventId, { ...f, kickoff: new Date(f.kickoff).toISOString() }),
          () => {
            setF({ ...f, home: '', away: '', kickoff: '' })
            onSaved()
          },
        )
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={label}>
          Ev sahibi
          <input value={f.home} maxLength={80} onChange={put('home')} className={field} />
        </label>
        <label className={label}>
          Deplasman
          <input value={f.away} maxLength={80} onChange={put('away')} className={field} />
        </label>
        <label className={label}>
          Lig (isteğe bağlı)
          <input value={f.league} maxLength={80} onChange={put('league')} className={field} />
        </label>
        <label className={label}>
          Maç saati
          <input type="datetime-local" value={f.kickoff} onChange={put('kickoff')} className={field} />
        </label>
      </div>
      {past && (
        <p role="alert" className="text-xs font-medium text-destructive">
          Maç saati geçmişte. Seçimler maç başlarken kapanır; ileri bir saat gir.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending || !f.home.trim() || !f.away.trim() || !f.kickoff || past} className={solid}>
          {pending ? 'Ekleniyor...' : 'Maçı ekle'}
        </button>
        <StatusLine status={status} />
      </div>
    </form>
  )
}

function MatchRow({ event, m, now, onChanged, onOpenPicks }: { event: GoalEventView; m: GoalMatch; now: number; onChanged: () => void; onOpenPicks: () => void }) {
  const { pending, status, run } = usePanelAction()
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const picks = m.homePicks + m.awayPicks
  const started = Date.parse(m.kickoff) <= now
  const waiting = m.status === 'open' && started
  const score = checkGoalScore(home, away)
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 2)

  const finish = async () => {
    if (!score.ok) return
    const owed = goalReward(m.perGoal, score.home) * m.homePicks + goalReward(m.perGoal, score.away) * m.awayPicks
    const pay = event.category === 'sponsor' ? `${picks} seçim hesaplanır, toplam ${goalAmount(owed, event.unit)} hak edilir (teslimi sen işaretlersin).` : `${picks} seçim hesaplanır ve toplam ${goalAmount(owed, 'KC')} üyelere hemen yatırılır.`
    if (!(await askConfirm(`${m.home} ${score.home} - ${score.away} ${m.away} olarak sonuçlandırılsın mı? ${pay} Sonuç bir kez girilir, sonradan değiştirilemez.`))) return
    run(() => finishGoalMatch(m.id, score.home, score.away), onChanged)
  }

  return (
    <li className="flex flex-col gap-2 border-t border-border py-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-64 flex-col gap-0.5">
          <p className="text-sm font-semibold text-foreground">
            {m.home}
            {m.status === 'settled' ? ` ${m.homeGoals} - ${m.awayGoals} ` : ' - '}
            {m.away}
          </p>
          <p className="text-xs text-muted-foreground">
            {m.league ? `${m.league} · ` : ''}
            {when(m.kickoff)} · <span className={cn('font-semibold', m.status === 'void' ? 'text-destructive' : waiting ? 'text-primary' : 'text-foreground')}>{goalStatusLabel(m, now)}</span> · gol başı {goalAmount(m.perGoal, event.unit)}
            {m.extId === null ? '' : ' · takvim maçı, sonucu kendiliğinden gelir'}
          </p>
          <p className="text-xs text-muted-foreground">
            {picks === 0 ? 'Henüz seçim yok.' : `${m.home}: ${m.homePicks} seçim · ${m.away}: ${m.awayPicks} seçim`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {picks > 0 && (
            <button type="button" onClick={onOpenPicks} className={ghost}>
              Katılımcılar ({picks})
            </button>
          )}
          {m.status === 'open' && picks > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                if (await askConfirm(`${m.home} - ${m.away} iptal edilsin mi? ${picks} seçim için ödül verilmez ve maça artık sonuç girilemez. Bu geri alınamaz.`)) run(() => cancelGoalMatch(m.id), onChanged)
              }}
              className={ghost}
            >
              İptal et
            </button>
          )}
          {m.status === 'open' && picks === 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                if (await askConfirm(`${m.home} - ${m.away} silinsin mi?`)) run(() => removeGoalMatch(m.id), onChanged)
              }}
              className={ghost}
            >
              Sil
            </button>
          )}
        </div>
      </div>
      {waiting && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg bg-secondary/50 p-3">
          <label className={cn(label, 'w-28')}>
            <span className="truncate">{m.home}</span>
            <input inputMode="numeric" aria-label={`${m.home} gol sayısı`} value={home} onChange={(e) => setHome(digits(e.target.value))} className={field} />
          </label>
          <label className={cn(label, 'w-28')}>
            <span className="truncate">{m.away}</span>
            <input inputMode="numeric" aria-label={`${m.away} gol sayısı`} value={away} onChange={(e) => setAway(digits(e.target.value))} className={field} />
          </label>
          <button type="button" disabled={pending || !score.ok} onClick={finish} className={cn(solid, 'h-10')}>
            {pending ? 'İşleniyor...' : 'Sonucu gir'}
          </button>
          <span className={cn(hint, 'basis-full')}>Uzatmaya giden maçta 90 dakikanın skoru girilir. En fazla {GOAL_MAX_GOALS} gol.</span>
        </div>
      )}
      <StatusLine status={status} />
    </li>
  )
}

function PicksSheet({ matchId, onClose, onChanged }: { matchId: number; onClose: () => void; onChanged: () => void }) {
  const { data, isLoading, mutate } = useSWR(['goal-picks', matchId], () => loadGoalPicks(matchId))
  const { pending, status, run } = usePanelAction()
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const refresh = () => {
    setPicked(new Set())
    void mutate()
    onChanged()
  }

  if (isLoading || !data) {
    return (
      <SideSheet title="Katılımcılar" eyebrow="Gol başı ödül" onClose={onClose} size="xl" guard="marked">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Liste okunuyor...
        </p>
      </SideSheet>
    )
  }
  if (!data.ok) {
    return (
      <SideSheet title="Katılımcılar" eyebrow="Gol başı ödül" onClose={onClose} size="xl" guard="marked">
        <p role="alert" className="text-sm font-medium text-destructive">
          {data.error}
        </p>
      </SideSheet>
    )
  }

  const { event, match, picks } = data.data
  const sponsor = event.category === 'sponsor'
  const needle = query.trim().toLocaleLowerCase('tr')
  const shown = needle ? picks.filter((p) => `${p.userName} ${p.siteUsername ?? ''}`.toLocaleLowerCase('tr').includes(needle)) : picks
  const ids = [...picked].filter((id) => shown.some((p) => p.userId === id))
  const allOn = shown.length > 0 && shown.every((p) => picked.has(p.userId))
  const totals = goalPickTotals(picks, sponsor)
  const failed = totals.failed

  const download = () => {
    const url = URL.createObjectURL(new Blob([goalPicksCsv(match, event.unit, sponsor, shown)], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `gol-basi-odul-${match.home}-${match.away}.csv`.replace(/[^\w.\-ğüşıöçĞÜŞİÖÇ]+/g, '-')
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <SideSheet title={`${match.home} - ${match.away}`} eyebrow={`${event.title} · katılımcılar`} onClose={onClose} size="xl" guard="marked">
      <div className="flex flex-col gap-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          {picks.length} seçim · {goalStatusLabel(match, Date.now())}
          {match.status === 'settled'
            ? ` · ${match.homeGoals} - ${match.awayGoals} · ${sponsor ? 'verilecek' : 'kazanılan'} ${goalAmount(totals.owed, event.unit)}, ${sponsor ? 'teslim edilen' : 'ödenen'} ${goalAmount(totals.done, event.unit)}${totals.refused ? `, şart sağlanmadığı için verilmeyen ${goalAmount(totals.refused, event.unit)}` : ''}`
            : ''}
          {sponsor ? '. Önce üyenin sponsorun şartını sağladığını onayla; ödülü sponsor tanımlayınca "Teslim edildi" olarak işaretle.' : '. Alkanka ödülleri sonuç girilince kendiliğinden yatar.'}
        </p>
        {failed > 0 && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-foreground">
            {failed} ödeme yazılamadı. Yazılamayan ödül üyeye yatmadı; site ziyaret edildikçe yaklaşık 10 dakikada bir kendiliğinden yeniden denenir. Beklemek istemezsen satırdaki &quot;Yeniden dene&quot; düğmesine bas.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Üye ya da kullanıcı adı ara" aria-label="Katılımcılarda ara" className={cn(field, 'max-w-xs')} />
          <button type="button" onClick={download} disabled={shown.length === 0} className={cn(ghost, 'flex items-center gap-1.5')}>
            <Download className="size-3.5" aria-hidden="true" /> Excel indir
          </button>
        </div>

        {sponsor && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-secondary/50 p-3">
            <span className="text-xs font-semibold text-foreground">{ids.length} üye seçili</span>
            <button type="button" disabled={pending || !ids.length} onClick={() => run(() => approveGoalPicks(matchId, ids, 'approved'), refresh)} className={solid}>
              Şartı onayla
            </button>
            <button type="button" disabled={pending || !ids.length} onClick={() => run(() => approveGoalPicks(matchId, ids, 'rejected'), refresh)} className={ghost}>
              Şart sağlanmadı
            </button>
            <button type="button" disabled={pending || !ids.length || match.status !== 'settled'} onClick={() => run(() => deliverGoalPicks(matchId, ids, true), refresh)} className={ghost}>
              Teslim edildi
            </button>
            <button type="button" disabled={pending || !ids.length} onClick={() => run(() => deliverGoalPicks(matchId, ids, false), refresh)} className={ghost}>
              Teslimi geri al
            </button>
          </div>
        )}
        <StatusLine status={status} />

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="bg-secondary/60 text-muted-foreground">
              <tr>
                {sponsor && (
                  <th scope="col" className="w-10 p-2">
                    <input
                      type="checkbox"
                      aria-label="Listedeki herkesi seç"
                      checked={allOn}
                      onChange={() => setPicked(allOn ? new Set() : new Set(shown.map((p) => p.userId)))}
                      className="size-4 accent-primary"
                    />
                  </th>
                )}
                <th scope="col" className="p-2 font-semibold">Üye</th>
                {sponsor && <th scope="col" className="p-2 font-semibold">Sponsordaki adı</th>}
                {sponsor && <th scope="col" className="p-2 font-semibold">Şart</th>}
                <th scope="col" className="p-2 font-semibold">Takım</th>
                <th scope="col" className="p-2 text-right font-semibold">Gol</th>
                <th scope="col" className="p-2 text-right font-semibold">Ödül</th>
                <th scope="col" className="p-2 font-semibold">Durum</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.userId} className="border-t border-border text-foreground">
                  {sponsor && (
                    <td className="p-2">
                      <input
                        type="checkbox"
                        aria-label={`${p.userName} seç`}
                        checked={picked.has(p.userId)}
                        onChange={() =>
                          setPicked((prev) => {
                            const next = new Set(prev)
                            if (next.has(p.userId)) next.delete(p.userId)
                            else next.add(p.userId)
                            return next
                          })
                        }
                        className="size-4 accent-primary"
                      />
                    </td>
                  )}
                  <td className="p-2 font-semibold">{p.userName}</td>
                  {sponsor && <td className="p-2">{p.siteUsername ?? '-'}</td>}
                  {sponsor && <td className={cn('p-2', p.approval === 'approved' ? 'text-success' : p.approval === 'rejected' ? 'text-destructive' : 'text-muted-foreground')}>{GOAL_APPROVAL_LABEL[p.approval]}</td>}
                  <td className="p-2">{p.side === 'home' ? match.home : match.away}</td>
                  <td className="p-2 text-right tabular-nums">{p.goals ?? '-'}</td>
                  <td className="p-2 text-right tabular-nums">{p.reward === null ? '-' : goalAmount(p.reward, event.unit)}</td>
                  <td className="p-2">
                    <span className={cn(p.payError && 'font-semibold text-destructive')}>{goalPickState(p, sponsor, match.status)}</span>
                    {p.payError && (
                      <span className="flex flex-col items-start gap-1 pt-1">
                        <span className="text-muted-foreground">{p.payError}</span>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={async () => {
                            // A row marked paid with a note was left half-done by the earlier payment code; only there can the coins already be on the account.
                            const question = p.paid
                              ? `${p.userName} için ${goalAmount(p.reward ?? 0, 'KC')} yeniden yatırılsın mı? Bu satır eski ödeme düzeninden yarım kalmış. Önce üyenin coin dökümüne bak: bu maçın ödülü orada varsa ikinci kez ödenir.`
                              : `${p.userName} için ${goalAmount(p.reward ?? 0, 'KC')} şimdi yeniden denensin mi? Bu ödül üyeye yatmadı.`
                            if (await askConfirm(question)) run(() => retryGoalPay(matchId, p.userId, p.userName), refresh)
                          }}
                          className={ghost}
                        >
                          Yeniden dene
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={sponsor ? 8 : 5} className="p-4 text-center text-muted-foreground">
                    {picks.length === 0 ? 'Bu maça henüz seçim yapılmadı.' : 'Aramaya uyan katılımcı yok.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {picks.length >= 2000 && <p className={hint}>Liste ilk 2.000 katılımcıyı gösterir.</p>}
      </div>
    </SideSheet>
  )
}

function EventCard({
  event,
  now,
  pins,
  onEdit,
  onChanged,
  onOpenPicks,
}: {
  event: GoalEventView
  now: number
  pins: GoalAdminData['pins']
  onEdit: () => void
  onChanged: () => void
  onOpenPicks: (matchId: number) => void
}) {
  const { pending, status, run } = usePanelAction()
  const [adding, setAdding] = useState<'feed' | 'manual' | null>(event.matches.length === 0 ? 'feed' : null)
  const taken = event.matches.flatMap((m) => (m.extId === null ? [] : [m.extId]))
  const sponsor = event.category === 'sponsor'
  const joined = event.matches.reduce((s, m) => s + m.homePicks + m.awayPicks, 0)
  const waiting = event.matches.filter((m) => m.status === 'open' && Date.parse(m.kickoff) <= now).length
  return (
    <section aria-label={event.title} data-find={`goal-${event.id}`} className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-72 flex-col gap-1">
          <h3 className="font-display text-base font-bold text-foreground">{event.title}</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {sponsor ? `Sponsor etkinliği · ${event.siteName ?? 'sponsor silinmiş'}` : 'Alkanka etkinliği'} · gol başı <b className="text-foreground">{goalAmount(event.perGoal, event.unit)}</b> ·{' '}
            <span className={cn('font-semibold', event.active ? 'text-success' : 'text-destructive')}>{event.active ? 'yayında' : 'kapalı'}</span> · {event.matches.length} maç · {joined} seçim
          </p>
          {event.active && event.matches.length === 0 && <p className="text-xs font-medium text-destructive">Maçı olmayan etkinlik sitede görünmez. Takvimden maç al ya da elle ekle.</p>}
          {waiting > 0 && <p className="text-xs font-semibold text-primary">{waiting} maç sonuç bekliyor.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setAdding(adding === 'feed' ? null : 'feed')} aria-expanded={adding === 'feed'} className={ghost}>
            {adding === 'feed' ? 'Takvimi kapat' : 'Takvimden maç al'}
          </button>
          <button type="button" onClick={() => setAdding(adding === 'manual' ? null : 'manual')} aria-expanded={adding === 'manual'} className={ghost}>
            {adding === 'manual' ? 'Elle eklemeyi kapat' : 'Elle maç ekle'}
          </button>
          <button type="button" onClick={onEdit} className={ghost}>
            Düzenle
          </button>
          {joined === 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                if (await askConfirm(`"${event.title}" etkinliği ${event.matches.length ? `${event.matches.length} maçıyla birlikte ` : ''}silinsin mi?`)) run(() => removeGoalEvent(event.id, event.title), onChanged)
              }}
              className={ghost}
            >
              Sil
            </button>
          )}
        </div>
      </div>
      <StatusLine status={status} />
      {adding === 'feed' && <GoalFixturePicker eventId={event.id} taken={taken} pins={pins} onSaved={onChanged} onPinsChanged={onChanged} />}
      {adding === 'manual' && <AddMatch eventId={event.id} onSaved={onChanged} />}
      {event.matches.length > 0 && (
        <ul className="flex flex-col">
          {[...event.matches]
            .sort((a, b) => Number(a.status !== 'open') - Number(b.status !== 'open') || a.kickoff.localeCompare(b.kickoff))
            .map((m) => (
              <MatchRow key={m.id} event={event} m={m} now={now} onChanged={onChanged} onOpenPicks={() => onOpenPicks(m.id)} />
            ))}
        </ul>
      )}
    </section>
  )
}

export function GoalAdmin() {
  const { data, isLoading, mutate } = useSWR('goal-admin', loadGoalAdmin)
  const [editing, setEditing] = useState<{ draft: ReturnType<typeof blank>; key: number } | null>(null)
  const [picksFor, setPicksFor] = useState<number | null>(null)
  const [filter, setFilter] = useState<GoalCategory | 'all'>('all')
  const reload = () => void mutate()

  if (isLoading || !data) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Etkinlikler okunuyor...
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

  const { events, sites, pins } = data.data
  const now = Date.now()
  const shown = filter === 'all' ? events : events.filter((e) => e.category === filter)
  const count = (c: GoalCategory) => events.filter((e) => e.category === c).length
  const open = (category: GoalCategory) => setEditing({ draft: blank(category), key: Date.now() })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Etkinlik türü süzgeci" className="flex flex-wrap gap-1 rounded-lg border border-border bg-background p-1">
          {([['all', `Hepsi (${events.length})`], ['alkanka', `Alkanka (${count('alkanka')})`], ['sponsor', `Sponsor (${count('sponsor')})`]] as const).map(([id, text]) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} className={cn('h-9 rounded-md px-3 text-xs font-bold', filter === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {text}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => open('alkanka')} className={cn(solid, 'flex h-10 items-center gap-1.5')}>
            <Plus className="size-4" aria-hidden="true" /> Alkanka etkinliği
          </button>
          <button type="button" onClick={() => open('sponsor')} className={cn(ghost, 'flex h-10 items-center gap-1.5')}>
            <Plus className="size-4" aria-hidden="true" /> Sponsor etkinliği
          </button>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm leading-relaxed text-muted-foreground">
          {events.length === 0 ? 'Henüz gol başı ödül etkinliği yok. Bir etkinlik aç, gol başı ödülü belirle, sonra maçlarını ekle.' : 'Bu türde etkinlik yok.'}
        </p>
      ) : (
        shown.map((e) => <EventCard key={e.id} event={e} now={now} pins={pins} onEdit={() => setEditing({ draft: draftOf(e), key: e.id })} onChanged={reload} onOpenPicks={setPicksFor} />)
      )}

      {editing && <EventSheet key={editing.key} initial={editing.draft} sites={sites} onClose={() => setEditing(null)} onSaved={reload} />}
      {picksFor !== null && <PicksSheet key={picksFor} matchId={picksFor} onClose={() => setPicksFor(null)} onChanged={reload} />}
    </div>
  )
}
