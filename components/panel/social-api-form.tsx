'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { clearSocialApiAction, saveSocialApiAction } from '@/app/panel/social-actions'
import { AUTO_CHECKS, PLATFORM_LABEL, SOCIAL_PLATFORMS, type SocialApiSummary, type SocialPlatform } from '@/lib/social-shared'
import { cn } from '@/lib/utils'

type Field = { key: string; label: string; secret: boolean; required: boolean }

const input = 'rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none'

const HELP: Record<SocialPlatform, string> = {
  x: 'developer.x.com > Proje > Keys and tokens > Bearer Token. Takip ve beğeni kontrolü için Basic veya üstü API planı gerekir.',
  youtube: 'console.cloud.google.com > YouTube Data API v3 > API anahtarı. Aboneliği gizli üyeler onay kuyruğuna düşer. Beğeniler API’de herkese açık değil, onaya gider.',
  twitch: 'dev.twitch.tv > Uygulama oluştur (Client ID). Yayıncı hesabıyla moderator:read:followers izinli kullanıcı tokenı al.',
  instagram: 'Instagram API takipçi ve beğeni listesini paylaşmıyor. Bu görevler her zaman onay kuyruğuna düşer, panelden tek tıkla onaylarsın.',
}

function checkText(p: SocialPlatform) {
  const a = AUTO_CHECKS[p]
  if (a.follow && a.like) return 'Takip + beğeni otomatik'
  if (a.follow) return 'Takip otomatik, beğeni onaylı'
  return 'Onay kuyruğu'
}

function PlatformRow({ platform, fields, state }: { platform: SocialPlatform; fields: Field[]; state: SocialApiSummary[SocialPlatform] }) {
  const [values, setValues] = useState<Record<string, string>>(state.fields)
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null)
  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => start(async () => setMsg(await fn()))

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-foreground">{PLATFORM_LABEL[platform]}</span>
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{checkText(platform)}</span>
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', state.connected ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground')}>
            {state.connected ? 'Bağlı' : 'Bağlı değil'}
          </span>
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{HELP[platform]}</p>
      {fields.length ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => saveSocialApiAction(platform, values))
          }}
        >
          <div className="grid gap-3 md:grid-cols-3">
            {fields.map((f) => (
              <label key={f.key} className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-foreground">{f.label}</span>
                <input
                  type={f.secret ? 'password' : 'text'}
                  autoComplete="off"
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.secret && state.connected ? 'Kayıtlı, değiştirmek için yapıştır' : ''}
                  className={input}
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Kaydet
            </button>
            {state.connected ? (
              <button type="button" disabled={pending} onClick={() => run(() => clearSocialApiAction(platform))} className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-50">
                Bağlantıyı kaldır
              </button>
            ) : null}
            {msg ? <p role="status" className={cn('text-sm', msg.ok ? 'text-primary' : 'text-destructive')}>{msg.message}</p> : null}
          </div>
        </form>
      ) : null}
    </li>
  )
}

export function SocialApiForm({ summary, fields }: { summary: SocialApiSummary; fields: Record<SocialPlatform, Field[]> }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold text-foreground">Görev doğrulama bağlantıları</h3>
        <p className="text-sm text-muted-foreground">
          Takip et, abone ol ve beğen görevleri üyenin profilinde doğruladığı hesapla kontrol edilir. Bağlantı yoksa ya da API cevap vermezse görev
          onay kuyruğuna (Görev talepleri) düşer, hiçbir üye takılmaz.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {SOCIAL_PLATFORMS.map((p) => (
          <PlatformRow key={p} platform={p} fields={fields[p]} state={summary[p]} />
        ))}
      </ul>
    </section>
  )
}
