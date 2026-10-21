'use client'

import { useActionState, useState, useTransition } from 'react'
import { Check, FlaskConical, Link2, ListChecks, Loader2, Plug, Radio, Trash2, Trophy } from 'lucide-react'
import {
  addOddsSourceAction,
  bulkOddsAction,
  connectOddsWebhookAction,
  deleteOddsSourceAction,
  disconnectOddsWebhookAction,
  ingestManualAction,
  previewOddsAction,
  saveOddsBotAction,
  toggleOddsSourceAction,
  updateOddsSourceTextAction,
} from '@/app/panel/odds-bot-actions'
import { SourceTextEditor, SourceTextFields } from './source-text-fields'
import type { ActionState } from '@/app/panel/actions'
import type { MirrorBot } from '@/lib/telegram-mirror'
import { ODD_RESULT_LABELS, fillMinutes, type OddsBotConfig, type OddsBotStatus, type OddsPreview, type OddsSource, type SpecialOdd } from '@/lib/special-odds-shared'
import { cn } from '@/lib/utils'

const input = 'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'
const label = 'flex flex-col gap-1.5 text-sm font-medium text-foreground'
const hint = 'text-xs font-normal leading-relaxed text-muted-foreground'
const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60'
const ghostBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-60'

function Status({ state }: { state: ActionState }) {
  if (!state.message) return null
  return (
    <p role="status" className={cn('text-sm leading-relaxed', state.ok ? 'text-primary' : 'text-destructive')}>
      {state.message}
    </p>
  )
}

function Card({ icon, id, title, desc, children }: { icon: React.ReactNode; id: string; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">{icon}</span>
        <div className="flex flex-col gap-1">
          <h2 id={id} className="text-base font-semibold text-foreground">{title}</h2>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{desc}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function Flow() {
  const steps = ['Kaynak kanallar (site kanalları)', 'Bot okur, linkleri bizim linkle değiştirir', 'Bizim özel oran kanalımıza paylaşır', 'Sitede canlı listelenir', '“Limit doldu” / sonuç postu gelince günceller']
  return (
    <ol className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground md:flex-row md:flex-wrap md:items-center md:gap-x-3">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">{i + 1}</span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  )
}

function SetupCard({ config, bots, status }: { config: OddsBotConfig; bots: MirrorBot[]; status: OddsBotStatus }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveOddsBotAction, {})
  const [hookState, hookAction, hookPending] = useActionState<ActionState>(connectOddsWebhookAction, {})
  const [offState, offAction, offPending] = useActionState<ActionState>(disconnectOddsWebhookAction, {})
  const live = Boolean(status.webhookUrl) && !status.lastError
  return (
    <Card icon={<Plug className="size-4" aria-hidden="true" />} id="ob-setup" title="1. Bot ve kanalımız" desc="Botu bizim özel oran kanalımıza yönetici olarak ekle. Aynı botu tüm kaynak site kanallarına da üye/yönetici olarak eklemen gerekecek.">
      <form action={action} className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className={label}>
            Özel oran botu
            <select name="botId" defaultValue={config.botId ?? ''} className={input}>
              <option value="">Bot seç</option>
              {bots.map((b) => (
                <option key={b.id} value={b.id}>@{b.username}</option>
              ))}
            </select>
            <span className={hint}>Canlı sohbet botundan farklı bir bot olmalı. Bot yoksa “Bağlantı & Cron” sekmesinden ekle.</span>
          </label>
          <label className={label}>
            Bizim özel oran kanalımız
            <input name="channel" defaultValue={config.channelUsername ? `@${config.channelUsername}` : config.channelId} placeholder="@alkankaoran" className={input} />
            <span className={hint}>{config.channelTitle ? `Bağlı: ${config.channelTitle}` : 'Henüz bağlanmadı.'}</span>
          </label>
        </div>
        <label className={label}>
          Post altına eklenecek metin
          <input name="footer" defaultValue={config.footer} maxLength={300} className={input} />
        </label>
        <details className="rounded-xl border border-border p-4">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">Tanıma kelimeleri ve otomatik mesajlar</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className={label}>“Limit doldu” kelimeleri<input name="filledWords" defaultValue={config.filledWords} className={input} /><span className={hint}>Virgülle ayır.</span></label>
            <label className={label}>Kazandı kelimeleri<input name="wonWords" defaultValue={config.wonWords} className={input} /></label>
            <label className={label}>Kaybetti kelimeleri<input name="lostWords" defaultValue={config.lostWords} className={input} /></label>
            <label className={label}>İade kelimeleri<input name="voidWords" defaultValue={config.voidWords} className={input} /></label>
            <label className={label}>
              Otomatik kapanma (dakika)
              <input name="expireMinutes" type="number" min={5} max={720} defaultValue={config.expireMinutes} className={input} />
              <span className={hint}>“Doldu” postu gelmezse oran bu süre sonunda kapanır.</span>
            </label>
            <label className={label}>Doldu mesajı (kanala yanıt)<input name="filledText" defaultValue={config.filledText} className={input} /></label>
            <label className={label}>Kazandı mesajı<input name="wonText" defaultValue={config.wonText} className={input} /></label>
            <label className={label}>Kaybetti mesajı<input name="lostText" defaultValue={config.lostText} className={input} /></label>
            <label className="flex items-center gap-2 text-sm text-foreground md:col-span-2">
              <input type="checkbox" name="postResults" defaultChecked={config.postResults} className="size-4 accent-primary" />
              Sonuçları kanalımızda orijinal posta yanıt olarak paylaş
            </label>
          </div>
        </details>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <input type="checkbox" name="enabled" defaultChecked={config.enabled} className="size-4 accent-primary" />
            Kanala paylaşım açık
          </label>
          <button type="submit" disabled={pending} className={primaryBtn}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Kaydet
          </button>
        </div>
        <Status state={state} />
      </form>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={cn('size-2.5 rounded-full', live ? 'bg-live' : 'bg-destructive')} aria-hidden="true" />
          <span className="font-semibold text-foreground">{live ? 'Anlık bağlantı açık' : 'Anlık bağlantı kapalı'}</span>
          <span className="text-muted-foreground">
            · Bugün {status.todayTotal} oran
            {status.lastUpdateAt ? ` · Son sinyal ${new Date(status.lastUpdateAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })}` : ''}
            {status.pending ? ` · ${status.pending} bekleyen` : ''}
          </span>
        </div>
        {status.lastError && <p className="text-xs text-destructive">{status.lastError}</p>}
        <p className={hint}>Oranlar 15 dakikada dolduğu için anlık bağlantı (webhook) şart. Kapalıyken bot sadece cron çalıştıkça kontrol edilir.</p>
        <div className="flex flex-wrap gap-2">
          <form action={hookAction}>
            <button type="submit" disabled={hookPending || !config.botId} className={primaryBtn}>
              {hookPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {live ? 'Yeniden bağla' : 'Anlık bağlantıyı aç'}
            </button>
          </form>
          {status.webhookUrl && (
            <form action={offAction}>
              <button type="submit" disabled={offPending} className={ghostBtn}>Kapat</button>
            </form>
          )}
        </div>
        <Status state={hookState} />
        <Status state={offState} />
      </div>
    </Card>
  )
}

function SourcesCard({ sources }: { sources: OddsSource[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addOddsSourceAction, {})
  return (
    <Card icon={<Link2 className="size-4" aria-hidden="true" />} id="ob-sources" title="2. Kaynak site kanalları" desc="Her kanal bir siteye bağlanır. Bot o kanaldaki postlardaki tüm linkleri buradaki site linkiyle değiştirir.">
      <form action={action} className="grid gap-3 md:grid-cols-2">
        <label className={label}>Kaynak kanal<input name="chat" required placeholder="@siteozeloran" className={input} /></label>
        <label className={label}>Site adı<input name="siteName" required maxLength={40} placeholder="Örn. NovaBet" className={input} /></label>
        <label className={label}>Bizim site linkimiz<input name="siteLink" required type="url" placeholder="https://..." className={input} /></label>
        <label className={label}>Logo adresi (isteğe bağlı)<input name="siteLogo" placeholder="https://.../logo.png" className={input} /></label>
        <div className="flex flex-col gap-3 md:col-span-2">
          <SourceTextFields footerPlaceholder="Boş bırakılırsa genel alt yazı kullanılır" />
        </div>
        <div className="flex flex-col gap-2 md:col-span-2">
          <button type="submit" disabled={pending} className={cn(primaryBtn, 'self-start')}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Kaynak ekle
          </button>
          <Status state={state} />
        </div>
      </form>
      {sources.length ? (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {sources.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 p-3">
              <span className={cn('size-2.5 shrink-0 rounded-full', s.active ? 'bg-live' : 'bg-muted-foreground')} aria-hidden="true" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold text-foreground">{s.siteName} <span className="font-normal text-muted-foreground">· {s.title}</span></span>
                <span className="truncate text-xs text-muted-foreground">
                  {s.total} oran · {s.lastAt ? `son post ${new Date(s.lastAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' })}` : 'henüz post yok'}
                </span>
                {s.webError && <span className="text-xs text-destructive">Okunamıyor: {s.webError}</span>}
              </div>
              <form action={toggleOddsSourceAction}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="active" value={s.active ? '0' : '1'} />
                <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary">{s.active ? 'Durdur' : 'Başlat'}</button>
              </form>
              <form action={deleteOddsSourceAction}>
                <input type="hidden" name="id" value={s.id} />
                <button type="submit" aria-label={`${s.siteName} kaynağını sil`} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </form>
              <SourceTextEditor
                id={s.id}
                linkName="siteLink"
                link={s.siteLink}
                replacements={s.replacements}
                footer={s.footer}
                footerPlaceholder="Boş bırakılırsa genel alt yazı kullanılır"
                action={updateOddsSourceTextAction}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Henüz kaynak kanal yok.</p>
      )}
    </Card>
  )
}

const KIND_LABEL: Record<OddsPreview['kind'], string> = {
  odds: 'Yeni özel oran',
  filled: 'Limit doldu postu',
  won: 'Kazandı postu',
  lost: 'Kaybetti postu',
  void: 'İade postu',
  ignore: 'Tanınmadı (yok sayılır)',
}

function TestCard({ sources }: { sources: OddsSource[] }) {
  const [text, setText] = useState('')
  const [sourceId, setSourceId] = useState<number | null>(sources[0]?.id ?? null)
  const [preview, setPreview] = useState<OddsPreview | { error: string } | null>(null)
  const [testing, startTest] = useTransition()
  const [state, action, pending] = useActionState<ActionState, FormData>(ingestManualAction, {})
  return (
    <Card icon={<FlaskConical className="size-4" aria-hidden="true" />} id="ob-test" title="3. Test et / elle ekle" desc="Kaynak kanaldan bir post yapıştır. Önce botun onu nasıl anladığını gör, istersen bot gibi işle. Botlar kurulmadan önce de sistemi böyle kullanabilirsin.">
      <form action={action} className="flex flex-col gap-3">
        <label className={label}>
          Kaynak
          <select name="sourceId" value={sourceId ?? ''} onChange={(e) => setSourceId(Number(e.target.value) || null)} className={input}>
            {sources.length ? sources.map((s) => <option key={s.id} value={s.id}>{s.siteName}</option>) : <option value="">Önce kaynak ekle</option>}
          </select>
        </label>
        <label className={label}>
          Post metni
          <textarea name="text" value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder={'Örn.\nGalatasaray - Fenerbahçe\nMaçta 2.5 üst 1.85 → 3.60\nMaks. 500 TL'} className={input} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={testing || text.trim().length < 5}
            onClick={() => startTest(async () => setPreview(await previewOddsAction(text, sourceId)))}
            className={ghostBtn}
          >
            {testing && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Önizle
          </button>
          <button type="submit" disabled={pending || !sourceId || text.trim().length < 10} className={primaryBtn}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Bot gibi işle
          </button>
        </div>
        <Status state={state} />
      </form>
      {preview && ('error' in preview ? (
        <p className="text-sm text-destructive">{preview.error}</p>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 text-sm">
          <p className="font-semibold text-foreground">Algılanan: <span className="text-primary">{KIND_LABEL[preview.kind]}</span></p>
          {preview.odds.length > 0 && (
            <ul className="flex flex-col gap-1 text-muted-foreground">
              {preview.odds.map((o, i) => (
                <li key={i}>{o.match} · {o.market || 'market yok'} · {o.oldOdd ? `${o.oldOdd.toFixed(2)} → ` : ''}<b className="text-foreground">{o.newOdd.toFixed(2)}</b></li>
              ))}
            </ul>
          )}
          {preview.rewritten && <pre className="whitespace-pre-wrap rounded-lg bg-card p-3 font-sans text-xs leading-relaxed text-foreground">{preview.rewritten}</pre>}
        </div>
      ))}
    </Card>
  )
}

const STATUS_LABEL = { open: 'Açık', filled: 'Doldu', expired: 'Kapandı' } as const

function OddsListCard({ odds }: { odds: SpecialOdd[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(bulkOddsAction, {})
  const [onlyPending, setOnlyPending] = useState(false)
  const list = onlyPending ? odds.filter((o) => !o.result && o.status !== 'open') : odds
  const buttons: { action: string; text: string; tone?: string }[] = [
    { action: 'won', text: 'Kazandı', tone: 'text-live' },
    { action: 'lost', text: 'Kaybetti', tone: 'text-destructive' },
    { action: 'void', text: 'İade' },
    { action: 'filled', text: 'Doldu yap' },
    { action: 'open', text: 'Yeniden aç' },
    { action: 'clear', text: 'Sonucu sil' },
    { action: 'delete', text: 'Sil', tone: 'text-destructive' },
  ]
  return (
    <Card icon={<ListChecks className="size-4" aria-hidden="true" />} id="ob-list" title="4. Oranlar ve sonuçlar" desc="Bot sonuç postu atmazsa buradan toplu işaretle: kutuları seç, sonra Kazandı/Kaybetti'ye bas.">
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} className="size-4 accent-primary" />
        Sadece sonuç bekleyenler
      </label>
      <form action={action} className="flex flex-col gap-3">
        <div className="sticky top-0 z-10 flex flex-wrap gap-2 bg-card py-1">
          {buttons.map((b) => (
            <button key={b.action} type="submit" name="action" value={b.action} disabled={pending} className={cn('rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60', b.tone ?? 'text-foreground')}>
              {b.text}
            </button>
          ))}
        </div>
        <Status state={state} />
        {list.length ? (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {list.map((o) => {
              const mins = fillMinutes(o)
              return (
                <li key={o.id}>
                  <label className="flex cursor-pointer items-start gap-3 p-3 hover:bg-secondary/50">
                    <input type="checkbox" name="ids" value={o.id} className="mt-1 size-4 shrink-0 accent-primary" />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-semibold text-foreground">{o.match}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {o.siteName} · {o.market || '—'} · {o.newOdd ? o.newOdd.toFixed(2) : '—'} ·{' '}
                        {new Date(o.openedAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' })}
                        {mins ? ` · ${mins} dk'da doldu` : ''}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1 text-xs font-semibold">
                      <span className={o.status === 'open' ? 'text-live' : 'text-muted-foreground'}>{STATUS_LABEL[o.status]}</span>
                      {o.result && (
                        <span className={cn('flex items-center gap-1', o.result === 'won' ? 'text-live' : o.result === 'lost' ? 'text-destructive' : 'text-muted-foreground')}>
                          {o.result === 'won' && <Check className="size-3" aria-hidden="true" />}
                          {ODD_RESULT_LABELS[o.result]}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Gösterilecek oran yok.</p>
        )}
      </form>
    </Card>
  )
}

export function OddsBotManager(props: { config: OddsBotConfig; status: OddsBotStatus; bots: MirrorBot[]; sources: OddsSource[]; odds: SpecialOdd[] }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Radio className="size-4 text-accent" aria-hidden="true" />
        Özel oran akışı
        <Trophy className="ml-auto size-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <Flow />
      <SetupCard config={props.config} bots={props.bots} status={props.status} />
      <SourcesCard sources={props.sources} />
      <TestCard sources={props.sources} />
      <OddsListCard odds={props.odds} />
    </div>
  )
}
