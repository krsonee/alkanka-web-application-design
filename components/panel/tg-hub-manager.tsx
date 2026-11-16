'use client'


import { useState, useTransition } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { Plus, Trash2 } from 'lucide-react'
import type { MirrorBot } from '@/lib/telegram-mirror'
import { CANNED_MAX, CAPTCHA_MINUTES, CAPTCHA_MODES, RAID_BAN_MINUTES, REPLY_BUTTON_MAX, REPLY_RULE_MAX, REPLY_WORD_MAX, TG_GUIDE_URL } from '@/lib/tg-hub-shared'
import type { HubConfig, HubGroup, HubStats, KnownChat, LeaderRow, LockRow, LogPage, QuietRow, ReplyRule, SponsorSupportStat, TicketRow } from '@/lib/tg-hub-shared'
import { TelegramTabs } from '@/components/panel/telegram-tabs'
import { ChatField } from '@/components/panel/tg-chat-field'
import { Card, NumberField, Toggle, btn, btnGhost, input, useAction, useKnownChats, useTgAccess } from '@/components/panel/tg-hub-ui'
import { HistorySection } from '@/components/panel/tg-history-panel'
import { LogSection } from '@/components/panel/tg-log-panel'
import { MemberCardHost, MemberName, openMemberCard } from '@/components/panel/tg-member-card'
import { ReplyButtonsEditor } from '@/components/panel/tg-reply-buttons'
import { ShieldSection } from '@/components/panel/tg-shield-panel'
import { TicketDesk } from '@/components/panel/tg-support-desk'
import {
  addHubChat,
  findMemberAction,
  markTrusted,
  removeHubChat,
  saveHubSettings,
  sendWeeklyNow,
  setRoleBot,
  pumpWipes,
  repairTelegramAction,
  stopWipe,
  sweepGhosts,
  unbanEverywhere,
  wipeUserMessages,
  wipeWholeChat,
} from '@/app/panel/tg-hub-actions'

type HookInfo = { ok: boolean; pending: number; lastError: string | null } | null

export type TgHubData = {
  hub: HubConfig
  bots: MirrorBot[]
  stats: HubStats
  /** First page of the log; the Kayıtlar tab asks for anything beyond it. */
  log: LogPage
  locks: LockRow[]
  quiet: QuietRow[]
  tickets: TicketRow[]
  sponsorStats: SponsorSupportStat[]
  leaders: LeaderRow[]
  bans: { tgId: number; who: string; reason: string; createdAt: string }[]
  trustLow: { tgId: number; score: number; trusted: boolean; name: string }[]
  guardHook: HookInfo
  supportHook: HookInfo
  shareBotId: number | null
  shareHook: HookInfo
  linkedMembers: number
  /** Changes when the settings were rewritten from outside their own form; the forms are rebuilt on it. */
  rev: number
}

function HookBadge({ info }: { info: HookInfo }) {
  if (!info) return <span className="text-xs text-muted-foreground">Bot seçilmedi</span>
  if (info.ok && !info.lastError) return <span className="text-xs font-semibold text-primary">Çalışıyor · anında haber alıyor</span>
  return <span className="text-xs text-destructive">{info.lastError ? `Hata: ${info.lastError}` : 'Bağlantı kurulmamış, "Bağla" butonuna bas'}</span>
}

// --- Roles & chats -------------------------------------------------------------

function RoleRow({ role, label, hint, botId, bots, info }: { role: 'guard' | 'support' | 'share'; label: string; hint: string; botId: number | null; bots: MirrorBot[]; info: HookInfo }) {
  const [value, setValue] = useState(botId ? String(botId) : '')
  const a = useAction()
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <HookBadge info={info} />
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select aria-label={`${label} botu`} className={input} value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="">Bot seç</option>
          {bots.map((b) => (
            <option key={b.id} value={b.id}>
              @{b.username}
            </option>
          ))}
        </select>
        <button type="button" className={btn} disabled={a.pending || !value} onClick={() => a.run(() => setRoleBot(role, Number(value)))}>
          {a.pending ? 'Bağlanıyor…' : 'Bağla'}
        </button>
        {role !== 'share' && botId && (
          <button type="button" className={btnGhost} disabled={a.pending} onClick={() => a.run(() => setRoleBot(role, null))}>
            Kaldır
          </button>
        )}
      </div>
      {a.note}
    </div>
  )
}

function ChatAdder({ kind, placeholder, withName }: { kind: 'group' | 'log' | 'staff' | 'sponsor' | 'leader'; placeholder: string; withName?: boolean }) {
  const [value, setValue] = useState('')
  const [name, setName] = useState('')
  const a = useAction()
  const chats = useKnownChats()
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        {withName && <input aria-label="Sponsor adı" className={input} placeholder="Sponsor adı (ör. Betkanka)" value={name} onChange={(e) => setName(e.target.value)} />}
        <ChatField label="Grup ya da kanal" chats={chats} placeholder={placeholder} value={value} onChange={setValue} />
        <button
          type="button"
          className={btn}
          disabled={a.pending}
          onClick={() =>
            a.run(async () => {
              const r = await addHubChat(kind, value, name)
              if (r.ok) {
                setValue('')
                setName('')
              }
              return r
            })
          }
        >
          {a.pending ? 'Ekleniyor…' : 'Ekle'}
        </button>
      </div>
      {a.note}
    </div>
  )
}

/** What the guard actually does in this chat, so a channel on the list is not mistaken for a moderated group. */
function coverageOf(g: HubGroup, hub: HubConfig) {
  if (g.type === 'channel') {
    const watched = hub.shield.channelJoinAlert > 0 || hub.shield.adminAlerts
    return `Kanal · mesaj filtresi burada çalışmaz. Bekçi sadece /sil komutunu dinler${watched ? ', girişleri ve yönetici değişikliklerini izler' : '; giriş ve yönetici alarmı Koruma sekmesinden açılır'}.`
  }
  if (!g.type) return null
  const linked = g.linkedChatId ? hub.groups.find((x) => x.chatId === g.linkedChatId) : null
  const role = g.linkedChatId ? `Yorum grubu${linked ? ` (${linked.title})` : ''}` : 'Grup'
  return `${role} · tüm mesaj kuralları çalışır${g.rules ? ', bu gruba özel ayar var' : ''}.`
}

function ChatChip({ kind, id, label, note }: { kind: 'group' | 'log' | 'staff' | 'sponsor' | 'leader'; id: string; label: string; note?: string | null }) {
  const a = useAction()
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-foreground">{label}</span>
        {note && <span className="text-xs leading-relaxed text-muted-foreground">{note}</span>}
      </span>
      <button type="button" className="shrink-0 text-xs text-destructive hover:underline disabled:opacity-50" disabled={a.pending} onClick={() => a.run(() => removeHubChat(kind, id))}>
        Kaldır
      </button>
    </li>
  )
}

function RepairCard() {
  const a = useAction()
  return (
    <Card title="Sistem kontrolü" hint="Bir botu silip yeniden eklediysen ya da bir bölüm çalışmıyorsa önce buna bas. Silinmiş botlara bakan ayarları temizler, yanlış yere bakan webhook'ları düzeltir.">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} disabled={a.pending} onClick={() => a.run(() => repairTelegramAction())}>
          {a.pending ? 'Kontrol ediliyor…' : 'Kontrol et ve onar'}
        </button>
        <a className={btnGhost} href={TG_GUIDE_URL} target="_blank" rel="noreferrer">
          Kullanım kılavuzunu aç
        </a>
        <a className={btnGhost} href={`${TG_GUIDE_URL}?indir=1`} download="alkanka-telegram-kilavuz.html">
          Kılavuzu indir
        </a>
      </div>
      {a.note}
    </Card>
  )
}

function SetupSection({ d }: { d: TgHubData }) {
  const { hub } = d
  return (
    <div className="flex flex-col gap-4">
      <RepairCard />
      <Card title="1. Botları görevlere ata" hint="Her rol için ayrı bot önerilir. Aynı bot birden fazla rol yapabilir ama Oran ve KankaTV botlarını burada kullanma.">
        <RoleRow role="guard" label="Bekçi (güvenlik + kontrolcü + sayaç)" hint="Gruplarda küfür, spam, reklam, bot saldırısı ve sahte hesapları engeller; mesajları sayar." botId={hub.guardBotId} bots={d.bots} info={d.guardHook} />
        <RoleRow role="support" label="Destek botu" hint="Üyeler bu bota özelden yazar. Sorun yetkili grubuna ve sponsor grubuna bilet olarak düşer." botId={hub.supportBotId} bots={d.bots} info={d.supportHook} />
        <RoleRow
          role="share"
          label="Postçu (anında paylaşım)"
          hint="Paylaşımları yapan bot. Burada seçip Bağla dersen Post Paylaşım sekmesindeki bot da bu olur ve paylaşımlar beklemeden anında çıkar."
          botId={d.shareBotId}
          bots={d.bots}
          info={d.shareHook}
        />
      </Card>
      <Card title="2. Korunacak gruplar" hint="Bekçi'yi grupta yönetici yap (mesaj silme, üye engelleme, üye ekleme izinleri açık). Sonra grubun @adresini ya da ID'sini buraya yaz.">
        <ChatAdder kind="group" placeholder="@alkankasohbet ya da -100…" />
        {hub.groups.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {hub.groups.map((g) => (
              <ChatChip key={g.chatId} kind="group" id={g.chatId} label={g.title} note={coverageOf(g, hub)} />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Henüz grup eklenmedi.</p>
        )}
      </Card>
      <Card title="3. Kayıt (log) grubu" hint="Sadece yöneticilerin olduğu gizli bir grup aç, Bekçi'yi yönetici yap. Silinen, susturulan, banlanan her şey ve haftalık rapor buraya düşer.">
        {hub.logChatId ? <ul><ChatChip kind="log" id={hub.logChatId} label={hub.logChatTitle} /></ul> : <ChatAdder kind="log" placeholder="Log grubunun ID'si (-100…)" />}
      </Card>
    </div>
  )
}

// --- Guard settings ------------------------------------------------------------

function GuardSection({ d }: { d: TgHubData }) {
  const [cfg, setCfg] = useState(d.hub)
  const [words, setWords] = useState(d.hub.guard.words.join(', '))
  const [domains, setDomains] = useState(d.hub.guard.allowDomains.join(', '))
  const [mutes, setMutes] = useState(d.hub.guard.muteMinutes.join(', '))
  const a = useAction()
  const g = cfg.guard
  const set = (patch: Partial<HubConfig['guard']>) => setCfg((c) => ({ ...c, guard: { ...c.guard, ...patch } }))
  const split = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean)
  const save = () =>
    a.run(() =>
      saveHubSettings({
        ...cfg,
        guard: { ...g, words: split(words), allowDomains: split(domains), muteMinutes: split(mutes).map(Number) },
      }),
    )
  return (
    <div className="flex flex-col gap-4">
      <Toggle label="Bekçi açık" hint="Kapalıyken bot hiçbir şeye dokunmaz." checked={g.enabled} onChange={(v) => set({ enabled: v })} />
      <Card title="Güvenlik (saldırı koruması)">
        <div className="grid gap-2 md:grid-cols-2">
          <Toggle label="Yeni gelene doğrulama (captcha)" hint={`Katılan kişi ${CAPTCHA_MINUTES} dakika içinde butona basmazsa atılır. Botları durdurur.`} checked={g.captcha} onChange={(v) => set({ captcha: v })} />
          <Toggle label="Bilinen spam hesap kontrolü" hint="Dünya çapındaki spam listesindeki hesaplar girer girmez banlanır." checked={g.casCheck} onChange={(v) => set({ casCheck: v })} />
          <Toggle label="Sahte yönetici koruması" hint="Adında Alkanka, admin, destek geçen ve yönetici taklidi yapan hesaplar engellenir." checked={g.impersonation} onChange={(v) => set({ impersonation: v })} />
          <Toggle label="Katıldı/ayrıldı yazılarını sil" checked={g.cleanService} onChange={(v) => set({ cleanService: v })} />
        </div>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Doğrulama türü
          <select className={input} value={g.captchaMode} disabled={!g.captcha} onChange={(e) => set({ captchaMode: e.target.value as HubConfig['guard']['captchaMode'] })}>
            {CAPTCHA_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <span className="leading-relaxed">{CAPTCHA_MODES.find((m) => m.value === g.captchaMode)?.hint}</span>
        </label>
        <NumberField label={`Baskın koruması: 1 dakikada bu sayıdan fazla kişi girerse sonraki gelenler ${RAID_BAN_MINUTES} dakikalığına gruptan çıkarılır, kalıcı banlanmaz (0 = kapalı)`} value={g.raidJoins} onChange={(v) => set({ raidJoins: v })} suffix="kişi" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          {d.hub.shield.raidMode
            ? `Baskın modu açık: bu sayı aşılınca grup ${d.hub.shield.raidMinutes} dakikalığına baskın moduna girer. Ayarı Koruma sekmesinde.`
            : 'Grubun kilitlenmesi, toplu üye ekleme, yorum kalkanı ve diğer korumalar Koruma sekmesinde; hepsi kapalı başlar.'}
        </p>
      </Card>
      <Card title="Kontrolcü (küfür, spam, reklam)">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Yasaklı kelimeler (virgülle ayır). Harf oyunlarını (a.m.k, 4mk) bot kendisi çözer.
          <textarea className="min-h-20 rounded-lg border border-border bg-background p-3 text-sm text-foreground" value={words} onChange={(e) => setWords(e.target.value)} />
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <NumberField label="Kaç uyarıdan sonra susturulsun" value={g.warnLimit} onChange={(v) => set({ warnLimit: v })} />
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Susturma süreleri (dakika, sırayla artar)
            <input className={input} value={mutes} onChange={(e) => setMutes(e.target.value)} />
          </label>
          <NumberField label="Flood: bu kadar mesaj…" value={g.floodCount} onChange={(v) => set({ floodCount: v })} suffix="mesaj" />
          <NumberField label="…bu kadar saniye içinde" value={g.floodSeconds} onChange={(v) => set({ floodSeconds: v })} suffix="sn" />
          <NumberField label="Flood yapan kaç dakika sussun" value={g.floodMuteMinutes} onChange={(v) => set({ floodMuteMinutes: v })} suffix="dk" />
          <NumberField label="Aynı mesajı kaç kez tekrarlarsa sussun" value={g.repeatLimit} onChange={(v) => set({ repeatLimit: v })} />
        </div>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          İzinli linkler (bunlar dışındaki her link reklam sayılır)
          <input className={input} value={domains} onChange={(e) => setDomains(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Yabancı link atana ne yapılsın
          <select className={input} value={g.linkAction} onChange={(e) => set({ linkAction: e.target.value as 'ban' | 'warn' })}>
            <option value="ban">Sil ve banla (önerilen)</option>
            <option value="warn">Sil ve uyar</option>
          </select>
        </label>
        <div className="grid gap-2 md:grid-cols-2">
          <Toggle label="Başka kanaldan iletilen mesajları sil" hint="Reklamcılar genelde iletme ile reklam yapar." checked={g.blockForwards} onChange={(v) => set({ blockForwards: v })} />
          <Toggle label="Yapay zekâ moderasyonu" hint="Listeye takılmayan hakaret ve dolandırıcılık mesajlarını anlar. Şüpheli mesajı siler, log grubuna yazar." checked={g.aiModeration} onChange={(v) => set({ aiModeration: v })} />
        </div>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Grup kuralları (/kurallar yazınca gösterilir)
          <textarea className="min-h-24 rounded-lg border border-border bg-background p-3 text-sm text-foreground" value={g.rules} onChange={(e) => set({ rules: e.target.value })} />
        </label>
      </Card>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btn} disabled={a.pending} onClick={save}>
          {a.pending ? 'Kaydediliyor…' : 'Bekçi ayarlarını kaydet'}
        </button>
        {a.note}
      </div>
    </div>
  )
}

// --- Support -------------------------------------------------------------------

function SupportSection({ d }: { d: TgHubData }) {
  const [cfg, setCfg] = useState(d.hub)
  const [cats, setCats] = useState(d.hub.support.categories.join(', '))
  const a = useAction()
  const s = cfg.support
  const set = (patch: Partial<HubConfig['support']>) => setCfg((c) => ({ ...c, support: { ...c.support, ...patch } }))
  const setCanned = (index: number, patch: Partial<HubConfig['support']['canned'][number]>) => set({ canned: s.canned.map((c, i) => (i === index ? { ...c, ...patch } : c)) })
  const { setup } = useTgAccess()
  return (
    <div className="flex flex-col gap-4">
      {setup && (
        <>
      <Toggle label="Destek botu açık" checked={s.enabled} onChange={(v) => set({ enabled: v })} />
      <Card title="Yetkili grubu" hint="Alkanka ekibinin olduğu grup. Tüm biletler buraya düşer. Destek botunu bu grupta yönetici yap.">
        {d.hub.support.staffChatId ? <ul><ChatChip kind="staff" id={d.hub.support.staffChatId} label={d.hub.support.staffChatTitle} /></ul> : <ChatAdder kind="staff" placeholder="Yetkili grubunun ID'si (-100…)" />}
      </Card>
      <Card title="Sponsor destek grupları" hint="Her sponsorla ortak bir grup aç (sen + sponsorun yetkilisi + Destek botu). O sponsorla ilgili biletler o gruba da düşer, sponsor yetkilisi gruptan cevaplar.">
        <ChatAdder kind="sponsor" placeholder="Sponsor grubunun ID'si (-100…)" withName />
        {d.hub.support.sponsors.length > 0 && (
          <ul className="flex flex-col gap-2">
            {d.hub.support.sponsors.map((sp) => (
              <ChatChip key={sp.name} kind="sponsor" id={sp.name} label={`${sp.name} → ${sp.title}`} />
            ))}
          </ul>
        )}
      </Card>
      <Card title="Bot ayarları">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Karşılama mesajı
          <textarea className="min-h-16 rounded-lg border border-border bg-background p-3 text-sm text-foreground" value={s.welcome} onChange={(e) => set({ welcome: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Sorun türleri (virgülle)
          <input className={input} value={cats} onChange={(e) => setCats(e.target.value)} />
        </label>
        <Toggle label="Sık sorulara otomatik cevap" hint="Üyenin sorusu sitedeki SSS'de varsa bot önce cevabı gösterir. 'Çözülmedi' derse bilet açılır." checked={s.aiFaq} onChange={(v) => set({ aiFaq: v })} />
        <NumberField
          label="Cevapsız bilet uyarısı: bir bileti bu kadar dakika kimse üstlenmezse yetkili grubuna bir kez hatırlatma gider ve bilet panelde kırmızı işaretlenir (0 = kapalı, en az 5)"
          value={s.alertMinutes}
          onChange={(v) => set({ alertMinutes: v })}
          suffix="dk"
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Hatırlatma dakikası dakikasına gelmez: sitede dakikalık zamanlayıcı çalışmadığı için süre dolduktan sonraki ilk site ziyaretinde gönderilir.
        </p>
        <div role="group" aria-label="Hazır cevaplar" className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">
            Hazır cevaplar: bilet cevaplarken listeden seçilir, cevap kutusuna yazılır; göndermeden önce düzeltebilirsin (en fazla {CANNED_MAX})
          </span>
          {s.canned.map((c, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <input aria-label={`${i + 1}. hazır cevabın başlığı`} className={input} placeholder="Başlık (örnek: Çekim süresi)" maxLength={40} value={c.title} onChange={(e) => setCanned(i, { title: e.target.value })} />
                <button
                  type="button"
                  aria-label={`${i + 1}. hazır cevabı sil`}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-destructive"
                  onClick={() => set({ canned: s.canned.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
              <textarea
                aria-label={`${i + 1}. hazır cevabın yazısı`}
                className="min-h-16 rounded-lg border border-border bg-background p-2 text-sm text-foreground"
                placeholder="Üyeye gidecek cevap"
                maxLength={1000}
                value={c.text}
                onChange={(e) => setCanned(i, { text: e.target.value })}
              />
            </div>
          ))}
          {s.canned.length < CANNED_MAX && (
            <button type="button" className={`${btnGhost} gap-1.5 self-start`} onClick={() => set({ canned: [...s.canned, { title: '', text: '' }] })}>
              <Plus className="size-4" aria-hidden="true" />
              Hazır cevap ekle
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={btn} disabled={a.pending} onClick={() => a.run(() => saveHubSettings({ ...cfg, support: { ...s, categories: cats.split(',').map((x) => x.trim()).filter(Boolean) } }))}>
            {a.pending ? 'Kaydediliyor…' : 'Destek ayarlarını kaydet'}
          </button>
          {a.note}
        </div>
      </Card>
        </>
      )}
      <TicketDesk tickets={d.tickets} canned={d.hub.support.canned} alertMinutes={d.hub.support.alertMinutes} />
      <Card title="Sponsor destek karnesi (son 7 gün)" hint="Bu veriler Güven Merkezi'ndeki sponsor karnesine de otomatik yansır.">
        {d.sponsorStats.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 font-semibold">Sponsor</th>
                  <th className="py-1 font-semibold">Talep</th>
                  <th className="py-1 font-semibold">Çözülen</th>
                  <th className="py-1 font-semibold">Red</th>
                  <th className="py-1 font-semibold">Ort. süre</th>
                  <th className="py-1 font-semibold">Puan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {d.sponsorStats.map((x) => (
                  <tr key={x.sponsor}>
                    <td className="py-1.5 font-medium text-foreground">{x.sponsor}</td>
                    <td className="py-1.5 tabular-nums">{x.total}</td>
                    <td className="py-1.5 tabular-nums">{x.resolved}</td>
                    <td className="py-1.5 tabular-nums">{x.rejected}</td>
                    <td className="py-1.5 tabular-nums">{x.avgMin != null ? `${x.avgMin} dk` : '—'}</td>
                    <td className="py-1.5 tabular-nums">{x.rating != null ? `${x.rating}/5` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Henüz veri yok.</p>
        )}
      </Card>
    </div>
  )
}

// --- Counter --------------------------------------------------------------------

const replyArea = 'min-h-20 rounded-lg border border-border bg-background p-3 text-sm text-foreground'

/** Keeps the trigger words as typed text, so a comma or a space can be entered before the next word exists. */
function ReplyRuleEditor({ rule, index, onChange, onRemove }: { rule: ReplyRule; index: number; onChange: (patch: Partial<ReplyRule>) => void; onRemove: () => void }) {
  const [words, setWords] = useState(rule.words.join(', '))
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input type="checkbox" className="size-4 accent-primary" checked={rule.enabled} onChange={(e) => onChange({ enabled: e.target.checked })} />
          {index + 1}. kural açık
        </label>
        <button type="button" className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive hover:underline" onClick={onRemove}>
          <Trash2 className="size-3.5" aria-hidden="true" />
          Kuralı sil
        </button>
      </div>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Tetikleyici kelimeler (virgülle ayır, en fazla {REPLY_WORD_MAX})
        <input
          className={input}
          placeholder="bonus, çevrim, promosyon"
          value={words}
          onChange={(e) => {
            setWords(e.target.value)
            onChange({ words: e.target.value.split(',').map((w) => w.trim()).filter(Boolean) })
          }}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Botun cevabı
        <textarea className={replyArea} maxLength={1000} value={rule.text} onChange={(e) => onChange({ text: e.target.value })} />
      </label>
      <ReplyButtonsEditor value={rule.buttons} onChange={(buttons) => onChange({ buttons })} max={REPLY_BUTTON_MAX} />
    </li>
  )
}

function AutoReplySection({ d }: { d: TgHubData }) {
  const [cfg, setCfg] = useState(d.hub)
  const a = useAction()
  const r = cfg.autoReply
  const set = (patch: Partial<HubConfig['autoReply']>) => setCfg((c) => ({ ...c, autoReply: { ...c.autoReply, ...patch } }))
  const setRule = (id: string, patch: Partial<ReplyRule>) => set({ rules: r.rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)) })
  const setWelcome = (patch: Partial<HubConfig['autoReply']['welcome']>) => set({ welcome: { ...r.welcome, ...patch } })
  const area = replyArea
  return (
    <div className="flex flex-col gap-4">
      <Toggle
        label="Oto cevap açık"
        hint="Bekçi botu, sohbet grubunda biri 'site' ya da 'sponsor' yazınca (sitesi, siteye, sponsorlar gibi kelimenin içinde geçse de) kısa bir mesaj ve butonlarla cevap verir. Cevap 10 dakika sonra kendiliğinden silinir."
        checked={r.enabled}
        onChange={(v) => set({ enabled: v })}
      />
      <Card title="Site linki" hint="Boş bırakırsan sitenin şu anki ana adresi kullanılır. Adres değişirse buraya yeni adresi yaz, bot hemen onu atmaya başlar.">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Güncel site adresi
          <input className={input} placeholder="https://alkanka.com" value={r.siteUrl} onChange={(e) => set({ siteUrl: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {"'site' yazılınca gidecek mesaj"}
          <textarea className={area} value={r.siteText} onChange={(e) => set({ siteText: e.target.value })} />
        </label>
      </Card>
      <Card title="Sponsor listesi" hint="Butonlar Sponsorlar sayfasındaki aktif sponsorlardan otomatik gelir ve tıklamalar sitede sayılır. Altında 'Tüm sponsorlar' butonu da olur.">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {"'sponsor' yazılınca gidecek mesaj"}
          <textarea className={area} value={r.sponsorText} onChange={(e) => set({ sponsorText: e.target.value })} />
        </label>
        <NumberField label="Kaç sponsor butonu gösterilsin" value={r.sponsorLimit} onChange={(v) => set({ sponsorLimit: v })} suffix="buton" />
      </Card>
      <Card
        title={`Kendi kuralların (${r.rules.length}/${REPLY_RULE_MAX})`}
        hint="Kelime, mesajdaki bir kelimenin başında geçerse cevap gider: 'bonus' yazarsan 'bonuslar' da tetikler, 'abonus' tetiklemez. Büyük-küçük harf ve Türkçe karakter fark etmez. Birden çok kural uyarsa listede üstteki kazanır. Kendi kuralların, yukarıdaki 'site' ve 'sponsor' cevaplarından önce bakılır. Bu cevaplar da 10 dakika sonra silinir."
      >
        {r.rules.length > 0 && (
          <ul className="flex flex-col gap-3">
            {r.rules.map((rule, i) => (
              <ReplyRuleEditor key={rule.id} rule={rule} index={i} onChange={(patch) => setRule(rule.id, patch)} onRemove={() => set({ rules: r.rules.filter((x) => x.id !== rule.id) })} />
            ))}
          </ul>
        )}
        {r.rules.length < REPLY_RULE_MAX && (
          <button
            type="button"
            className={`${btnGhost} gap-1.5 self-start`}
            onClick={() => set({ rules: [...r.rules, { id: Math.random().toString(36).slice(2, 10).padEnd(6, '0'), enabled: true, words: [], text: '', buttons: [] }] })}
          >
            <Plus className="size-4" aria-hidden="true" />
            Kural ekle
          </button>
        )}
      </Card>
      <Card
        title="Karşılama mesajı"
        hint="Gruba yeni giren üyeye atılır; doğrulama açıksa doğrulamayı geçtikten sonra. Oto cevap kapalı olsa da çalışır, Bekçi açık olmalıdır. Aynı anda çok kişi girerse 20 saniyede en fazla bir karşılama atılır."
      >
        <Toggle label="Karşılama mesajı açık" checked={r.welcome.enabled} onChange={(v) => setWelcome({ enabled: v })} />
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {'Mesaj ({isim} yazdığın yere üyenin adı gelir)'}
          <textarea className={area} maxLength={1000} value={r.welcome.text} onChange={(e) => setWelcome({ text: e.target.value })} />
        </label>
        <ReplyButtonsEditor value={r.welcome.buttons} onChange={(buttons) => setWelcome({ buttons })} max={REPLY_BUTTON_MAX} />
        <NumberField label="Karşılama mesajı kaç dakika sonra silinsin (0 = silinmez)" value={r.welcome.deleteMinutes} onChange={(v) => setWelcome({ deleteMinutes: v })} suffix="dk" />
      </Card>
      <Card title="Spam koruması">
        <NumberField label="Aynı cevap aynı grupta en erken kaç saniyede bir atılsın" value={r.cooldownSeconds} onChange={(v) => set({ cooldownSeconds: v })} suffix="sn" />
      </Card>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btn} disabled={a.pending} onClick={() => a.run(() => saveHubSettings(cfg))}>
          {a.pending ? 'Kaydediliyor…' : 'Oto cevabı kaydet'}
        </button>
        {a.note}
      </div>
    </div>
  )
}

function CounterSection({ d }: { d: TgHubData }) {
  const [cfg, setCfg] = useState(d.hub)
  const [rewards, setRewards] = useState(d.hub.counter.rewards.join(', '))
  const a = useAction()
  const c = cfg.counter
  return (
    <div className="flex flex-col gap-4">
      <Toggle label="Mesaj sayacı açık" hint="Telegram gruplarında ve sitedeki canlı sohbette yazılanları sayar. Grupta /liste haftanın sıralamasını, /ben kişinin kendi sırasını gösterir." checked={c.enabled} onChange={(v) => setCfg((x) => ({ ...x, counter: { ...x.counter, enabled: v } }))} />
      <Card title="Ayarlar" hint="Pazartesi 00:00'da geçen haftanın listesi gruba atılır, ödüller hesabını siteye bağlamış üyelere otomatik yüklenir.">
        <NumberField label="En az kaç harf olan mesaj sayılsın (tek harf spamı sayılmaz)" value={c.minLength} onChange={(v) => setCfg((x) => ({ ...x, counter: { ...x.counter, minLength: v } }))} />
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Haftalık ödüller (1., 2., 3. … sırayla KC)
          <input className={input} value={rewards} onChange={(e) => setRewards(e.target.value)} />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={btn} disabled={a.pending} onClick={() => a.run(() => saveHubSettings({ ...cfg, counter: { ...c, rewards: rewards.split(',').map(Number) } }))}>
            Kaydet
          </button>
          {a.note}
        </div>
      </Card>
      <Card title="Liste hangi gruba atılsın" hint="Boş bırakırsan ilk korunan gruba atılır.">
        {d.hub.counter.postToChatId ? (
          <ul><ChatChip kind="leader" id={d.hub.counter.postToChatId} label={d.hub.groups.find((g) => g.chatId === d.hub.counter.postToChatId)?.title ?? d.hub.counter.postToChatId} /></ul>
        ) : (
          <ChatAdder kind="leader" placeholder="@grup ya da -100…" />
        )}
      </Card>
      <Card title="Bu haftanın en çok yazanları">
        {d.leaders.length ? (
          <ol className="flex flex-col gap-1 text-sm">
            {d.leaders.map((l, i) => (
              <li key={l.key} className="flex justify-between gap-2">
                <span className="text-foreground">
                  {i + 1}. {l.name}
                </span>
                <span className="tabular-nums text-muted-foreground">{l.count} mesaj</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-muted-foreground">Bu hafta sayılan mesaj yok.</p>
        )}
      </Card>
    </div>
  )
}

// --- Cleanup ---------------------------------------------------------------------

function WipeProgress() {
  const { data: jobs, mutate } = useSWR('tg-wipe-jobs', () => pumpWipes(), {
    refreshInterval: (latest) => (latest?.some((j) => !j.note) ? 2000 : 15000),
    revalidateOnFocus: true,
  })
  const stop = useAction()
  if (!jobs?.length) return null
  return (
    <Card title="Çalışan temizlikler" hint="Bu sayfa açık kaldıkça temizlik kesintisiz ilerler. Sayfayı kapatırsan siteye gelen trafikle yavaş yavaş devam eder.">
      <ul className="flex flex-col gap-4">
        {jobs.map((j) => {
          const scanned = Math.max(0, j.total - j.left)
          const pct = j.total ? Math.min(100, Math.round((scanned / j.total) * 100)) : 0
          return (
            <li key={j.chatId} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <span
                    className={j.note ? 'size-2 rounded-full bg-destructive' : 'size-2 animate-pulse rounded-full bg-primary'}
                    aria-hidden="true"
                  />
                  {j.title}
                </span>
                <span className="tabular-nums text-muted-foreground">%{pct}</span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label={`${j.title} temizlik ilerlemesi`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
              >
                <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${pct}%` }} />
              </div>
              {j.note && <p className="text-sm text-destructive text-pretty">{j.note}</p>}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {j.deleted.toLocaleString('tr-TR')} mesaj gerçekten silindi · {scanned.toLocaleString('tr-TR')} /{' '}
                  {j.total.toLocaleString('tr-TR')} numara tarandı
                </span>
                <button
                  type="button"
                  className={btnGhost}
                  disabled={stop.pending}
                  onClick={() =>
                    stop.run(async () => {
                      const r = await stopWipe(j.chatId)
                      await mutate()
                      return r
                    })
                  }
                >
                  {j.note ? 'Kapat' : 'Durdur'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      {stop.note}
    </Card>
  )
}

function CleanupSection({ d }: { d: TgHubData }) {
  const [chat, setChat] = useState(d.hub.groups[0]?.chatId ?? '')
  const [tgId, setTgId] = useState('')
  const ghost = useAction()
  const wipe = useAction()
  const wipeAll = useAction()
  const [wipeTarget, setWipeTarget] = useState(d.hub.groups[0]?.chatId ?? '')
  const [confirmWipe, setConfirmWipe] = useState(false)
  const { mutate: globalMutate } = useSWRConfig()
  const mutate = () => globalMutate('tg-wipe-jobs')
  const { owner } = useTgAccess()
  // The guard bot does the cleaning, so only chats it works in are offered by name.
  const guarded: KnownChat[] = d.hub.groups.map((g) => ({ chatId: g.chatId, title: g.title }))
  return (
    <div className="flex flex-col gap-4">
      <WipeProgress />
      {!owner && (
        <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm leading-relaxed text-muted-foreground">
          Bir sohbetin tüm geçmişini silmek sadece ana yöneticiye açık. Aşağıdaki diğer temizlikleri kullanabilirsin.
        </p>
      )}
      {owner && (
      <Card title="Sohbeti komple temizle (tüm geçmiş)" hint="Seçtiğin grup ya da kanaldaki mesajları en yeniden en eskiye siler. Önemli: Telegram botlara sadece son 48 saatteki mesajları sildirir; daha eski postlara ulaşınca bot durur ve haber verir, onları Telegram uygulamasından elle silmen gerekir. Grupta veya kanalda /sil yazıp çıkan butona basarak da başlatabilirsin. Bir mesaja yanıt olarak /sil yazarsan sadece o mesaj silinir. Bot orada 'Mesajları sil' yetkisiyle yönetici olmalı. Listede olmayan bir kanal için @kullaniciadi ya da -100… ID yazabilirsin.">
        <div className="flex flex-col gap-2 sm:flex-row">
          <ChatField
            label="Grup veya kanal"
            chats={guarded}
            placeholder="@kanal ya da -100…"
            value={wipeTarget}
            onChange={(v) => {
              setWipeTarget(v)
              setConfirmWipe(false)
            }}
          />
          {confirmWipe ? (
            <button
              type="button"
              className={btn}
              disabled={wipeAll.pending}
              onClick={() => {
                setConfirmWipe(false)
                wipeAll.run(async () => {
                  const r = await wipeWholeChat(wipeTarget)
                  await mutate()
                  return r
                })
              }}
            >
              {wipeAll.pending ? 'Siliniyor…' : 'Eminim, hepsini sil'}
            </button>
          ) : (
            <button type="button" className={btn} disabled={wipeAll.pending || !wipeTarget.trim()} onClick={() => setConfirmWipe(true)}>
              {wipeAll.pending ? 'Siliniyor…' : 'Tüm geçmişi sil'}
            </button>
          )}
        </div>
        {confirmWipe && <p className="text-sm text-destructive">Geri alınamaz. Onaylamak için butona bir kez daha bas.</p>}
        {wipeAll.note}
      </Card>
      )}
      <Card title="Silinmiş hesapları topluca çıkar" hint="Grubu tarar, 'Silinmiş Hesap' görünen üyeleri çıkarır. Listeden seç ya da @kullaniciadi / -100… ID yaz. Grupta /hayalet yazarak da çalıştırabilirsin.">
        <div className="flex flex-col gap-2 sm:flex-row">
          <ChatField label="Grup" chats={guarded} placeholder="@grup ya da -100…" value={chat} onChange={setChat} />
          <button type="button" className={btn} disabled={ghost.pending || !chat.trim()} onClick={() => ghost.run(() => sweepGhosts(chat))}>
            {ghost.pending ? 'Taranıyor…' : 'Taramayı başlat'}
          </button>
        </div>
        {ghost.note}
        <p className="text-xs leading-relaxed text-muted-foreground">
          Kanallar için önemli: Telegram, kanal abone listesini hiçbir bota vermez. Kanaldaki silinmiş aboneleri sadece Telegram uygulamasından (Kanal bilgisi &gt; Aboneler) elle çıkarabilirsin. Gruplarda da bot, gruba girdikten sonra yazmış üyeleri tanıyabilir.
        </p>
      </Card>
      <Card title="Bir kişinin mesajlarını topluca sil" hint="Kişinin @kullanıcı adını ya da Telegram ID'sini yaz (ID, log grubunda her kaydın yanında yazar). Kullanıcı adıyla arama, son 35 günde korunan gruplarda yazmış kişilerde çalışır. Son 48 saatteki tüm mesajları tüm gruplardan silinir.">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input aria-label="Kullanıcı adı ya da Telegram ID" className={input} placeholder="@kullaniciadi ya da 123456789" value={tgId} onChange={(e) => setTgId(e.target.value)} />
          <button type="button" className={btn} disabled={wipe.pending || !tgId.trim()} onClick={() => wipe.run(() => wipeUserMessages(tgId))}>
            {wipe.pending ? 'Siliniyor…' : 'Mesajlarını sil'}
          </button>
        </div>
        {wipe.note}
      </Card>
      <Card title="Grupta kullanılan temizlik komutları">
        <ul className="flex flex-col gap-1 text-sm leading-relaxed text-muted-foreground">
          <li><span className="font-mono text-foreground">/temizle 50</span> son 50 mesajı siler</li>
          <li><span className="font-mono text-foreground">/temizle</span> (bir mesaja yanıt vererek) o mesajdan bu yana her şeyi siler</li>
          <li><span className="font-mono text-foreground">/sil</span> (yanıt vererek) tek mesajı siler</li>
          <li><span className="font-mono text-foreground">/hayalet</span> silinmiş hesapları çıkarır</li>
          <li><span className="font-mono text-foreground">/kilit</span> ve <span className="font-mono text-foreground">/kilitac</span> grubu kilitler/açar</li>
        </ul>
        <p className="text-xs text-muted-foreground">Telegram, botların 48 saatten eski mesajları silmesine izin vermez.</p>
      </Card>
    </div>
  )
}

// --- Overview: stats, log, bans, trust ------------------------------------------

function TrustRow({ t }: { t: TgHubData['trustLow'][number] }) {
  const a = useAction()
  return (
    <li className="flex items-center justify-between gap-2 py-1.5 text-sm">
      <span className="text-foreground">
        <MemberName tgId={t.tgId}>{t.name}</MemberName> <span className="text-xs text-muted-foreground">· ID {t.tgId}</span>
      </span>
      <span className="flex items-center gap-3">
        <span className={t.score < 30 ? 'tabular-nums text-destructive' : 'tabular-nums text-muted-foreground'}>{t.score}/100</span>
        <button type="button" className="text-xs text-primary hover:underline" disabled={a.pending} onClick={() => a.run(() => markTrusted(t.tgId, !t.trusted))}>
          {t.trusted ? 'Güvenilir · kaldır' : 'Güvenilir yap'}
        </button>
      </span>
    </li>
  )
}

function BanRow({ b }: { b: TgHubData['bans'][number] }) {
  const a = useAction()
  const { owner } = useTgAccess()
  return (
    <li className="flex flex-col gap-0.5 py-1.5 text-sm">
      <span className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-foreground">
          <MemberName tgId={b.tgId}>{b.who}</MemberName> <span className="text-xs text-muted-foreground">· {b.reason}</span>
        </span>
        {owner && (
          <button type="button" className="shrink-0 text-xs text-primary hover:underline" disabled={a.pending} onClick={() => a.run(() => unbanEverywhere(b.tgId))}>
            Yasağı kaldır
          </button>
        )}
      </span>
      {a.note}
    </li>
  )
}

/** Opens a member card from an id or a name, for someone who is not on any of the lists below. */
function MemberLookup() {
  const [query, setQuery] = useState('')
  const [pending, start] = useTransition()
  const [found, setFound] = useState<{ ids: number[]; asked: string } | null>(null)
  const search = () =>
    start(async () => {
      const ids = await findMemberAction(query)
      setFound({ ids, asked: query.trim() })
      if (ids.length === 1) openMemberCard(ids[0])
    })
  return (
    <Card title="Üye kartı aç" hint="Telegram ID, @kullanıcı adı ya da grupta görünen ad yaz. Kartta güven puanı, uyarılar, bağlı site hesabı ve işlemler var. Listelerdeki bir isme basmak da aynı kartı açar.">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault()
          search()
        }}
      >
        <input aria-label="Telegram ID ya da kullanıcı adı" className={input} placeholder="123456789 ya da @kullaniciadi" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="submit" className={btn} disabled={pending || !query.trim()}>
          {pending ? 'Aranıyor…' : 'Kartı aç'}
        </button>
      </form>
      {found && found.ids.length === 0 && (
        <p role="status" className="text-sm text-destructive">
          {`"${found.asked}" son 35 günde korunan gruplarda yazmamış ve siteye bağlı değil. Telegram ID'sini yaz; kayıt grubundaki her bildirimde yazar.`}
        </p>
      )}
      {found && found.ids.length > 1 && (
        <div role="status" className="flex flex-col gap-2">
          <p className="text-sm text-foreground">{`"${found.asked}" adını ${found.ids.length} hesap kullanıyor. Hangisi?`}</p>
          <div className="flex flex-wrap gap-2">
            {found.ids.map((id) => (
              <button key={id} type="button" className={btnGhost} onClick={() => openMemberCard(id)}>
                ID {id}
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

function OverviewSection({ d }: { d: TgHubData }) {
  const [cfg, setCfg] = useState(d.hub)
  const save = useAction()
  const report = useAction()
  const { owner, setup } = useTgAccess()
  const s = d.stats
  const tiles = [
    ['Silinen mesaj', s.deletedWeek],
    ['Susturma', s.mutedWeek],
    ['Ban', s.bannedWeek],
    ['Engellenen giriş', s.joinsBlockedWeek],
    ['Açık bilet', s.openTickets],
    ['Çözülen bilet', s.resolvedWeek],
  ] as const
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        {tiles.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-xl font-semibold tabular-nums text-foreground">{value}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Son 7 gün. {s.avgResolveMin != null ? `Ortalama bilet çözüm süresi ${s.avgResolveMin} dk.` : ''}</p>
      <Card title="Pazartesi raporu" hint="Her pazartesi sabah haftanın özeti log grubuna gelir: güvenlik, destek, sohbet, paylaşım.">
        {setup ? (
          <Toggle label="Haftalık raporu gönder" checked={cfg.report.enabled} onChange={(v) => setCfg((c) => ({ ...c, report: { enabled: v } }))} />
        ) : (
          <p className="text-sm text-muted-foreground">{`Haftalık rapor şu an ${d.hub.report.enabled ? 'açık' : 'kapalı'}. Açıp kapatmak için Telegram kurulum izni gerekli.`}</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {setup && (
            <button type="button" className={btn} disabled={save.pending} onClick={() => save.run(() => saveHubSettings(cfg))}>
              Kaydet
            </button>
          )}
          <button type="button" className={btnGhost} disabled={report.pending || !d.hub.logChatId} onClick={() => report.run(sendWeeklyNow)}>
            {report.pending ? 'Gönderiliyor…' : 'Raporu şimdi gönder (deneme)'}
          </button>
        </div>
        {save.note}
        {report.note}
      </Card>
      <MemberLookup />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Gizli güven puanı (en düşükler)" hint="Herkes 50 ile başlar. Temiz yazdıkça artar, uyarı/susturma aldıkça düşer. 30'un altındaki biri yabancı link atarsa uyarı yerine doğrudan banlanır. Üyeler bu puanı görmez.">
          {d.trustLow.length ? (
            <ul className="flex flex-col divide-y divide-border">
              {d.trustLow.map((t) => (
                <TrustRow key={t.tgId} t={t} />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Henüz veri yok.</p>
          )}
        </Card>
        <Card
          title={`Tüm gruplardan yasaklılar (${s.globalBans})`}
          hint={`Bir grupta banlanan kişi tüm Alkanka gruplarından banlanır.${owner ? '' : ' Yasağı sadece ana yönetici kaldırabilir.'}`}
        >
          {d.bans.length ? (
            <ul className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto">
              {d.bans.map((b) => (
                <BanRow key={b.tgId} b={b} />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Yasaklı yok.</p>
          )}
        </Card>
      </div>
    </div>
  )
}

export function TgHubManager({ data }: { data: TgHubData }) {
  const openTickets = data.tickets.filter((t) => t.status === 'open' || t.status === 'claimed').length
  const { setup } = useTgAccess()
  const groups: KnownChat[] = data.hub.groups.map((g) => ({ chatId: g.chatId, title: g.title }))
  // A form keeps what it was opened with. After a restore, a loaded backup or a channel switch that would be
  // the old settings, and its next save would write them back, so those forms start again from the new ones.
  const rev = data.rev
  // Settings need the setup permission; lists, tickets and cleaning are open to moderators as well.
  const tabs = [
    setup && {
      id: 'hub-setup',
      label: 'Kurulum',
      // An unfinished setup only counts as a fault once the guard is switched on and has nothing to guard with.
      status: data.hub.guardBotId && data.hub.groups.length ? ('on' as const) : data.hub.guard.enabled ? ('off' as const) : ('idle' as const),
      issue: 'Bekçi açık ama bot ya da korunan grup seçilmemiş',
      content: <SetupSection key={rev} d={data} />,
    },
    { id: 'hub-overview', label: 'Özet', content: <OverviewSection d={data} /> },
    { id: 'hub-log', label: 'Kayıtlar', content: <LogSection initial={data.log} groups={groups} /> },
    setup && { id: 'hub-guard', label: 'Bekçi', status: data.hub.guard.enabled ? ('on' as const) : ('idle' as const), content: <GuardSection key={rev} d={data} /> },
    {
      id: 'hub-shield',
      label: `Koruma${data.locks.length ? ` (${data.locks.length})` : ''}`,
      content: <ShieldSection key={rev} hub={data.hub} locks={data.locks} quiet={data.quiet} canSetup={setup} />,
    },
    {
      id: 'hub-support',
      label: `Destek${openTickets ? ` (${openTickets})` : ''}`,
      status: data.hub.support.enabled ? ('on' as const) : ('idle' as const),
      content: <SupportSection key={rev} d={data} />,
    },
    setup && { id: 'hub-autoreply', label: 'Oto Cevap', status: data.hub.autoReply.enabled ? ('on' as const) : ('idle' as const), content: <AutoReplySection key={rev} d={data} /> },
    setup && { id: 'hub-counter', label: 'Sayaç', status: data.hub.counter.enabled ? ('on' as const) : ('idle' as const), content: <CounterSection key={rev} d={data} /> },
    { id: 'hub-clean', label: 'Temizlik', content: <CleanupSection d={data} /> },
    setup && { id: 'hub-history', label: 'Ayar geçmişi', content: <HistorySection /> },
  ].filter((t): t is Exclude<typeof t, false> => Boolean(t))
  return (
    <>
      {/* The Durum tab one level up lists every failing section, so the red box is not repeated here. */}
      <TelegramTabs label="Telegram Merkezi bölümleri" legend={false} issues="none" tabs={tabs} param="t" />
      <MemberCardHost />
    </>
  )
}
