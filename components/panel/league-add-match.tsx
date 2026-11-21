'use client'

import { useId, useState } from 'react'
import useSWR from 'swr'
import { ChevronDown, Star, X } from 'lucide-react'
import { createLeagueMatch, loadLeagueTeams, removeBookTeam } from '@/app/panel/community-actions'
import type { FeedLeague } from '@/lib/kankatv'
import { gameKey, type LeagueBook } from '@/lib/prediction-book-shared'
import { ESPORT_GAMES, SPORTS, SPORT_IDS, startingSet, type Board, type LeagueSettings, type QuestionSet, type Sport } from '@/lib/predictions-shared'
import { usePanelAction } from '@/components/panel/flash'
import { StatusLine } from '@/components/alkanka/community/use-action'
import { cn } from '@/lib/utils'
import { LeagueBrowser } from './league-browser'
import { BoardSelect } from './league-boards'
import { LengthField, QuestionSetEditor, ceilingLine, questionLine, setProblem, type PrizeOptions } from './league-fields'

const field =
  'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring'
const caption = 'flex flex-col gap-1 text-xs font-semibold text-muted-foreground'

const OTHER_GAME = '__other'

const SAMPLE: Record<Sport, [string, string]> = {
  football: ['Galatasaray', 'Fenerbahçe'],
  basketball: ['Anadolu Efes', 'Fenerbahçe Beko'],
  volleyball: ['VakıfBank', 'Eczacıbaşı'],
  tennis: ['Alcaraz C.', 'Sinner J.'],
  esports: ['Eternal Fire', 'NAVI'],
}

const START_LEAGUE: Record<Sport, string> = { football: 'Süper Lig', basketball: '', volleyball: '', tennis: '', esports: ESPORT_GAMES[0] }

/**
 * Adds a match by hand. The sport decides everything below it: where the league and the teams come from
 * (the feed's directory, or the saved e-sport list), how long the match runs and which questions it can ask.
 */
export function AddMatchForm({ settings, options, book, onBookChanged, boards }: { settings: LeagueSettings; options: PrizeOptions; book: LeagueBook; onBookChanged: () => void; boards: Board[] }) {
  const [boardId, setBoardId] = useState<number | null>(null)
  const board = boards.find((b) => b.id === boardId && b.open) ?? null
  const { pending, status, run } = usePanelAction('Maç eklendi.')
  const forget = usePanelAction()
  const listId = useId()
  const [sport, setSport] = useState<Sport>('football')
  const [form, setForm] = useState({ league: START_LEAGUE.football, home: '', away: '', kickoff: '', closesAt: '' })
  const [custom, setCustom] = useState(false)
  const [draft, setDraft] = useState<QuestionSet>(settings.defaults)
  const [source, setSource] = useState<FeedLeague | null>(null)
  const [browsing, setBrowsing] = useState(false)
  const [otherGame, setOtherGame] = useState(false)
  const put = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  const info = SPORTS[sport]
  const esport = sport === 'esports'
  const standard = (s: Sport, length?: number) => startingSet(settings, s, length)
  const usual = standard(sport, draft.bestOf)
  const pins = book.pins.filter((p) => p.sport === sport)
  const games = [...new Set<string>([...ESPORT_GAMES, ...Object.keys(book.teams)])]
  const saved = esport ? (book.teams[gameKey(book, form.league)] ?? []) : []
  const feedTeams = useSWR(source && info.feed ? ['league-teams', sport, source.id] : null, () => loadLeagueTeams(sport, source!.id), { revalidateOnFocus: false, shouldRetryOnError: false })
  const teamNames = esport ? saved : feedTeams.data?.ok ? feedTeams.data.teams.map((t) => t.name) : []
  const problem = custom ? setProblem(draft) : null

  const pickSport = (next: Sport) => {
    setSport(next)
    setSource(null)
    setBrowsing(false)
    setOtherGame(false)
    setCustom(false)
    setDraft(standard(next))
    setForm((f) => ({ ...f, league: START_LEAGUE[next], home: '', away: '' }))
  }

  const pickLeague = (l: FeedLeague) => {
    setSource(l)
    setBrowsing(false)
    setForm((f) => ({ ...f, league: l.name, home: '', away: '' }))
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        run(
          () =>
            createLeagueMatch({
              ...form,
              kickoff: new Date(form.kickoff).toISOString(),
              closesAt: form.closesAt ? new Date(form.closesAt).toISOString() : undefined,
              sport,
              bestOf: draft.bestOf,
              set: custom ? draft : null,
              boardId: board?.id ?? null,
            }),
          () => {
            setForm({ ...form, home: '', away: '', kickoff: '', closesAt: '' })
            if (esport) onBookChanged()
          },
        )
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <label className={caption}>
          Spor
          <select value={sport} onChange={(e) => pickSport(e.target.value as Sport)} className={field}>
            {SPORT_IDS.map((s) => (
              <option key={s} value={s}>
                {SPORTS[s].label}
              </option>
            ))}
          </select>
        </label>

        {esport ? (
          <label className={caption}>
            Oyun
            <select
              value={otherGame ? OTHER_GAME : form.league}
              onChange={(e) => {
                const other = e.target.value === OTHER_GAME
                setOtherGame(other)
                setForm({ ...form, league: other ? '' : e.target.value, home: '', away: '' })
              }}
              className={field}
            >
              {games.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
              <option value={OTHER_GAME}>Başka oyun (elle yaz)</option>
            </select>
          </label>
        ) : (
          <label className={caption}>
            <span>
              Lig <span className="font-normal opacity-70">· listeden seç ya da elle yaz</span>
            </span>
            <input
              value={form.league}
              onChange={(e) => {
                setSource(null)
                setForm({ ...form, league: e.target.value })
              }}
              placeholder={info.label}
              className={field}
            />
          </label>
        )}
        {esport && otherGame && (
          <label className={caption}>
            Oyunun adı
            <input value={form.league} onChange={put('league')} placeholder="Rocket League" className={field} />
          </label>
        )}

        <LengthField value={draft} onChange={(next) => setDraft(custom ? next : standard(sport, next.bestOf))} />
      </div>

      {!esport && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {pins.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={source?.id === p.id}
                onClick={() => pickLeague({ id: p.id, name: p.name, country: p.country })}
                className={cn(
                  'flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                  source?.id === p.id ? 'border-primary bg-primary/15 text-primary' : 'border-border text-foreground hover:border-primary hover:text-primary',
                )}
              >
                <Star className="size-3.5 shrink-0" fill="currentColor" aria-hidden="true" />
                {p.name}
              </button>
            ))}
            <button
              type="button"
              aria-expanded={browsing}
              onClick={() => setBrowsing((v) => !v)}
              className="flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground hover:bg-secondary"
            >
              Ülkeden lig seç
              <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform', browsing && 'rotate-180')} aria-hidden="true" />
            </button>
          </div>
          {browsing && <LeagueBrowser key={sport} sport={sport} chosen={(id) => source?.id === id} onToggle={pickLeague} pins={pins} single />}
          <p className="text-xs leading-relaxed text-muted-foreground" aria-live="polite">
            {source
              ? feedTeams.isLoading
                ? `${source.name} takımları yükleniyor...`
                : teamNames.length
                  ? `${source.name}${source.country ? ` (${source.country})` : ''}: ${teamNames.length} takım aşağıdaki kutularda listelenir. Listede yoksa adı elle yaz.`
                  : `${source.name} takımları kaynaktan okunamadı; takım adlarını elle yaz.`
              : 'Lig listeden seçilirse takımlar da listeden gelir. Seçmeden lig ve takım adlarını elle de yazabilirsin.'}
          </p>
        </div>
      )}

      <datalist id={listId}>
        {teamNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className={caption}>
          {sport === 'tennis' ? '1. oyuncu' : 'Ev sahibi'}
          <input list={listId} value={form.home} onChange={put('home')} placeholder={SAMPLE[sport][0]} autoComplete="off" className={field} />
        </label>
        <label className={caption}>
          {sport === 'tennis' ? '2. oyuncu' : 'Deplasman'}
          <input list={listId} value={form.away} onChange={put('away')} placeholder={SAMPLE[sport][1]} autoComplete="off" className={field} />
        </label>
        <label className={caption}>
          Başlama saati
          <input type="datetime-local" value={form.kickoff} onChange={put('kickoff')} className={field} />
        </label>
        <label className={caption}>
          <span>
            Tahmin bitiş <span className="font-normal opacity-70">· boşsa maç saatinde</span>
          </span>
          <input type="datetime-local" value={form.closesAt} max={form.kickoff || undefined} onChange={put('closesAt')} className={field} />
        </label>
      </div>

      {esport && (
        <div className="flex flex-col gap-2 rounded-lg bg-background p-3">
          <span className="text-xs font-semibold text-muted-foreground">
            {form.league ? `${form.league} için kayıtlı takımlar (${saved.length})` : 'Kayıtlı takımlar'}
          </span>
          {saved.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {saved.map((name) => (
                <li key={name} className="flex items-center gap-1 rounded-full border border-border bg-card py-0.5 pl-3 pr-1 text-xs font-semibold text-foreground">
                  {name}
                  <button
                    type="button"
                    disabled={forget.pending}
                    onClick={() => forget.run(() => removeBookTeam(form.league, name), onBookChanged)}
                    aria-label={`${name} takımını listeden çıkar`}
                    className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">Bu oyunda kayıtlı takım yok. Takım adlarını yaz; maçı ekleyince liste kendiliğinden dolar ve bir sonraki maçta kutudan seçersin.</p>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">E-spor maçları maç kaynağında yok: logo gelmez, sonuç maç bitince &quot;Sonuç bekleyen&quot; sekmesinden elle girilir.</p>
          <StatusLine status={forget.status} />
        </div>
      )}

      <BoardSelect boards={boards} value={board?.id ?? null} onChange={setBoardId} label="Tahmin ligi" className="sm:max-w-md" />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-semibold text-muted-foreground">Sorular</legend>
        <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
          <input
            type="radio"
            name={`${listId}-soru`}
            checked={!custom}
            onChange={() => {
              setDraft(usual)
              setCustom(false)
            }}
            className="mt-1 size-4 accent-primary"
          />
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold">{info.label} şablonu</span>
            <span className="text-xs leading-relaxed text-muted-foreground">
              {questionLine(usual)} · en fazla {ceilingLine(usual)}
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
          <input
            type="radio"
            name={`${listId}-soru`}
            checked={custom}
            onChange={() => {
              setDraft(usual)
              setCustom(true)
            }}
            className="mt-1 size-4 accent-primary"
          />
          <span className="font-semibold">Bu maça özel sorular</span>
        </label>
        {custom && <QuestionSetEditor value={draft} onChange={setDraft} options={options} hideLength />}
      </fieldset>

      {problem && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {problem}
        </p>
      )}
      <button
        disabled={pending || !form.league.trim() || !form.home.trim() || !form.away.trim() || !form.kickoff || Boolean(problem)}
        className="h-10 self-start rounded-lg bg-primary px-6 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-40"
      >
        {pending ? 'Ekleniyor...' : 'Maçı ekle'}
      </button>
      <StatusLine status={status} />
      <p className="text-xs leading-relaxed text-muted-foreground">
        Tahminler bitiş saatinde (boşsa başlama saatinde) kendiliğinden kilitlenir. Her üye bir maça bir kez tahmin yapar. Maç bitince sonucu gir; puanlar ve ödüller anında dağıtılır.
      </p>
    </form>
  )
}
