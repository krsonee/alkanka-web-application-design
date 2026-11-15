'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BotHealth, ChatHealth, Health } from '@/lib/tg-status-shared'
import { useSiblingTabs, type TabInfo } from '@/components/panel/telegram-tabs'
import { Card, btn, btnGhost, fmt, useAction } from '@/components/panel/tg-hub-ui'
import { loadTgStatusAction, repairTelegramAction } from '@/app/panel/tg-hub-actions'

const WORD: Record<Health, string> = { ok: 'Çalışıyor', warn: 'Bakılmalı', bad: 'Sorun var', idle: 'Kullanılmıyor' }
const DOT: Record<Health, string> = { ok: 'bg-emerald', warn: 'bg-gold', bad: 'bg-destructive', idle: 'bg-muted-foreground/40' }
// The dot carries the colour; the word stays in a text colour that is readable on the card.
const TEXT: Record<Health, string> = { ok: 'text-foreground', warn: 'text-foreground', bad: 'text-destructive', idle: 'text-muted-foreground' }

function State({ state }: { state: Health }) {
  return (
    <span className={cn('flex shrink-0 items-center gap-1.5 text-xs font-semibold', TEXT[state])}>
      <span className={cn('size-2 rounded-full', DOT[state])} aria-hidden="true" />
      {WORD[state]}
    </span>
  )
}

function Row({ title, sub, state, children }: { title: ReactNode; sub?: ReactNode; state: Health; children?: ReactNode }) {
  return (
    <li className="flex flex-col gap-1 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">{title}</span>
          {sub && <span className="text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{sub}</span>}
        </div>
        <State state={state} />
      </div>
      {children}
    </li>
  )
}

const Problem = ({ children }: { children: ReactNode }) => <p className="text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">{children}</p>

const sectionState = (t: TabInfo): Health => (t.status === 'off' ? 'bad' : t.status === 'idle' ? 'idle' : 'ok')

function Sections({ sections, open }: { sections: TabInfo[]; open: (id: string) => void }) {
  const failing = sections.filter((t) => t.status === 'off')
  const working = sections.filter((t) => t.status === 'on')
  const closed = sections.filter((t) => t.status === 'idle')
  const name = (t: TabInfo) => (t.group ? `${t.group} · ${t.label}` : t.label)
  return (
    <Card title="Bölümler" hint="Kapalı bir bölüm arıza değildir; sadece açık olup çalışmayan bölüm sorun sayılır.">
      {failing.length > 0 && (
        <ul className="flex flex-col divide-y divide-border">
          {failing.map((t) => (
            <Row key={t.id} title={name(t)} state="bad">
              <Problem>{t.issue ?? 'Kurulum tamamlanmamış.'}</Problem>
              <div>
                <button type="button" className={btnGhost} onClick={() => open(t.id)}>
                  Bölümü aç
                </button>
              </div>
            </Row>
          ))}
        </ul>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{`Çalışan (${working.length})`}</h4>
          <ul className="flex flex-col gap-1">
            {working.map((t) => (
              <li key={t.id}>
                <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-foreground hover:bg-muted" onClick={() => open(t.id)}>
                  <span className={cn('size-2 shrink-0 rounded-full', DOT.ok)} aria-hidden="true" />
                  {name(t)}
                </button>
              </li>
            ))}
            {working.length === 0 && <li className="text-sm text-muted-foreground">Çalışan bölüm yok.</li>}
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{`Kapalı ya da kurulmamış (${closed.length})`}</h4>
          <ul className="flex flex-col gap-1">
            {closed.map((t) => (
              <li key={t.id}>
                <button type="button" className="flex w-full items-start gap-2 rounded-md px-2 py-1 text-left text-sm text-muted-foreground hover:bg-muted" onClick={() => open(t.id)}>
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', DOT.idle)} aria-hidden="true" />
                  <span className="[overflow-wrap:anywhere]">
                    {name(t)}
                    {t.issue ? ` · ${t.issue}` : ''}
                  </span>
                </button>
              </li>
            ))}
            {closed.length === 0 && <li className="text-sm text-muted-foreground">Kapalı bölüm yok.</li>}
          </ul>
        </div>
      </div>
    </Card>
  )
}

function Bots({ bots }: { bots: BotHealth[] }) {
  return (
    <Card title="Botlar" hint="Her bot için: hangi işi yapıyor, Telegram bildirimleri siteye ulaşıyor mu, sırada bekleyen bildirim var mı.">
      {bots.length ? (
        <ul className="flex flex-col divide-y divide-border">
          {bots.map((b) => (
            <Row
              key={b.id}
              title={`${b.name} · @${b.username}`}
              sub={`${b.roles.length ? b.roles.join(', ') : 'Görev yok'}${b.pending ? ` · ${b.pending} bildirim sırada` : ''}`}
              state={b.state}
            >
              {b.note && (b.state === 'ok' || b.state === 'idle' ? <p className="text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{b.note}</p> : <Problem>{b.note}</Problem>)}
            </Row>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Henüz bot eklenmemiş. Otomasyonlar &gt; Bağlantı &amp; Cron bölümünden ekle.</p>
      )}
    </Card>
  )
}

const KIND: Record<ChatHealth['kind'], string> = { channel: 'Kanal', group: 'Grup', unknown: 'Sohbet' }

function Chats({ chats }: { chats: ChatHealth[] }) {
  return (
    <Card title="Gruplar ve kanallar" hint="Botun görev yaptığı her sohbet: orada yönetici mi, işi için gereken yetkilerden eksik olan var mı.">
      {chats.length ? (
        <ul className="flex flex-col divide-y divide-border">
          {chats.map((c) => (
            <Row key={c.key} title={c.title} sub={`${KIND[c.kind]} · @${c.botUsername} · ${c.uses.join(', ')}`} state={c.state}>
              {c.note && <Problem>{c.note}</Problem>}
              {c.missing.length > 0 && (
                <Problem>
                  <span className="font-semibold">Eksik yetki:</span> {c.missing.join(', ')}. Telegram&apos;da sohbetin yönetici ayarlarından aç.
                </Problem>
              )}
            </Row>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Hiçbir bota grup ya da kanal bağlanmamış.</p>
      )}
    </Card>
  )
}

export function StatusSection({ canRepair }: { canRepair: boolean }) {
  const siblings = useSiblingTabs()
  const router = useRouter()
  const repair = useAction()
  const { data, error, isLoading, isValidating, mutate } = useSWR('tg-status', () => loadTgStatusAction(), { revalidateOnFocus: false })
  const sections = (siblings?.tabs ?? []).filter((t) => t.status)
  const counted: Health[] = [...sections.map(sectionState), ...(data?.bots ?? []).map((b) => b.state), ...(data?.chats ?? []).map((c) => c.state)]
  const bad = counted.filter((s) => s === 'bad').length
  const warn = counted.filter((s) => s === 'warn').length
  const checking = isLoading || isValidating
  const headline = bad ? `${bad} yerde sorun var` : warn ? `Sorun yok, ${warn} yere bakılmalı` : checking && !data ? 'Kontrol ediliyor…' : 'Her şey çalışıyor'

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h3 className={cn('text-lg font-semibold', bad ? 'text-destructive' : 'text-foreground')} aria-live="polite">
            {headline}
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {data ? `Botlar ve sohbetler Telegram'a ${fmt(data.checkedAt)} saatinde soruldu.` : 'Bölümlerin durumu sayfayla gelir; botlar ve sohbetler Telegram\'a ayrıca sorulur.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`${btn} gap-2`} disabled={checking} onClick={() => void mutate()}>
            <RefreshCw className={cn('size-4', checking && 'animate-spin')} aria-hidden="true" />
            {checking ? 'Kontrol ediliyor…' : 'Yeniden kontrol et'}
          </button>
          {canRepair && (
            <button
              type="button"
              className={btnGhost}
              disabled={repair.pending}
              title="Silinmiş botlara bakan ayarları temizler, yanlış yere bakan bildirim adreslerini düzeltir."
              onClick={() =>
                repair.run(async () => {
                  const r = await repairTelegramAction()
                  void mutate()
                  router.refresh()
                  return r
                })
              }
            >
              {repair.pending ? 'Onarılıyor…' : 'Kontrol et ve onar'}
            </button>
          )}
        </div>
      </section>
      {repair.note}
      {siblings && <Sections sections={sections} open={siblings.open} />}
      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground">Telegram&apos;a sorulamadı. Biraz sonra &quot;Yeniden kontrol et&quot; butonuna bas.</p>
      ) : data ? (
        <>
          <Bots bots={data.bots} />
          <Chats chats={data.chats} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{checking ? 'Botlar ve sohbetler kontrol ediliyor…' : 'Bot ve sohbet durumunu görmek için Telegram moderasyon ya da kurulum izni gerekli.'}</p>
      )}
    </div>
  )
}
