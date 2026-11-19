'use client'

import { useActionState, useState, type ReactNode } from 'react'
import { BookmarkPlus, ChevronRight, EyeOff, Loader2, Play, Plus, Search, Trash2, UserX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { HideButton } from '@/components/panel/hide-button'
import { RecordLink } from '@/components/panel/record-link'
import { SideSheet } from '@/components/panel/side-sheet'
import { TournamentGuide } from '@/components/panel/area-guides'
import { Feedback, RunningForm, TournamentForm, field, labelCls, lengthText } from '@/components/panel/tournament-form'
import { TournamentMatches } from '@/components/panel/tournament-matches'
import { Flash } from '@/components/panel/flash'
import { ARENA_META } from '@/lib/arena'
import {
  FINISH_LABEL,
  FORMAT_SHORT,
  PACE_MS,
  PACE_SHORT,
  SOURCE_LABEL,
  STATUS_LABEL,
  TABLE_PASS,
  TOURNAMENT_STATUSES,
  matchLengthOf,
  type Tournament,
  type TournamentStatus,
  type TournamentTemplate,
} from '@/lib/tournaments-shared'
import { isDecided, isRealMatch, openRound, type Match } from '@/lib/bracket'
import { PrizeList } from '@/components/alkanka/arena/prize-list'
import { LeagueView } from '@/components/alkanka/arena/league-view'
import { PointsView } from '@/components/alkanka/arena/points-view'
import { BracketView } from '@/components/alkanka/arena/bracket-view'
import { PlayerStats } from '@/components/alkanka/arena/player-stats'
import { formatTR } from '@/components/alkanka/arena/tournament-card'
import { beginTournament, dropTournamentTemplate, keepTournamentTemplate, kickEntry, pickMatchWinner, removeTournament, stopTournament } from '@/app/panel/arena-actions'
import type { ActionState } from '@/app/panel/actions'

const shortDate = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const when = (iso: string | null) => (iso ? shortDate.format(new Date(iso)) : 'yok')

const STATUS_TONE: Record<TournamentStatus, string> = {
  kayit: 'bg-primary/15 text-primary',
  basladi: 'bg-success/15 text-success',
  bitti: 'bg-secondary text-muted-foreground',
  iptal: 'bg-destructive/15 text-destructive',
}

/** The format's own choices in a few words: what kind of league, or how big the tables are. */
function shapeText(t: Tournament) {
  if (t.format === 'puan') return `${SOURCE_LABEL[t.league.source].toLocaleLowerCase('tr')} · ${t.league.maxGames ? `ilk ${t.league.maxGames} oyun` : 'oyun sınırı yok'}`
  if (t.format === 'lig') return `${PACE_SHORT[t.league.pace]} · ${t.league.legs === 2 ? 'çift devre' : 'tek devre'}`
  return t.tableSize > 2 ? `${t.tableSize} kişilik masa` : 'birebir'
}

function ActionButton({
  act,
  fields,
  children,
  variant = 'ghost',
  confirm,
}: {
  act: (s: ActionState, f: FormData) => Promise<ActionState>
  fields: Record<string, string | number>
  children: ReactNode
  variant?: 'primary' | 'ghost' | 'danger'
  confirm?: string
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(act, {})
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const form = e.currentTarget
        if (!confirm || form.dataset.confirmed === '1') {
          delete form.dataset.confirmed
          return
        }
        e.preventDefault()
        void askConfirm(confirm).then((ok) => {
          if (!ok) return
          form.dataset.confirmed = '1'
          form.requestSubmit()
        })
      }}
      className="flex flex-col gap-1"
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        type="submit"
        disabled={pending}
        className={cn(
          'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-60',
          variant === 'primary' && 'bg-primary text-primary-foreground',
          variant === 'ghost' && 'border border-border text-foreground hover:bg-secondary',
          variant === 'danger' && 'border border-destructive/50 text-destructive hover:bg-destructive/10',
        )}
      >
        {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
        {children}
      </button>
      <Flash ok={false} text={state.ok ? null : state.message} token={state} className="text-xs" />
    </form>
  )
}

function WinnerPicker({ t, round, match, players, winner }: { t: Tournament; round: number; match: number; players: (string | null)[]; winner: string | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(pickMatchWinner, {})
  const real = players.filter((p): p is string => Boolean(p))
  return (
    <form action={action} className="flex items-center gap-1.5">
      <input type="hidden" name="id" value={t.id} />
      <input type="hidden" name="round" value={round} />
      <input type="hidden" name="match" value={match} />
      <label className="sr-only" htmlFor={`w-${t.id}-${round}-${match}`}>
        Kazanan
      </label>
      <select
        id={`w-${t.id}-${round}-${match}`}
        name="winner"
        key={winner ?? ''}
        defaultValue={winner ?? ''}
        disabled={pending || real.length < 2}
        onChange={(e) => {
          const select = e.currentTarget
          const picked = select.value
          if (!picked) {
            select.value = winner ?? ''
            return
          }
          void askConfirm(
            t.tableSize > 2
              ? `"${t.names[picked] ?? picked}" bu masanın birincisi olarak işaretlensin mi? Masa kapanır; diğer oyuncular oyunun o anki durumuna göre sıralanır ve tur atlayanlar buna göre belirlenir. Bu final masasıysa turnuva biter ve ödüller hemen ödenir; geri alınamaz.`
              : `"${t.names[picked] ?? picked}" bu maçın kazananı olarak işaretlensin mi? Bu son maçsa turnuva biter ve ödül havuzu hemen ödenir; geri alınamaz.`,
          ).then((ok) => {
            if (ok) select.form?.requestSubmit()
            else select.value = winner ?? ''
          })
        }}
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
      >
        <option value="">{t.tableSize > 2 ? 'Masa birincisini seç' : 'Kazanan seç'}</option>
        {real.map((p, i) => (
          <option key={`${i}-${p}`} value={p}>
            {t.names[p] ?? p}
          </option>
        ))}
      </select>
      {pending && <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden="true" />}
      {!state.ok && state.message && (
        <span role="alert" className="text-xs font-semibold text-destructive">
          {state.message}
        </span>
      )}
    </form>
  )
}

function Fact({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-xs font-semibold text-muted-foreground">{name}</dt>
      <dd className="min-w-0 text-sm font-semibold text-foreground">{children}</dd>
    </div>
  )
}

function Summary({ t, hidden }: { t: Tournament; hidden: boolean }) {
  const points = t.format === 'puan'
  const length = matchLengthOf(t.game, t.matchLength)
  return (
    <div className="flex flex-col gap-5">
      <RecordLink kind="turnuva" id={t.id} name={t.title} />
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 rounded-xl border border-border p-4">
        <Fact name="Oyun">{ARENA_META[t.game].title}</Fact>
        <Fact name="Düzen">{`${FORMAT_SHORT[t.format]} · ${shapeText(t)}`}</Fact>
        <Fact name="Başlangıç">
          <span className="capitalize">{formatTR(t.startsAt)}</span>
        </Fact>
        <Fact name="Bitiş">{t.endsAt ? <span className="capitalize">{formatTR(t.endsAt)}</span> : 'Bitiş saati yok (eski turnuva): kendiliğinden kapanmaz'}</Fact>
        <Fact name="Kayıt">{`${t.entries.length} / ${t.maxPlayers} oyuncu`}</Fact>
        <Fact name="Katılım ücreti">{t.entryFee > 0 ? `${t.entryFee.toLocaleString('tr-TR')} KC` : 'Ücretsiz'}</Fact>
        <Fact name="Ödül havuzu">{`${t.prizePool.toLocaleString('tr-TR')} KC`}</Fact>
        {!points && <Fact name="Maça giriş süresi">{`${t.joinMinutes} dakika`}</Fact>}
        {!points && length && <Fact name="Maç uzunluğu">{length.label}</Fact>}
        {t.status === 'basladi' && t.nextRoundAt && (
          <Fact name="Sıradaki tur">
            <span className="capitalize">{formatTR(t.nextRoundAt)}</span>
          </Fact>
        )}
        {t.finishReason && (
          <Fact name={t.status === 'iptal' ? 'İptal nedeni' : 'Kapanış'}>
            {FINISH_LABEL[t.finishReason]}
            {t.finishedAt && <span className="font-normal capitalize text-muted-foreground"> · {formatTR(t.finishedAt)}</span>}
          </Fact>
        )}
        {t.winner && (
          <Fact name="Şampiyon">
            <span className="text-primary">{t.winner}</span>
          </Fact>
        )}
      </dl>
      {t.description && <p className="text-sm leading-relaxed text-muted-foreground">{t.description}</p>}
      <PrizeList t={t} />
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-foreground">İşlemler</h3>
        <div className="flex flex-wrap gap-2">
          {t.status === 'kayit' && (
            <ActionButton
              act={beginTournament}
              fields={{ id: t.id }}
              variant="primary"
              confirm={
                points
                  ? 'Başlangıç saati beklenmeden kayıtlar kapanacak ve puan ligi hemen başlayacak. Bu andan sonra biten oyunlar sayılır.'
                  : t.format === 'lig' && PACE_MS[t.league.pace]
                    ? `Başlangıç saati beklenmeden kayıtlar kapanacak ve ilk tur hemen açılacak. Sonraki turlar yine kayıtlı başlangıç saatine göre açılır. Oyuncuların masaya girmek için ${t.joinMinutes} dakikası olur.`
                    : `Başlangıç saati beklenmeden kayıtlar kapanacak ve tüm oyuncular hemen eşleşecek. Oyuncuların masaya girmek için ${t.joinMinutes} dakikası olur.`
              }
            >
              <Play className="size-3.5" aria-hidden="true" />
              Kayıtları kapat ve başlat
            </ActionButton>
          )}
          {(t.status === 'kayit' || t.status === 'basladi') && (
            <ActionButton act={stopTournament} fields={{ id: t.id }} variant="danger" confirm="Turnuva iptal edilecek, açık maçlar kapanacak ve kayıt ücretleri iade edilecek.">
              İptal et
            </ActionButton>
          )}
          <HideButton key={`${t.id}-${hidden}`} kind="tournament" id={t.id} hidden={hidden} label={t.title} className="px-3 py-2" />
          <ActionButton act={removeTournament} fields={{ id: t.id }} variant="danger" confirm="Turnuva ve tüm kayıtlar silinecek.">
            <Trash2 className="size-3.5" aria-hidden="true" />
            Sil
          </ActionButton>
        </div>
      </div>
    </div>
  )
}

function Standings({ t }: { t: Tournament }) {
  const running = t.status === 'basladi'
  const points = t.format === 'puan'
  const order = t.entries.map((e) => e.userId ?? `misafir:${e.nickname}`)
  const playing = running && t.bracket ? openRound(t.bracket) : -1
  /** A result can be named only for a match of the round being played: a written one never changes. */
  const canPick = (round: number, m: Match) => round === playing && isRealMatch(m) && !isDecided(m)
  return (
    <div className="flex flex-col gap-5">
      {t.bracket && t.format === 'lig' && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-foreground">
            {running ? 'Puan durumu ve fikstür (açık bir maçta kazananı elle seçebilirsin; tur bitince sonraki tur açılır)' : 'Puan durumu ve fikstür'}
          </h3>
          <LeagueView
            bracket={t.bracket}
            names={t.names}
            order={order}
            schedule={{ startsAt: t.startsAt, pace: t.league.pace }}
            renderPick={(r, m, match) => (canPick(r, match) ? <WinnerPicker t={t} round={r} match={m} players={match.players} winner={null} /> : null)}
          />
        </div>
      )}
      {points && t.points && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-foreground">
            {running ? 'Puan durumu (oyuncuların kendi oyunlarından; lig bitiş saatinde kapanır ve ödüller bu sıraya göre ödenir)' : 'Puan durumu'}
          </h3>
          <PointsView rows={t.points} names={t.names} maxGames={t.league.maxGames} closed={!running} />
        </div>
      )}
      {t.bracket && t.format === 'eleme' && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-foreground">
            {!running
              ? t.tableSize > 2
                ? 'Masalar'
                : 'Eşleşmeler'
              : t.tableSize > 2
                ? `Masalar (her masanın ilk ${t.bracket.pass ?? TABLE_PASS} oyuncusu tur atlar; açık bir masada birinciyi elle seçebilirsin)`
                : 'Eşleşmeler (açık bir maçta kazananı elle seçebilirsin; kazanan bir üst tura geçer)'}
          </h3>
          <BracketView
            bracket={t.bracket}
            names={t.names}
            closed={!running}
            renderPick={(r, m, match) => {
              if (!canPick(r, match)) return null
              if (t.tableSize <= 2) return <WinnerPicker t={t} round={r} match={m} players={match.players} winner={null} />
              // A shared table's result is read from the open table, so only the players still seated at it can be named.
              const open = t.liveMatches.find((live) => live.round === r && live.match === m && live.status === 'oynaniyor')
              return open ? <WinnerPicker t={t} round={r} match={m} players={open.players} winner={null} /> : null
            }}
          />
          <h3 className="mt-2 text-sm font-bold text-foreground">Oyuncu durumu</h3>
          <PlayerStats bracket={t.bracket} names={t.names} order={order} closed={!running} />
        </div>
      )}
      {t.bracket && !points && <TournamentMatches id={t.id} running={running} />}
    </div>
  )
}

function Entries({ t }: { t: Tournament }) {
  if (t.entries.length === 0) return <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Henüz kayıt yok.</p>
  return (
    <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
      {t.entries.map((e, i) => (
        <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
          <span className="flex min-w-0 items-center gap-3">
            <span className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
            <span className="truncate font-semibold text-foreground">{e.nickname}</span>
            <span className="truncate text-muted-foreground">{e.telegram}</span>
          </span>
          {t.status === 'kayit' && (
            <ActionButton act={kickEntry} fields={{ entryId: e.id }} variant="danger" confirm={`${e.nickname} turnuvadan çıkarılsın mı? Katılım ücreti iade edilir.`}>
              <UserX className="size-3.5" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Çıkar</span>
            </ActionButton>
          )}
        </li>
      ))}
    </ul>
  )
}

function TemplateSaver({ t }: { t: Tournament }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(keepTournamentTemplate, {})
  return (
    <form action={action} data-no-guard className="flex flex-col gap-3">
      <input type="hidden" name="id" value={t.id} />
      <p className="text-sm leading-relaxed text-muted-foreground">
        Oyun, format, lig ayarları (tur aralığı, devre, sayılan oyunlar), ad, açıklama, kontenjan, ücret, ödül, başlangıç saati, turnuvanın süresi (başlangıçtan bitişe), maç uzunluğu ve maça giriş süresi saklanır. Tarih, oyuncular ve sonuçlar saklanmaz. Aynı adla kaydedersen eski şablonun üzerine yazılır.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className={cn(labelCls, 'min-w-0 flex-1 basis-60')}>
          Şablon adı
          <input name="name" required minLength={3} maxLength={60} defaultValue={t.title.slice(0, 60)} className={field} />
        </label>
        <button type="submit" disabled={pending} className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-foreground hover:bg-secondary disabled:opacity-60">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <BookmarkPlus className="size-4" aria-hidden="true" />}
          Şablonu kaydet
        </button>
      </div>
      <Feedback state={state} />
    </form>
  )
}

type DetailTab = 'ozet' | 'tablo' | 'oyuncular' | 'duzenle' | 'sablon'

/** One tournament in the side pane. The edit form stays in the page while another tab is shown, so nothing typed is lost. */
function TournamentDetail({ t, hidden, onSaved }: { t: Tournament; hidden: boolean; onSaved: () => void }) {
  const [tab, setTab] = useState<DetailTab>('ozet')
  const editable = t.status === 'kayit' || t.status === 'basladi'
  const points = t.format === 'puan'
  const hasTable = Boolean(t.bracket) || Boolean(points && t.points)
  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'ozet', label: 'Özet' },
    ...(hasTable ? [{ id: 'tablo' as const, label: points ? 'Puan durumu' : t.format === 'lig' ? 'Fikstür' : t.tableSize > 2 ? 'Masalar' : 'Eşleşmeler' }] : []),
    { id: 'oyuncular', label: `Katılımcılar (${t.entries.length})` },
    ...(editable ? [{ id: 'duzenle' as const, label: t.status === 'basladi' ? 'Bitiş ve yazılar' : 'Düzenle' }] : []),
    { id: 'sablon', label: 'Şablon' },
  ]
  const active = tabs.some((x) => x.id === tab) ? tab : 'ozet'
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Turnuva bölümleri" className="flex gap-1 overflow-x-auto rounded-xl bg-secondary p-1">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={active === x.id}
            onClick={() => setTab(x.id)}
            className={cn(
              'shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
              active === x.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {x.label}
          </button>
        ))}
      </div>
      {active === 'ozet' && <Summary t={t} hidden={hidden} />}
      {active === 'tablo' && <Standings t={t} />}
      {active === 'oyuncular' && <Entries t={t} />}
      {active === 'sablon' && <TemplateSaver t={t} />}
      {editable && (
        <div data-sheet-guard className={cn(active !== 'duzenle' && 'hidden')}>
          {t.status === 'kayit' ? <TournamentForm key="kayit" t={t} onSaved={onSaved} /> : <RunningForm key="basladi" t={t} onSaved={onSaved} />}
        </div>
      )}
    </div>
  )
}

function TemplatePicker({ templates, picked, onPick }: { templates: TournamentTemplate[]; picked: TournamentTemplate | null; onPick: (t: TournamentTemplate | null) => void }) {
  if (templates.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        Henüz şablon yok. Listeden bir turnuvayı açıp &quot;Şablon&quot; sekmesinden kaydedersen, aynı ayarlarla yenisini buradan tek tıkla açarsın.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3">
      <span className="text-xs font-semibold text-muted-foreground">Şablondan doldur (form dolar, tarihi kontrol edip oluştur)</span>
      <ul className="flex flex-wrap gap-2">
        {templates.map((tpl) => (
          <li key={tpl.id} className="flex items-stretch overflow-hidden rounded-lg border border-border">
            <button
              type="button"
              aria-pressed={picked?.id === tpl.id}
              onClick={() => onPick(picked?.id === tpl.id ? null : tpl)}
              className={cn('flex flex-col items-start gap-0.5 px-3 py-2 text-left text-sm font-semibold', picked?.id === tpl.id ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary')}
            >
              {tpl.name}
              <span className={cn('text-xs font-normal', picked?.id === tpl.id ? 'text-primary-foreground' : 'text-muted-foreground')}>
                {ARENA_META[tpl.game].title} · {FORMAT_SHORT[tpl.format]} · {tpl.maxPlayers} kişi · {tpl.startTime} · {lengthText(tpl.lengthMinutes)}
              </span>
            </button>
            <TemplateRemover tpl={tpl} onDone={() => picked?.id === tpl.id && onPick(null)} />
          </li>
        ))}
      </ul>
      {picked && (
        <button type="button" onClick={() => onPick(null)} className="self-start text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Şablonu bırak, boş formla devam et
        </button>
      )}
    </div>
  )
}

function TemplateRemover({ tpl, onDone }: { tpl: TournamentTemplate; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, form) => {
    const result = await dropTournamentTemplate(prev, form)
    if (result.ok) onDone()
    return result
  }, {})
  return (
    <form
      action={action}
      className="flex border-l border-border"
      onSubmit={(e) => {
        const form = e.currentTarget
        if (form.dataset.confirmed === '1') {
          delete form.dataset.confirmed
          return
        }
        e.preventDefault()
        void askConfirm(`"${tpl.name}" şablonu silinsin mi? Bu şablonla açılmış turnuvalar etkilenmez.`).then((ok) => {
          if (!ok) return
          form.dataset.confirmed = '1'
          form.requestSubmit()
        })
      }}
    >
      <input type="hidden" name="id" value={tpl.id} />
      <button type="submit" disabled={pending} aria-label={`${tpl.name} şablonunu sil`} className="flex w-10 items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-60">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
      </button>
      {!state.ok && state.message && (
        <span role="alert" className="sr-only">
          {state.message}
        </span>
      )}
    </form>
  )
}

type Filter = 'all' | TournamentStatus

const COLUMNS = '@3xl:grid-cols-[minmax(0,2.4fr)_8.5rem_4.5rem_minmax(0,1fr)_minmax(0,1fr)_1rem]'

export function TournamentManager({ tournaments, templates = [], hidden = [] }: { tournaments: Tournament[]; templates?: TournamentTemplate[]; hidden?: string[] }) {
  const [picked, setPicked] = useState<TournamentTemplate | null>(null)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<ActionState>({})
  const [openId, setOpenId] = useState<number | null>(null)
  const [savedCount, setSavedCount] = useState(0)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const counts = Object.fromEntries(TOURNAMENT_STATUSES.map((s) => [s, tournaments.filter((t) => t.status === s).length])) as Record<TournamentStatus, number>
  const needle = query.trim().toLocaleLowerCase('tr')
  const shown = tournaments.filter((t) => {
    if (filter !== 'all' && t.status !== filter) return false
    if (!needle) return true
    return [t.title, ARENA_META[t.game].title, FORMAT_SHORT[t.format], `#${t.id}`, t.winner ?? ''].some((text) => text.toLocaleLowerCase('tr').includes(needle))
  })
  const open = openId == null ? undefined : tournaments.find((t) => t.id === openId)
  const isHidden = (t: Tournament) => hidden.includes(String(t.id))

  return (
    <div className="flex flex-col gap-5">
      <TournamentGuide />

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-0 flex-1 basis-56">
            <span className="sr-only">Turnuva ara</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ad, oyun ya da #numara ile ara"
              className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setCreated({})
              setCreating(true)
            }}
            className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
          >
            <Plus className="size-4" aria-hidden="true" />
            Yeni turnuva
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Duruma göre süz">
          {(['all', ...TOURNAMENT_STATUSES] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                filter === f ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {f === 'all' ? 'Hepsi' : STATUS_LABEL[f]}
              <span className="tabular-nums text-muted-foreground">{f === 'all' ? tournaments.length : counts[f]}</span>
            </button>
          ))}
        </div>
        <Feedback state={created} />
      </div>

      {tournaments.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">Henüz turnuva yok. &quot;Yeni turnuva&quot; ile ilkini aç.</p>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">Bu aramaya ya da süzgece uyan turnuva yok.</p>
          <button
            type="button"
            onClick={() => {
              setFilter('all')
              setQuery('')
            }}
            className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary"
          >
            Süzgeci temizle
          </button>
        </div>
      ) : (
        <div className="@container overflow-hidden rounded-2xl border border-border bg-card">
          <div className={cn('hidden gap-x-4 border-b border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground @3xl:grid', COLUMNS)} aria-hidden="true">
            <span>Turnuva</span>
            <span>Durum</span>
            <span>Kayıt</span>
            <span>Başlangıç</span>
            <span>Bitiş</span>
            <span />
          </div>
          <ul className="flex flex-col divide-y divide-border">
            {shown.map((t) => (
              <li key={t.id} data-find={`tournament-${t.id}`}>
                <button
                  type="button"
                  onClick={() => setOpenId(t.id)}
                  className={cn('grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3 text-left transition-colors hover:bg-secondary', COLUMNS)}
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-bold text-foreground">{t.title}</span>
                      {isHidden(t) && (
                        <span className="flex shrink-0 items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                          <EyeOff className="size-3" aria-hidden="true" />
                          Gizli
                        </span>
                      )}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {`#${t.id} · ${ARENA_META[t.game].title} · ${FORMAT_SHORT[t.format]} · ${shapeText(t)}`}
                      {t.winner ? ` · şampiyon ${t.winner}` : ''}
                    </span>
                  </span>
                  <span className="justify-self-end @3xl:justify-self-start">
                    <span className={cn('inline-block whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold', STATUS_TONE[t.status])}>{STATUS_LABEL[t.status]}</span>
                  </span>
                  <span className="col-span-2 text-xs text-muted-foreground @3xl:hidden">
                    {`${t.entries.length}/${t.maxPlayers} kayıt · ${when(t.startsAt)} → ${when(t.endsAt)}`}
                  </span>
                  <span className="hidden text-sm tabular-nums text-foreground @3xl:block">{`${t.entries.length}/${t.maxPlayers}`}</span>
                  <span className="hidden truncate text-sm text-foreground @3xl:block">{when(t.startsAt)}</span>
                  <span className="hidden truncate text-sm text-foreground @3xl:block">{when(t.endsAt)}</span>
                  <ChevronRight className="hidden size-4 text-muted-foreground @3xl:block" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {tournaments.length > 0 && shown.length > 0 && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {shown.length === tournaments.length ? `${tournaments.length} turnuva` : `${tournaments.length} turnuvadan ${shown.length} tanesi gösteriliyor`}. Ayrıntı, maçlar, katılımcılar ve düzenleme için satıra tıkla.
        </p>
      )}

      {creating && (
        <SideSheet title="Yeni turnuva" eyebrow={picked ? `Şablon: ${picked.name}` : 'Turnuvalar'} size="lg" resetKey={picked?.id ?? 0} onClose={() => setCreating(false)}>
          <div className="flex flex-col gap-4">
            <TemplatePicker templates={templates} picked={picked} onPick={setPicked} />
            <TournamentForm
              key={picked ? `tpl-${picked.id}` : 'blank'}
              preset={picked ?? undefined}
              onCreated={(state) => {
                setCreating(false)
                setPicked(null)
                setCreated(state)
              }}
            />
          </div>
        </SideSheet>
      )}

      {open && (
        <SideSheet
          key={open.id}
          title={open.title}
          eyebrow={`#${open.id} · ${ARENA_META[open.game].title} · ${FORMAT_SHORT[open.format]} · ${STATUS_LABEL[open.status]}`}
          size="xl"
          guard="marked"
          resetKey={`${savedCount}-${open.status}`}
          onClose={() => setOpenId(null)}
        >
          <TournamentDetail t={open} hidden={isHidden(open)} onSaved={() => setSavedCount((n) => n + 1)} />
        </SideSheet>
      )}
    </div>
  )
}
