'use client'

import { useActionState } from 'react'
import { CheckCircle2, Loader2, Pause, Play, Plus, RefreshCw, Send, Trash2, TriangleAlert } from 'lucide-react'
import { addSourceAction, deleteSourceAction, runMirrorAction, testBotAction, toggleSourceAction } from '@/app/panel/telegram-actions'
import type { ActionState } from '@/app/panel/actions'
import type { MirrorLog, MirrorSource } from '@/lib/telegram-mirror'

type Props = { sources: MirrorSource[]; log: MirrorLog[]; configured: boolean; cronReady: boolean; cronUrl: string }

const input =
  'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'

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

export function TelegramMirror({ sources, log, configured, cronReady, cronUrl }: Props) {
  const [addState, addAction, adding] = useActionState<ActionState, FormData>(addSourceAction, {})
  const [runState, runAction, running] = useActionState<ActionState>(runMirrorAction, {})
  const [testState, testAction, testing] = useActionState<ActionState>(testBotAction, {})

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Send className="size-5 text-primary" aria-hidden />
            <h2 className="font-display text-xl font-bold uppercase text-foreground">Telegram otomatik paylaşım</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={testAction}>
              <button
                disabled={!configured || testing}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
              >
                {testing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
                Test mesajı
              </button>
            </form>
            <form action={runAction}>
              <button
                disabled={!configured || running}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {running ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
                Şimdi kontrol et
              </button>
            </form>
          </div>
        </div>

        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <li className="flex items-start gap-2 rounded-xl bg-secondary p-3 leading-relaxed text-foreground">
            {configured ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> : <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />}
            <span>{configured ? 'Bot ve hedef kanal bağlı.' : 'TELEGRAM_BOT_TOKEN ve TELEGRAM_CHAT_ID eklenmeli (Ayarlar → Vars).'}</span>
          </li>
          <li className="flex items-start gap-2 rounded-xl bg-secondary p-3 leading-relaxed text-foreground">
            {cronReady ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> : <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />}
            <span className="min-w-0">
              {cronReady ? 'Otomatik kontrol adresi:' : 'CRON_SECRET eklenmeli. Sonra bu adresi dakikada bir çağır:'}{' '}
              <code className="break-all font-mono text-xs text-muted-foreground">{cronUrl}</code>
            </span>
          </li>
        </ul>
        <Feedback state={runState} />
        <Feedback state={testState} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <form action={addAction} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display text-lg font-bold uppercase text-foreground">Kaynak kanal ekle</h3>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Resmi kanal
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
            Sadece bunları paylaş (isteğe bağlı)
            <input name="keywords" placeholder="promo, kod, bonus, freespin" className={input} />
            <span className="text-xs font-normal leading-relaxed text-muted-foreground">Virgülle ayır. Boş bırakırsan tüm yeni postlar paylaşılır.</span>
          </label>
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
                    {s.keywords ? <p className="text-xs text-muted-foreground">Filtre: {s.keywords}</p> : null}
                    <p className={`text-xs ${s.lastError ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {s.lastError ?? (s.lastCheckedAt ? `Son kontrol ${timeFmt.format(new Date(s.lastCheckedAt))}` : 'Henüz kontrol edilmedi')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={toggleSourceAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="active" value={String(!s.active)} />
                      <button className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary">
                        {s.active ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
                        {s.active ? 'Durdur' : 'Başlat'}
                      </button>
                    </form>
                    <form action={deleteSourceAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button
                        aria-label={`${s.brand} kaynağını sil`}
                        className="inline-flex items-center rounded-lg border border-border px-2.5 py-1.5 text-destructive hover:bg-destructive/10"
                      >
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
                  <a
                    href={`https://t.me/${l.channel}/${l.postId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground underline-offset-2 hover:underline"
                  >
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
