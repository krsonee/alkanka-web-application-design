'use client'

import { useActionState } from 'react'
import { Bot, KeyRound, Link2, Loader2, Pause, Play, Plus, RefreshCw, Send, Trash2 } from 'lucide-react'
import {
  addBotAction,
  addSourceAction,
  addTargetAction,
  deleteBotAction,
  deleteSourceAction,
  deleteTargetAction,
  rotateCronKeyAction,
  runMirrorAction,
  testTargetAction,
  toggleSourceAction,
  toggleTargetAction,
} from '@/app/panel/telegram-actions'
import type { ActionState } from '@/app/panel/actions'
import type { MirrorBot, MirrorLog, MirrorSource, MirrorTarget } from '@/lib/telegram-mirror'
import { FILTER_PRESETS, describeFilter } from '@/lib/telegram-filters'
import { TelegramGuide } from './telegram-guide'

type Props = { bots: MirrorBot[]; targets: MirrorTarget[]; sources: MirrorSource[]; log: MirrorLog[]; cronUrl: string }

const input =
  'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'
const ghostBtn =
  'inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50'
const dangerBtn = 'inline-flex items-center rounded-lg border border-border px-2.5 py-1.5 text-destructive hover:bg-destructive/10'

const STATUS: Record<MirrorLog['status'], { label: string; className: string }> = {
  sent: { label: 'Paylaşıldı', className: 'bg-primary/15 text-primary' },
  skipped: { label: 'Atlandı', className: 'bg-secondary text-muted-foreground' },
  failed: { label: 'Hata', className: 'bg-destructive/15 text-destructive' },
  pending: { label: 'Bekliyor', className: 'bg-secondary text-muted-foreground' },
}

const timeFmt = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function Feedback({ state }: { state: ActionState }) {
  if (!state.message) return null
  return (
    <p role="status" className={`text-sm leading-relaxed ${state.ok ? 'text-primary' : 'text-destructive'}`}>
      {state.message}
    </p>
  )
}

function TargetRow({ target }: { target: MirrorTarget }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(testTargetAction, {})
  return (
    <li className="flex flex-col gap-1.5 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-sm text-foreground">
          <span className="font-semibold">{target.title}</span> <span className="font-mono text-xs text-muted-foreground">{target.chatId}</span>
          {!target.active ? <span className="ml-2 rounded-md bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">Durduruldu</span> : null}
        </p>
        <div className="flex gap-1.5">
          <form action={action}>
            <input type="hidden" name="id" value={target.id} />
            <button disabled={pending} className={ghostBtn}>
              {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Send className="size-3.5" aria-hidden />}
              Test
            </button>
          </form>
          <form action={toggleTargetAction}>
            <input type="hidden" name="id" value={target.id} />
            <input type="hidden" name="active" value={String(!target.active)} />
            <button className={ghostBtn}>
              {target.active ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
              {target.active ? 'Durdur' : 'Başlat'}
            </button>
          </form>
          <form action={deleteTargetAction}>
            <input type="hidden" name="id" value={target.id} />
            <button aria-label={`${target.title} kanalını kaldır`} className={dangerBtn}>
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          </form>
        </div>
      </div>
      <Feedback state={state} />
    </li>
  )
}

function BotCard({ bot, targets }: { bot: MirrorBot; targets: MirrorTarget[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addTargetAction, {})
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Bot className="size-4" aria-hidden />
          </span>
          <div className="flex flex-col">
            <a href={`https://t.me/${bot.username}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-foreground hover:underline">
              {bot.name} <span className="font-normal text-muted-foreground">@{bot.username}</span>
            </a>
            <span className="font-mono text-xs text-muted-foreground">{bot.tokenHint}</span>
          </div>
        </div>
        <form action={deleteBotAction}>
          <input type="hidden" name="id" value={bot.id} />
          <button className={`${dangerBtn} gap-1.5 text-xs font-semibold`}>
            <Trash2 className="size-3.5" aria-hidden />
            Botu kaldır
          </button>
        </form>
      </div>

      {targets.length ? (
        <ul className="flex flex-col divide-y divide-border border-t border-border">
          {targets.map((t) => (
            <TargetRow key={t.id} target={t} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Bu botun henüz hedef kanalı yok.</p>
      )}

      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="botId" value={bot.id} />
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          Hedef kanal ekle
          <div className="flex gap-2">
            <input name="chat" required placeholder="@kanaladi ya da -100..." className={`${input} min-w-0 flex-1`} />
            <button disabled={pending} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
              Bağla
            </button>
          </div>
        </label>
        <Feedback state={state} />
      </form>
    </li>
  )
}

export function TelegramMirror({ bots, targets, sources, log, cronUrl }: Props) {
  const [botState, botAction, addingBot] = useActionState<ActionState, FormData>(addBotAction, {})
  const [addState, addAction, adding] = useActionState<ActionState, FormData>(addSourceAction, {})
  const [runState, runAction, running] = useActionState<ActionState>(runMirrorAction, {})
  const activeTargets = targets.filter((t) => t.active).length
  const targetTitle = (id: number | null) => (id == null ? 'Tüm kanallar' : (targets.find((t) => t.id === id)?.title ?? 'Silinmiş kanal'))

  return (
    <div className="flex flex-col gap-6">
      <TelegramGuide cronUrl={cronUrl} open={bots.length === 0} />

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <h2 className="font-display text-xl font-bold uppercase text-foreground">Bağlı hesaplar</h2>
            <p className="text-sm text-muted-foreground">
              {bots.length} bot, {activeTargets} aktif kanal
            </p>
          </div>
          <form action={runAction}>
            <button
              disabled={!activeTargets || running}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {running ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
              Şimdi kontrol et
            </button>
          </form>
        </div>
        <Feedback state={runState} />

        <form action={botAction} className="flex flex-col gap-2 rounded-xl bg-secondary p-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Bot ekle
            <div className="flex gap-2">
              <input
                name="token"
                type="password"
                autoComplete="off"
                required
                placeholder="BotFather token: 123456789:AAH..."
                className={`${input} min-w-0 flex-1 font-mono`}
              />
              <button disabled={addingBot} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {addingBot ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                Bağla
              </button>
            </div>
          </label>
          <Feedback state={botState} />
        </form>

        {bots.length ? (
          <ul className="grid gap-3 lg:grid-cols-2">
            {bots.map((b) => (
              <BotCard key={b.id} bot={b} targets={targets.filter((t) => t.botId === b.id)} />
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">Henüz bağlı bot yok. Yukarıdaki rehberin ilk dört adımını takip et.</p>
        )}

        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-secondary p-3 text-sm">
          <KeyRound className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="text-foreground">Otomatik kontrol adresi:</span>
          <code className="min-w-0 flex-1 break-all font-mono text-xs text-muted-foreground">{cronUrl}</code>
          <form action={rotateCronKeyAction}>
            <button className={ghostBtn}>Anahtarı yenile</button>
          </form>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <form action={addAction} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display text-lg font-bold uppercase text-foreground">Kaynak kanal ekle</h3>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Markanın resmi kanalı
            <input name="channel" required placeholder="@markaresmi" className={input} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Marka adı
            <input name="brand" required maxLength={40} placeholder="Marka" className={input} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Senin linkin
            <input name="link" type="url" required placeholder="https://..." className={input} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Hangi kanala
            <select name="targetId" defaultValue="" className={input}>
              <option value="">Tüm kanallar</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-medium text-foreground">Hangi postlar paylaşılsın?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {FILTER_PRESETS.map((f) => (
                <label
                  key={f.id}
                  className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input type="checkbox" name="presets" value={f.id} className="mt-0.5 size-4 accent-primary" />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-foreground">{f.label}</span>
                    <span className="text-xs leading-relaxed text-muted-foreground">{f.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            <label className="mt-1 flex flex-col gap-1.5 text-sm font-medium text-foreground">
              Ek kelimeler (isteğe bağlı)
              <input name="keywords" placeholder="ör. maç önü, kombine" className={input} />
            </label>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Seçtiğin türlerden ya da yazdığın kelimelerden en az biri geçen postlar paylaşılır. Hiçbirini seçmezsen kanaldaki tüm yeni postlar paylaşılır.
            </p>
          </fieldset>
          <button
            disabled={adding}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {adding ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            Kaydet
          </button>
          <Feedback state={addState} />
        </form>

        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display text-lg font-bold uppercase text-foreground">Kaynaklar ({sources.length})</h3>
          {sources.length === 0 ? (
            <p className="text-sm leading-relaxed text-muted-foreground">Henüz kaynak yok. Markaların resmi Telegram kanallarını ekle.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {sources.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="text-sm font-semibold text-foreground">
                      {s.brand} <span className="font-normal text-muted-foreground">@{s.channel}</span>
                      {!s.active ? <span className="ml-2 rounded-md bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">Durduruldu</span> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{s.link}</p>
                    <p className="text-xs text-muted-foreground">
                      Hedef: {targetTitle(s.targetId)}
                      {` · ${s.keywords ? `Filtre: ${describeFilter(s.keywords)}` : 'Tüm postlar'}`}
                    </p>
                    <p className={`text-xs ${s.lastError ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {s.lastError ?? (s.lastCheckedAt ? `Son kontrol ${timeFmt.format(new Date(s.lastCheckedAt))}` : 'Henüz kontrol edilmedi')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={toggleSourceAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="active" value={String(!s.active)} />
                      <button className={ghostBtn}>
                        {s.active ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
                        {s.active ? 'Durdur' : 'Başlat'}
                      </button>
                    </form>
                    <form action={deleteSourceAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button aria-label={`${s.brand} kaynağını sil`} className={dangerBtn}>
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h3 className="mt-3 font-display text-lg font-bold uppercase text-foreground">Son hareketler</h3>
          {log.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz paylaşım yok.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {log.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${STATUS[l.status].className}`}>{STATUS[l.status].label}</span>
                  <a href={`https://t.me/${l.channel}/${l.postId}`} target="_blank" rel="noreferrer" className="text-foreground underline-offset-2 hover:underline">
                    @{l.channel}/{l.postId}
                  </a>
                  <span className="text-xs text-muted-foreground">{timeFmt.format(new Date(l.createdAt))}</span>
                  {l.detail ? <span className="text-xs text-muted-foreground">{l.detail}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
