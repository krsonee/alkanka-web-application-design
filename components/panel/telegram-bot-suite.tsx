'use client'

import { useActionState, useTransition, useState } from 'react'
import { BellRing, Loader2, Pencil, Plus, Send, Share2, Trash2, Trophy } from 'lucide-react'
import {
  deleteShareRuleAction,
  saveApprovalsAction,
  saveOddsAction,
  saveShareAction,
  saveShareRuleAction,
  setOddsResultAction,
  testApprovalAction,
} from '@/app/panel/telegram-actions'
import type { ActionState } from '@/app/panel/actions'
import type { MirrorBot, MirrorTarget } from '@/lib/telegram-mirror'
import type { ApprovalKind, BotSuite, OddsDeal, ShareRule, ShareStatus } from '@/lib/telegram-bots'

const input = 'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'
const label = 'flex flex-col gap-1.5 text-sm font-medium text-foreground'
const hint = 'text-xs font-normal leading-relaxed text-muted-foreground'
const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60'

const APPROVAL_FIELDS: { kind: ApprovalKind; title: string }[] = [
  { kind: 'market', title: 'Market talebi mesajı' },
  { kind: 'task', title: 'Görev onayı mesajı' },
  { kind: 'complaint', title: 'Şikâyet mesajı' },
]

function Status({ state }: { state: ActionState }) {
  if (!state.message) return null
  return (
    <p role="status" className={`text-sm leading-relaxed ${state.ok ? 'text-primary' : 'text-destructive'}`}>
      {state.message}
    </p>
  )
}

function SectionHead({ icon, id, title, children }: { icon: React.ReactNode; id: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">{icon}</span>
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-base font-semibold text-foreground">
          {title}
        </h2>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </div>
  )
}

function BotSelect({ bots, value, name = 'botId' }: { bots: MirrorBot[]; value: number | null; name?: string }) {
  return (
    <select key={value ?? 'none'} name={name} defaultValue={value ?? ''} className={input}>
      <option value="">Bot seç</option>
      {bots.map((b) => (
        <option key={b.id} value={b.id}>
          @{b.username}
        </option>
      ))}
    </select>
  )
}

function TargetChecks({ targets, selected, emptyText }: { targets: MirrorTarget[]; selected: number[]; emptyText: string }) {
  if (!targets.length) return <p className={hint}>{emptyText}</p>
  return (
    <div className="flex flex-wrap gap-2">
      {targets.map((t) => (
        <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground has-[:checked]:border-primary has-[:checked]:bg-primary/5">
          <input type="checkbox" name="targetIds" value={t.id} defaultChecked={selected.includes(t.id)} className="accent-primary" />
          {t.title}
          {!t.active && <span className="text-xs text-muted-foreground">(kapalı)</span>}
        </label>
      ))}
    </div>
  )
}

export function ShareSection({ suite, bots, targets, status }: { suite: BotSuite; bots: MirrorBot[]; targets: MirrorTarget[]; status: ShareStatus }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveShareAction, {})
  const [adding, setAdding] = useState(false)
  const s = suite.share
  const activeCount = s.rules.filter((r) => r.enabled).length
  return (
    <section aria-labelledby="tg-share-title" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <SectionHead icon={<Share2 className="size-4" aria-hidden="true" />} id="tg-share-title" title="Post paylaşım botu">
        Her sponsorun (Makrobet, Betroza…) kendi destek grubunu ekle. O gruba tetik kelimesiyle atılan post (yazı, fotoğraf, video, albüm) o
        sponsor için seçtiğin kanallara paylaşılır, altına o sponsorun sabit metni eklenir.
      </SectionHead>

      <ul className="flex flex-col gap-1.5 rounded-xl bg-secondary/60 p-4 text-sm leading-relaxed text-muted-foreground">
        <li>Botu her sponsor destek grubuna ve tüm hedef kanallara yönetici olarak ekle.</li>
        <li>Canlı sohbet botunu seçersen anında çalışır. Başka bot seçersen paylaşım cron her çalıştığında yapılır.</li>
        <li>Tetik kelimesini boş bırakırsan o gruba atılan her post paylaşılır.</li>
      </ul>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
        <span>
          Durum: <strong className="text-foreground">{s.enabled ? 'Açık' : 'Kapalı'}</strong>
        </span>
        <span>
          Sponsor: <strong className="text-foreground">{activeCount}</strong> aktif / {s.rules.length}
        </span>
        <span>
          Paylaşılan post: <strong className="text-foreground">{status.shared}</strong>
        </span>
        {status.lastRunAt && <span>Son kontrol: {new Date(status.lastRunAt).toLocaleString('tr-TR')}</span>}
      </div>
      {status.lastError && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{status.lastError}</p>}

      <form action={action} className="flex flex-col gap-4 rounded-xl border border-border p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <label className={`${label} flex-1`}>
            Paylaşım botu (tüm sponsorlar için)
            <BotSelect bots={bots} value={s.botId} />
          </label>
          <label className="flex items-center gap-2 py-2.5 text-sm font-medium text-foreground">
            <input type="checkbox" name="enabled" defaultChecked={s.enabled} className="size-4 accent-primary" />
            Paylaşım botu açık
          </label>
          <button type="submit" disabled={pending} className={primaryBtn}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Kaydet
          </button>
        </div>
        <Status state={state} />
      </form>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">Sponsorlar ({s.rules.length})</h3>
          {!adding && (
            <button type="button" onClick={() => setAdding(true)} className={primaryBtn} disabled={!s.botId}>
              <Plus className="size-4" aria-hidden="true" />
              Sponsor ekle
            </button>
          )}
        </div>
        {!s.botId && <p className={hint}>Sponsor eklemek için önce paylaşım botunu seçip kaydet.</p>}
        {adding && <ShareRuleForm targets={targets} onDone={() => setAdding(false)} />}
        {s.rules.length === 0 && !adding && s.botId && <p className={hint}>Henüz sponsor yok. &quot;Sponsor ekle&quot; ile başla.</p>}
        {s.rules.map((rule) => (
          <ShareRuleCard key={rule.id} rule={rule} targets={targets} />
        ))}
      </div>
    </section>
  )
}

function ShareRuleCard({ rule, targets }: { rule: ShareRule; targets: MirrorTarget[] }) {
  const [open, setOpen] = useState(false)
  const [delState, delAction, deleting] = useActionState<ActionState, FormData>(deleteShareRuleAction, {})
  const targetNames = targets.filter((t) => rule.targetIds.includes(t.id)).map((t) => t.title)
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className={`size-2 rounded-full ${rule.enabled ? 'bg-primary' : 'bg-muted-foreground'}`} aria-hidden="true" />
            <strong className="truncate text-sm text-foreground">{rule.name}</strong>
            {!rule.enabled && <span className="text-xs text-muted-foreground">(kapalı)</span>}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Grup: {rule.sourceTitle} · Tetik: {rule.trigger || 'her post'} · Kanallar: {targetNames.join(', ') || 'yok'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-secondary"
          >
            <Pencil className="size-4" aria-hidden="true" />
            {open ? 'Kapat' : 'Düzenle'}
          </button>
          <form
            action={delAction}
            onSubmit={(e) => {
              if (!confirm(`"${rule.name}" sponsoru silinsin mi?`)) e.preventDefault()
            }}
          >
            <input type="hidden" name="id" value={rule.id} />
            <button
              type="submit"
              disabled={deleting}
              aria-label={`${rule.name} sponsorunu sil`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
              Sil
            </button>
          </form>
        </div>
      </div>
      <Status state={delState} />
      {open && <ShareRuleForm rule={rule} targets={targets} onDone={() => setOpen(false)} />}
    </div>
  )
}

function ShareRuleForm({ rule, targets, onDone }: { rule?: ShareRule; targets: MirrorTarget[]; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev: ActionState, form: FormData) => {
    const result = await saveShareRuleAction(prev, form)
    if (result.ok && !rule) onDone()
    return result
  }, {})
  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-primary/40 p-4">
      <input type="hidden" name="id" value={rule?.id ?? ''} />
      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
        <input type="checkbox" name="ruleEnabled" defaultChecked={rule?.enabled ?? true} className="size-4 accent-primary" />
        Bu sponsor için paylaşım açık
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className={label}>
          Sponsor adı
          <input name="name" defaultValue={rule?.name ?? ''} maxLength={60} placeholder="Makrobet" className={input} />
        </label>
        <label className={label}>
          Sponsor destek grubu
          <input name="sourceChat" defaultValue={rule?.sourceChat ?? ''} required placeholder="@grupadi ya da -100…" className={input} />
        </label>
        <label className={label}>
          Tetik kelimesi
          <input name="trigger" defaultValue={rule?.trigger ?? '#paylaş'} maxLength={40} placeholder="#paylaş" className={input} />
          <span className={hint}>Paylaşılan postta bu kelime silinir.</span>
        </label>
        <label className={label}>
          Gruba verilecek cevap
          <input name="replyText" defaultValue={rule?.replyText ?? 'Paylaşıldı:'} maxLength={200} className={input} />
          <span className={hint}>Altına paylaşılan post linkleri eklenir.</span>
        </label>
      </div>
      <label className={label}>
        Post altına eklenecek sabit metin
        <textarea name="appendText" defaultValue={rule?.appendText ?? 'Güncel giriş ve bonuslar: alkanka.com'} maxLength={600} rows={3} className={input} />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground">Paylaşılacak kanallar</legend>
        <TargetChecks targets={targets} selected={rule?.targetIds ?? []} emptyText="Önce yukarıdan hedef kanal ekle." />
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primaryBtn}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {rule ? 'Kaydet' : 'Sponsoru ekle'}
        </button>
        {!rule && (
          <button type="button" onClick={onDone} className="rounded-xl border border-border px-4 py-2.5 text-sm text-foreground hover:bg-secondary">
            Vazgeç
          </button>
        )}
        <Status state={state} />
      </div>
    </form>
  )
}

function OddsRow({ deal }: { deal: OddsDeal }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(setOddsResultAction, {})
  const [, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  const submit = (result: string) => {
    const form = new FormData()
    form.set('dealId', String(deal.id))
    form.set('result', result)
    startTransition(() => action(form))
    setConfirming(false)
  }

  const badge =
    deal.result === 'won' ? (
      <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">Kazandı</span>
    ) : deal.result === 'lost' ? (
      <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">Kaybetti</span>
    ) : (
      <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">Bekliyor</span>
    )

  return (
    <li className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate text-sm font-medium text-foreground">
            {deal.brand} · {deal.title}
          </p>
          <p className="text-xs text-muted-foreground">{new Date(deal.createdAt).toLocaleString('tr-TR')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {badge}
          {pending ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Kaydediliyor" />
          ) : confirming ? (
            <>
              <span className="text-xs text-muted-foreground">Kanallara duyurulsun mu?</span>
              <button type="button" onClick={() => submit('won')} className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground">
                Evet, duyur
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground">
                Vazgeç
              </button>
            </>
          ) : (
            <>
              {deal.result !== 'won' && (
                <button type="button" onClick={() => setConfirming(true)} className="rounded-lg border border-primary/40 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10">
                  Kazandı
                </button>
              )}
              {deal.result !== 'lost' && (
                <button type="button" onClick={() => submit('lost')} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary">
                  Kaybetti
                </button>
              )}
              {deal.result && (
                <button type="button" onClick={() => submit('')} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary">
                  Temizle
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <Status state={state} />
    </li>
  )
}

export function OddsSection({ suite, targets, deals }: { suite: BotSuite; targets: MirrorTarget[]; deals: OddsDeal[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveOddsAction, {})
  return (
    <section aria-labelledby="tg-odds-title" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <SectionHead icon={<Trophy className="size-4" aria-hidden="true" />} id="tg-odds-title" title="Özel oran botu">
        Kaynak kanallardan gelen özel oran postları ek kanallara da gönderilir ve altına notun eklenir. Oran kazanınca aşağıdan {'"Kazandı"'}ya bas,
        kazanç mesajı kanallara düşer.
      </SectionHead>

      <form action={action} className="flex flex-col gap-4">
        <label className={label}>
          Özel oran postlarına eklenecek not
          <input name="note" defaultValue={suite.odds.note} maxLength={300} placeholder="Örn. Oran sadece bugün geçerli." className={input} />
        </label>
        <label className={label}>
          Kazandı mesajı
          <textarea name="winText" defaultValue={suite.odds.winText} maxLength={1000} rows={4} className={input} />
          <span className={hint}>Kullanılabilir alanlar: {'{marka} {baslik} {link}'}</span>
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-foreground">Özel oranların ayrıca gideceği kanallar</legend>
          <span className={hint}>Kazandı mesajı da bu kanallara gider. Hiçbiri seçili değilse tüm açık hedef kanallara gider.</span>
          <TargetChecks targets={targets} selected={suite.odds.targetIds} emptyText="Önce yukarıdan hedef kanal ekle." />
        </fieldset>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className={primaryBtn}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Kaydet
          </button>
          <Status state={state} />
        </div>
      </form>

      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">Son özel oranlar</h3>
        {deals.length ? (
          <ul className="flex flex-col">
            {deals.map((d) => (
              <OddsRow key={d.id} deal={d} />
            ))}
          </ul>
        ) : (
          <p className={hint}>Henüz özel oran yok. Kaynak kanallardan özel oran geldikçe burada listelenir.</p>
        )}
      </div>
    </section>
  )
}

export function ApprovalSection({ suite, bots }: { suite: BotSuite; bots: MirrorBot[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveApprovalsAction, {})
  const [testState, testAction, testing] = useActionState<ActionState, FormData>(testApprovalAction, {})
  const a = suite.approvals
  return (
    <section aria-labelledby="tg-approval-title" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <SectionHead icon={<BellRing className="size-4" aria-hidden="true" />} id="tg-approval-title" title="Onay bildirim botu">
        Market talebi, onay bekleyen görev ve yeni şikâyet geldiğinde seçtiğin yönetici grubuna bildirim gider.
      </SectionHead>

      <p className="text-sm text-muted-foreground">
        Durum: <strong className="text-foreground">{a.enabled ? `Açık · ${a.chatTitle}` : 'Kapalı'}</strong>
      </p>

      <form action={action} className="flex flex-col gap-4">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input type="checkbox" name="enabled" defaultChecked={a.enabled} className="size-4 accent-primary" />
          Onay bildirimleri açık
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className={label}>
            Bot
            <BotSelect bots={bots} value={a.botId} />
          </label>
          <label className={label}>
            Yönetici grubu
            <input name="chatId" defaultValue={a.chatId} placeholder="@grupadi ya da -100…" className={input} />
          </label>
        </div>
        {APPROVAL_FIELDS.map((f) => (
          <label key={f.kind} className={label}>
            {f.title}
            <textarea name={`tpl_${f.kind}`} defaultValue={a.templates[f.kind]} maxLength={1000} rows={4} className={input} />
          </label>
        ))}
        <span className={hint}>Kullanılabilir alanlar: {'{uye} {detay} {tarih} {panel} {tur}'}</span>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className={primaryBtn}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Kaydet
          </button>
          <button
            type="submit"
            formAction={testAction}
            disabled={testing || !a.enabled}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-60"
          >
            {testing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
            Test gönder
          </button>
          <Status state={state} />
          <Status state={testState} />
        </div>
      </form>
    </section>
  )
}

export function TelegramBotSuite(props: { suite: BotSuite; bots: MirrorBot[]; targets: MirrorTarget[]; status: ShareStatus; deals: OddsDeal[] }) {
  return (
    <div className="flex flex-col gap-6">
      <ShareSection suite={props.suite} bots={props.bots} targets={props.targets} status={props.status} />
      <OddsSection suite={props.suite} targets={props.targets} deals={props.deals} />
      <ApprovalSection suite={props.suite} bots={props.bots} />
    </div>
  )
}
