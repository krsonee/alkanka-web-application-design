'use client'

import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { Card, Toggle, btn, btnDanger, btnGhost, input } from '@/components/panel/tg-hub-ui'
import { ButtonsField, type Update } from '@/components/panel/tg-post-fields'
import { ListenHelp, Note, badge, botLabel, useRun } from '@/components/panel/tg-post-ui'
import { deleteRuleAction, saveRuleAction } from '@/app/panel/tg-post-actions'
import { SIGNATURE_LIMIT, buttonProblems, signatureHtml, type ChannelRule, type PostButton, type PostCenterData } from '@/lib/tg-posts-shared'

type Draft = Pick<ChannelRule, 'botId' | 'chatId' | 'enabled' | 'signature' | 'sponsorId' | 'buttons'>

const fieldLabel = 'flex flex-col gap-1 text-xs text-muted-foreground'
const sameRule = (a: Pick<ChannelRule, 'botId' | 'chatId'>, b: Pick<ChannelRule, 'botId' | 'chatId'>) => a.botId === b.botId && a.chatId === b.chatId

export function ChannelRules({ data }: { data: PostCenterData }) {
  const blank = (): Draft => ({
    botId: (data.bots.find((b) => data.listening.includes(b.id)) ?? data.bots[0])?.id ?? 0,
    chatId: '',
    enabled: true,
    signature: '',
    sponsorId: '',
    buttons: [],
  })
  const [draft, setDraft] = useState<Draft>(blank)
  const [formKey, setFormKey] = useState(0)
  const { pending, msg, run } = useRun()

  if (!data.bots.length) {
    return (
      <Card title="Elle atılan postlar">
        <p className="text-sm leading-relaxed text-muted-foreground">Önce “Botlar → Bağlantı & Cron” sekmesinden bir bot ekle.</p>
      </Card>
    )
  }

  const bot = data.bots.find((b) => b.id === draft.botId) ?? data.bots[0]
  const listens = data.listening.includes(bot.id)
  const existing = data.rules.find((r) => sameRule(r, draft))
  const targets = data.targets.filter((t) => t.botId === bot.id)
  const sponsor = data.sponsors.find((s) => s.id === draft.sponsorId)
  const problems = [...new Set(buttonProblems(draft.buttons.flat()))]
  const empty = !draft.signature.trim() && !sponsor && !draft.buttons.length
  const setButtons: Update<PostButton[][]> = (fn) => setDraft((d) => ({ ...d, buttons: fn(d.buttons) }))

  const load = (next: Draft) => {
    setDraft(next)
    setFormKey((k) => k + 1)
  }
  const remove = async (rule: ChannelRule) => {
    if (!(await askConfirm(`“${rule.title}” kuralı silinsin mi? Daha önce eklenen imza ve butonlar postlarda kalır.`))) return
    run(
      () => deleteRuleAction(rule.botId, rule.chatId),
      (result) => result.ok && sameRule(rule, draft) && load(blank()),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Kanala telefondan ya da başka bir araçla atılan postlar bot tarafından görülür ve “Gönderilenler” listesine “Panel dışı” etiketiyle düşer. Buradaki kural, o postların altına
        imzayı ve butonları kendiliğinden ekler. Kural postun atılmasından yaklaşık yarım dakika sonra, sitedeki ilk ziyaretle ya da bota gelen ilk bildirimle uygulanır. Sadece kanallarda
        çalışır; bot kanalda yönetici olmalı ve “Mesajları düzenle” yetkisi açık olmalı.
      </p>

      {data.rules.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Kayıtlı kurallar">
          {data.rules.map((rule) => {
            const ruleBot = data.bots.find((b) => b.id === rule.botId)
            const ruleSponsor = data.sponsors.find((s) => s.id === rule.sponsorId)
            const count = rule.buttons.flat().length
            return (
              <li key={`${rule.botId}:${rule.chatId}`} className={cn('flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3', sameRule(rule, draft) ? 'border-primary' : 'border-border')}>
                <div className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 truncate text-sm font-semibold text-foreground">{rule.title}</span>
                    <span className={cn(badge, rule.enabled ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>{rule.enabled ? 'Açık' : 'Kapalı'}</span>
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                    {[ruleBot ? botLabel(ruleBot) : 'Bot silinmiş', rule.signature && `imza: ${rule.signature}`, ruleSponsor && `sponsor: ${ruleSponsor.name}`, count > 0 && `${count} buton`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                <button type="button" className={cn(btnGhost, 'gap-1.5')} disabled={pending} onClick={() => load({ ...rule })}>
                  <Pencil className="size-4" aria-hidden="true" />
                  Düzenle
                </button>
                <button type="button" className={cn(btnDanger, 'w-9 px-0')} disabled={pending} aria-label={`“${rule.title}” kuralını sil`} onClick={() => remove(rule)}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <Card title={existing ? `“${existing.title}” kuralını düzenle` : 'Yeni kural'} hint="Bir kanal için tek kural olur; aynı kanalı seçip kaydedersen eskisinin yerine geçer.">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={fieldLabel}>
            Kanalı izleyen bot
            <select className={input} value={bot.id} onChange={(e) => setDraft((d) => ({ ...d, botId: Number(e.target.value), chatId: '' }))}>
              {data.bots.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.username ? `${b.name} (@${b.username})` : b.name}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldLabel}>
            Kanal
            <select className={input} value={draft.chatId} onChange={(e) => setDraft((d) => ({ ...d, chatId: e.target.value }))}>
              <option value="">Kanal seç</option>
              {existing && !targets.some((t) => t.chatId === existing.chatId) && <option value={existing.chatId}>{existing.title}</option>}
              {targets.map((t) => (
                <option key={t.chatId} value={t.chatId}>
                  {t.title || t.chatId}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!targets.length && <p className="text-xs leading-relaxed text-muted-foreground">Bu botun kayıtlı hedefi yok. Kanalı önce “Yeni post” sekmesinde hedef olarak ekle.</p>}
        {!listens && <ListenHelp bot={bot} reason="kanala düşen postları göremez, kural çalışmaz." pending={pending} run={run} />}

        <Toggle label="Kural açık" hint="Kapalıyken postlar listeye düşmeye devam eder ama imza ve buton eklenmez." checked={draft.enabled} onChange={(enabled) => setDraft((d) => ({ ...d, enabled }))} />
        <label className={fieldLabel}>
          <span className="flex items-center justify-between gap-2">
            Yazının altına eklenecek imza (boş bırakabilirsin)
            <span className="shrink-0 tabular-nums">{`${draft.signature.length} / ${SIGNATURE_LIMIT}`}</span>
          </span>
          <input className={input} value={draft.signature} maxLength={SIGNATURE_LIMIT} placeholder="Örn: Alkanka · alkanka.com" onChange={(e) => setDraft((d) => ({ ...d, signature: e.target.value }))} />
        </label>
        <label className={fieldLabel}>
          Sponsor imzası
          <select className={input} value={sponsor ? draft.sponsorId : ''} onChange={(e) => setDraft((d) => ({ ...d, sponsorId: e.target.value }))}>
            <option value="">İmza ekleme</option>
            {data.sponsors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {sponsor && (
          <p
            className="text-xs leading-relaxed text-muted-foreground [&_a]:text-primary [&_a]:underline"
            onClickCapture={(e) => e.preventDefault()}
            // Built by signatureHtml from an escaped name and address.
            dangerouslySetInnerHTML={{ __html: `Yazının sonuna eklenir: ${signatureHtml(sponsor)}` }}
          />
        )}

        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-foreground">Her posta eklenecek butonlar</h4>
          <ButtonsField
            key={formKey}
            rows={draft.buttons}
            update={setButtons}
            listens={listens}
            bots={data.bots}
            listenHelp={<p className="text-xs leading-relaxed text-destructive">Bu buton türü, bot bildirimleri dinlemeden çalışmaz.</p>}
          />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Albüm olarak atılan postlara Telegram buton koydurmaz; onlara sadece imza eklenir. Yazısında özel emoji olan postların yazısına dokunulmaz, sadece buton eklenir. Eklenemeyen bir
          şey olursa “Gönderilenler” listesinde postun altında yazar.
        </p>

        {problems.length > 0 && (
          <ul role="alert" className="flex flex-col gap-1 text-sm leading-relaxed text-destructive">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btn}
            disabled={pending || !draft.chatId || empty || problems.length > 0 || !listens}
            onClick={() => run(() => saveRuleAction(draft), (result) => result.ok && load(blank()))}
          >
            {pending ? 'Kaydediliyor…' : !draft.chatId ? 'Önce kanal seç' : existing ? 'Kuralı güncelle' : 'Kuralı kaydet'}
          </button>
          {(existing || !empty) && (
            <button type="button" className={btnGhost} disabled={pending} onClick={() => load(blank())}>
              Formu temizle
            </button>
          )}
        </div>
        <Note msg={msg} />
      </Card>
    </div>
  )
}
