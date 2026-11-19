'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ChevronDown, Loader2, Plus, Trash2 } from 'lucide-react'
import { loadLeagueSetup, saveLeagueAuto, saveLeagueDefaultSet, saveLeaguePeriodPrizes, settleAward, type LeagueSetup } from '@/app/panel/community-actions'
import type { LeagueMatch, PaidPeriod } from '@/lib/predictions'
import {
  AWARD_STATUS_LABEL,
  MAX_LEAGUE_PLACES,
  PERIOD_LABEL,
  prizeText,
  type Award,
  type AwardStatus,
  type PeriodKind,
  type PeriodPrizes,
  type Prize,
  type QuestionSet,
} from '@/lib/predictions-shared'
import { askReason } from '@/components/panel/confirm-dialog'
import { usePanelAction } from '@/components/panel/flash'
import { useUrlTab } from '@/components/panel/use-url-tab'
import { StatusLine } from '@/components/alkanka/community/use-action'
import { cn } from '@/lib/utils'
import { FixturePicker } from './fixture-picker'
import { PrizeField, QuestionSetEditor, ceilingLine, prizeProblem, questionLine, setProblem, type PrizeOptions } from './league-fields'
import { AddMatchForm, MatchList } from './league-matches'

type Tab = 'maclar' | 'sorular' | 'oduller' | 'teslim'

const card = 'flex flex-col gap-3 rounded-xl border border-border bg-card p-4'
const when = (iso: string) => new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })

function DefaultQuestions({ initial, options, onSaved }: { initial: QuestionSet; options: PrizeOptions; onSaved: () => void }) {
  const { pending, status, run } = usePanelAction()
  const [draft, setDraft] = useState<QuestionSet>(initial)
  const problem = setProblem(draft)
  return (
    <section aria-labelledby="varsayilan-sorular" className={card}>
      <div className="flex flex-col gap-1">
        <h3 id="varsayilan-sorular" className="font-display text-base font-bold text-foreground">
          Varsayılan sorular
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Takvimden yayınlanan ve elle eklenirken özel soru seçilmeyen her maç bu sorularla açılır. Burada yapılan değişiklik yayındaki maçları etkilemez; bir maçın sorularını, ona tahmin gelmeden önce &quot;Maçlar&quot; sekmesinden değiştirebilirsin.
        </p>
      </div>
      <QuestionSetEditor value={draft} onChange={setDraft} options={options} />
      {problem && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {problem}
        </p>
      )}
      <button
        type="button"
        disabled={pending || Boolean(problem)}
        onClick={() => run(() => saveLeagueDefaultSet(draft), onSaved)}
        className="h-10 self-start rounded-lg bg-primary px-5 text-xs font-bold text-primary-foreground disabled:opacity-40"
      >
        {pending ? 'Kaydediliyor...' : 'Varsayılan soruları kaydet'}
      </button>
      <StatusLine status={status} />
    </section>
  )
}

function AutoScoring({ on, onSaved }: { on: boolean; onSaved: () => void }) {
  const { pending, status, run } = usePanelAction()
  return (
    <section aria-labelledby="otomatik-puanlama" className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-72 flex-col gap-1">
          <h3 id="otomatik-puanlama" className="font-display text-base font-bold text-foreground">
            Otomatik puanlama: {on ? 'açık' : 'kapalı'}
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Açıkken takvimden eklenen maçlar bitince sonuç kaynaktan alınır, tahminler puanlanır ve ödüller dağıtılır; kimsenin düğmeye basması gerekmez. Kontrol ziyaretçi trafiğiyle, en sık 10 dakikada bir yapılır. Korner, kart ya da ilk yarı
            sorusu olan maçta o rakam kaynakta yoksa maç &quot;Sonuç bekleyen&quot; sekmesinde elle girilmeyi bekler. Elle eklenen maçlar her zaman elle sonuçlandırılır.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => saveLeagueAuto(!on), onSaved)}
          className={cn('h-10 shrink-0 rounded-lg px-4 text-xs font-bold disabled:opacity-40', on ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground')}
        >
          {pending ? 'Kaydediliyor...' : on ? 'Kapat' : 'Aç'}
        </button>
      </div>
      <StatusLine status={status} />
    </section>
  )
}

function PeriodCard({ kind, cfg, last, options, onSaved }: { kind: PeriodKind; cfg: PeriodPrizes; last: PaidPeriod | undefined; options: PrizeOptions; onSaved: () => void }) {
  const { pending, status, run } = usePanelAction()
  const [on, setOn] = useState(cfg.on)
  const [places, setPlaces] = useState<(Prize | null)[]>(cfg.places.length ? cfg.places : [null])
  const name = PERIOD_LABEL[kind]
  const firstBad = places.findIndex((p) => !p || prizeProblem(p))
  const problem = on && firstBad >= 0 ? `${firstBad + 1}. sıra: ${places[firstBad] ? prizeProblem(places[firstBad]) : 'ödül türünü seç ya da sırayı kaldır.'}` : null
  const complete = places.filter((p): p is Prize => Boolean(p) && !prizeProblem(p))

  return (
    <section aria-labelledby={`odul-${kind}`} className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-72 flex-col gap-1">
          <h3 id={`odul-${kind}`} className="font-display text-base font-bold text-foreground">
            {name} lig ödülleri
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {kind === 'week' ? 'Hafta pazartesi başlar, pazar gece yarısı biter.' : 'Ay, ayın ilk günü başlar, son günü gece yarısı biter.'} Dönem bitince o dönemin puan tablosundaki ilk sıralara kendiliğinden dağıtılır.
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-semibold text-foreground">
          <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="size-4 accent-primary" />
          {name} ödül açık
        </label>
      </div>

      <ol className="flex flex-col gap-3">
        {places.map((p, i) => (
          <li key={i} className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
            <PrizeField label={`${i + 1}. sıranın ödülü`} value={p} options={options} onChange={(next) => setPlaces(places.map((x, j) => (j === i ? next : x)))} />
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={places.length >= MAX_LEAGUE_PLACES}
          onClick={() => setPlaces([...places, null])}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-40"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Kazanan sıra ekle
        </button>
        <button
          type="button"
          disabled={places.length <= 1}
          onClick={() => setPlaces(places.slice(0, -1))}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-40"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          Son sırayı kaldır
        </button>
      </div>

      {problem && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {problem}
        </p>
      )}
      <button
        type="button"
        disabled={pending || Boolean(problem)}
        onClick={() => run(() => saveLeaguePeriodPrizes(kind, on, on ? (places as Prize[]) : complete), onSaved)}
        className="h-10 self-start rounded-lg bg-primary px-5 text-xs font-bold text-primary-foreground disabled:opacity-40"
      >
        {pending ? 'Kaydediliyor...' : `${name} ödülleri kaydet`}
      </button>
      <StatusLine status={status} />

      <ul className="flex list-disc flex-col gap-1 pl-5 text-xs leading-relaxed text-muted-foreground">
        <li>Ödül açılmadan önce bitmiş dönem için geriye dönük ödeme yapılmaz.</li>
        <li>Puanı 0 olan üye ödül almaz. Görevli hesapları tabloda görünür ama ödül almaz; sıra bir sonraki üyeye geçer.</li>
        <li>Dönemin son gününde başlayan bir maç sonuçlanmamışsa dağıtım en fazla 36 saat bekler.</li>
        <li>Eşitlikte tam skoru daha çok bilen, sonra daha çok tahmini tutan, sonra daha az tahminle aynı puana ulaşan öne geçer.</li>
      </ul>

      {last && (
        <div className="flex flex-col gap-1.5 rounded-lg bg-background p-3 text-xs">
          <p className="font-semibold text-foreground">
            Son dağıtılan dönem: {last.label} <span className="font-normal text-muted-foreground">· {when(last.paidAt)}</span>
          </p>
          {last.winners.length ? (
            <ol className="flex flex-col gap-0.5 text-muted-foreground">
              {last.winners.map((w) => (
                <li key={w.place}>
                  {w.place}. {w.name} ({w.points} puan): <span className="text-foreground">{prizeText(w.prize)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground">Bu dönemde puan alan üye olmadığı için ödül dağıtılmadı.</p>
          )}
        </div>
      )}
    </section>
  )
}

const AWARD_TONE: Record<AwardStatus, string> = {
  verildi: 'bg-success/15 text-success',
  beklemede: 'bg-primary/15 text-primary',
  iptal: 'bg-secondary text-muted-foreground',
}

function AwardRow({ a, onChanged }: { a: Award; onChanged: () => void }) {
  const { pending, status, run } = usePanelAction()
  const waitingName = a.needsUsername && !a.siteUsername
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-bold text-foreground">
            {a.userName} · {prizeText(a.prize)}
          </span>
          <span className="text-xs text-muted-foreground">
            {a.title} · {when(a.createdAt)}
          </span>
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-bold', AWARD_TONE[a.status])}>{AWARD_STATUS_LABEL[a.status]}</span>
      </div>
      {a.needsUsername && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {waitingName ? (
            'Üye sitedeki kullanıcı adını henüz yazmadı. Tahminler sayfasındaki "Ödüllerim" bölümünden yazması için mesaj gitti.'
          ) : (
            <>
              Sitedeki kullanıcı adı: <b className="select-all text-foreground">{a.siteUsername}</b>
            </>
          )}
        </p>
      )}
      {a.note && <p className="text-xs leading-relaxed text-muted-foreground">Not: {a.note}</p>}
      {a.status === 'beklemede' && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              void askReason(`${a.userName} için "${prizeText(a.prize)}" teslim edildi olarak işaretlenecek ve üyeye mesaj gidecek.${waitingName ? ' Üye kullanıcı adını henüz yazmadı; yine de teslim edildiyse devam et.' : ''}`, {
                label: 'Not (isteğe bağlı, üyeye gider)',
                confirm: 'Teslim edildi',
                maxLength: 300,
              }).then((note) => note !== null && run(() => settleAward(a.id, true, note), onChanged))
            }
            className="h-9 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-40"
          >
            Teslim edildi
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              void askReason(`${a.userName} için "${prizeText(a.prize)}" iptal edilecek. Sebep üyeye mesajla gider.`, {
                label: 'İptal sebebi',
                required: true,
                confirm: 'Ödülü iptal et',
                maxLength: 300,
              }).then((note) => note !== null && run(() => settleAward(a.id, false, note), onChanged))
            }
            className="h-9 rounded-lg bg-destructive/15 px-3 text-xs font-bold text-destructive disabled:opacity-40"
          >
            İptal et
          </button>
        </div>
      )}
      <StatusLine status={status} />
    </li>
  )
}

function AwardsDesk({ awards, onChanged }: { awards: Award[]; onChanged: () => void }) {
  const [all, setAll] = useState(false)
  const waiting = awards.filter((a) => a.status === 'beklemede')
  const list = all ? awards : waiting
  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-lg bg-secondary px-3 py-2 text-xs leading-relaxed text-secondary-foreground">
        Kanka Coin ve Kanka Puan ödülleri kazanıldığı an hesaba yazılır ve burada &quot;Teslim edildi&quot; görünür. Sponsor nakit ödülleri ve elle teslim edilen market ürünleri burada bekler: sponsor ödemeyi yapınca ya da ürün teslim edilince
        &quot;Teslim edildi&quot;ye bas, üyeye mesaj gider.
      </p>
      <div role="group" aria-label="Ödül filtresi" className="flex w-fit gap-1 rounded-lg border border-border bg-card p-1">
        {[
          [false, `Teslim bekleyen (${waiting.length})`],
          [true, `Hepsi (${awards.length})`],
        ].map(([value, label]) => (
          <button
            key={String(value)}
            type="button"
            aria-pressed={all === value}
            onClick={() => setAll(Boolean(value))}
            className={cn('h-9 rounded-md px-3 text-xs font-bold', all === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            {label}
          </button>
        ))}
      </div>
      {list.length ? (
        <ul className="grid gap-2 xl:grid-cols-2">
          {list.map((a) => (
            <AwardRow key={a.id} a={a} onChanged={onChanged} />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{all ? 'Henüz dağıtılmış ödül yok.' : 'Teslim bekleyen ödül yok.'}</p>
      )}
    </div>
  )
}

function Loaded({ matches, setup, refresh }: { matches: LeagueMatch[]; setup: LeagueSetup; refresh: () => void }) {
  const [tab, setTab] = useUrlTab<Tab>(['maclar', 'sorular', 'oduller', 'teslim'], 'maclar', 'lig')
  const [adding, setAdding] = useState(false)
  const { settings, products, sites, awards, paid } = setup
  const options: PrizeOptions = { products, sites }
  const waiting = awards.filter((a) => a.status === 'beklemede').length
  const tabs: [Tab, string][] = [
    ['maclar', `Maçlar (${matches.filter((m) => !m.settled).length})`],
    ['sorular', 'Sorular ve puanlama'],
    ['oduller', 'Lig ödülleri'],
    ['teslim', `Ödül teslimi (${waiting})`],
  ]
  const periodLine = (kind: PeriodKind) => `${PERIOD_LABEL[kind]} ödül: ${settings[kind].on ? `açık, ilk ${settings[kind].places.length} sıra` : 'kapalı'}`

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-3 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-3">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold text-muted-foreground">Yeni maçın soruları</dt>
          <dd className="leading-relaxed text-foreground">{questionLine(settings.defaults)}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold text-muted-foreground">Hepsini bilen en fazla</dt>
          <dd className="font-semibold leading-relaxed text-foreground">{ceilingLine(settings.defaults)}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold text-muted-foreground">Lig ödülleri ve puanlama</dt>
          <dd className="leading-relaxed text-foreground">
            {periodLine('week')} · {periodLine('month')} · otomatik puanlama {settings.auto ? 'açık' : 'kapalı'}
          </dd>
        </div>
      </dl>

      <div role="tablist" aria-label="Tahmin ligi bölümleri" className="flex w-fit max-w-full flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('h-9 rounded-md px-3 text-xs font-bold', tab === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'maclar' && (
        <div className="flex flex-col gap-4">
          <FixturePicker />
          <div className="flex flex-col gap-2">
            <button
              type="button"
              aria-expanded={adding}
              onClick={() => setAdding((v) => !v)}
              className="flex h-10 items-center gap-1.5 self-start rounded-lg border border-border px-4 text-xs font-bold text-foreground hover:bg-secondary"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Takvimde olmayan maçı elle ekle
              <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform', adding && 'rotate-180')} aria-hidden="true" />
            </button>
            {adding && <AddMatchForm defaults={settings.defaults} options={options} />}
          </div>
          <MatchList matches={matches} options={options} />
        </div>
      )}
      {tab === 'sorular' && (
        <div className="flex flex-col gap-4">
          <DefaultQuestions initial={settings.defaults} options={options} onSaved={refresh} />
          <AutoScoring on={settings.auto} onSaved={refresh} />
        </div>
      )}
      {tab === 'oduller' && (
        <div className="grid items-start gap-4 2xl:grid-cols-2">
          <PeriodCard kind="week" cfg={settings.week} last={paid.week} options={options} onSaved={refresh} />
          <PeriodCard kind="month" cfg={settings.month} last={paid.month} options={options} onSaved={refresh} />
        </div>
      )}
      {tab === 'teslim' && <AwardsDesk awards={awards} onChanged={refresh} />}
    </div>
  )
}

/** The prediction league: matches and their questions, scoring, league prizes and prize delivery. */
export function LeagueAdmin({ matches }: { matches: LeagueMatch[] }) {
  const { data, error, isLoading, mutate } = useSWR('league-setup', () => loadLeagueSetup(), { revalidateOnFocus: false })
  const failed = error ? 'Lig ayarları yüklenemedi.' : data && !data.ok ? data.error : null

  if (failed) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4">
        <p role="alert" className="text-sm text-destructive">
          {failed}
        </p>
        <button type="button" onClick={() => void mutate()} className="h-9 rounded-lg bg-secondary px-3 text-xs font-bold text-secondary-foreground">
          Tekrar dene
        </button>
      </div>
    )
  }
  if (isLoading || !data?.ok) {
    return (
      <p role="status" className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Tahmin ligi yükleniyor...
      </p>
    )
  }
  return <Loaded matches={matches} setup={data.data} refresh={() => void mutate()} />
}
