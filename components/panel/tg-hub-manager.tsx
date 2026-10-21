'use client'

import { useState, useTransition, type ReactNode } from 'react'
import type { MirrorBot } from '@/lib/telegram-mirror'
import type { BroadcastRow, HubConfig, HubLogRow, HubStats, LeaderRow, SponsorSupportStat, TicketRow } from '@/lib/tg-hub-shared'
import { TelegramTabs } from '@/components/panel/telegram-tabs'
import {
  addHubChat,
  closeTicketAction,
  markTrusted,
  removeHubChat,
  saveHubSettings,
  sendBroadcast,
  sendWeeklyNow,
  setRoleBot,
  stopBroadcast,
  sweepGhosts,
  unbanEverywhere,
  wipeUserMessages,
} from '@/app/panel/tg-hub-actions'

type HookInfo = { ok: boolean; pending: number; lastError: string | null } | null

export type TgHubData = {
  hub: HubConfig
  bots: MirrorBot[]
  stats: HubStats
  log: HubLogRow[]
  tickets: TicketRow[]
  sponsorStats: SponsorSupportStat[]
  leaders: LeaderRow[]
  broadcasts: BroadcastRow[]
  bans: { tgId: number; who: string; reason: string; createdAt: string }[]
  trustLow: { tgId: number; score: number; trusted: boolean; name: string }[]
  guardHook: HookInfo
  supportHook: HookInfo
  shareBotId: number | null
  shareHook: HookInfo
  linkedMembers: number
}

const input = 'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground'
const btn = 'inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50'
const btnGhost = 'inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50'
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—')

function useAction() {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null)
  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      setMsg(await fn())
    })
  const note = msg ? (
    <p role="status" className={msg.ok ? 'text-sm text-primary' : 'text-sm text-destructive'}>
      {msg.message}
    </p>
  ) : null
  return { pending, run, note }
}

function Card({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-border p-3">
      <input type="checkbox" className="mt-1 size-4 accent-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="text-xs leading-relaxed text-muted-foreground">{hint}</span>}
      </span>
    </label>
  )
}

function NumberField({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <span className="flex items-center gap-2">
        <input type="number" className={input} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        {suffix && <span className="shrink-0 text-xs">{suffix}</span>}
      </span>
    </label>
  )
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
        <select aria-label={`${label} botu`} className={input} value={value} onChange={(e) => setValue(e.target.value)} disabled={role === 'share'}>
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
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        {withName && <input aria-label="Sponsor adı" className={input} placeholder="Sponsor adı (ör. Betkanka)" value={name} onChange={(e) => setName(e.target.value)} />}
        <input aria-label="Grup adresi" className={input} placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} />
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

function ChatChip({ kind, id, label }: { kind: 'group' | 'log' | 'staff' | 'sponsor' | 'leader'; id: string; label: string }) {
  const a = useAction()
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
      <span className="truncate text-foreground">{label}</span>
      <button type="button" className="text-xs text-destructive hover:underline disabled:opacity-50" disabled={a.pending} onClick={() => a.run(() => removeHubChat(kind, id))}>
        Kaldır
      </button>
    </li>
  )
}

function SetupSection({ d }: { d: TgHubData }) {
  const { hub } = d
  return (
    <div className="flex flex-col gap-4">
      <Card title="1. Botları görevlere ata" hint="Her rol için ayrı bot önerilir. Aynı bot birden fazla rol yapabilir ama Oran ve KankaTV botlarını burada kullanma.">
        <RoleRow role="guard" label="Bekçi (güvenlik + kontrolcü + sayaç)" hint="Gruplarda küfür, spam, reklam, bot saldırısı ve sahte hesapları engeller; mesajları sayar." botId={hub.guardBotId} bots={d.bots} info={d.guardHook} />
        <RoleRow role="support" label="Destek botu" hint="Üyeler bu bota özelden yazar. Sorun yetkili grubuna ve sponsor grubuna bilet olarak düşer." botId={hub.supportBotId} bots={d.bots} info={d.supportHook} />
        <RoleRow
          role="share"
          label="Postçu (anında paylaşım)"
          hint="Bot, Post Paylaşım sekmesinde seçtiğin bottur. Buradan Bağla dersen paylaşımlar 2-3 dakika beklemeden anında çıkar."
          botId={d.shareBotId}
          bots={d.shareBotId ? d.bots.filter((b) => b.id === d.shareBotId) : []}
          info={d.shareHook}
        />
      </Card>
      <Card title="2. Korunacak gruplar" hint="Bekçi'yi grupta yönetici yap (mesaj silme, üye engelleme, üye ekleme izinleri açık). Sonra grubun @adresini ya da ID'sini buraya yaz.">
        <ChatAdder kind="group" placeholder="@alkankasohbet ya da -100…" />
        {hub.groups.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {hub.groups.map((g) => (
              <ChatChip key={g.chatId} kind="group" id={g.chatId} label={g.title} />
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
          <Toggle label="Yeni gelene doğrulama (captcha)" hint="Katılan kişi 2 dakika içinde butona basmazsa atılır. Botları durdurur." checked={g.captcha} onChange={(v) => set({ captcha: v })} />
          <Toggle label="Bilinen spam hesap kontrolü" hint="Dünya çapındaki spam listesindeki hesaplar girer girmez banlanır." checked={g.casCheck} onChange={(v) => set({ casCheck: v })} />
          <Toggle label="Sahte yönetici koruması" hint="Adında Alkanka, admin, destek geçen ve yönetici taklidi yapan hesaplar engellenir." checked={g.impersonation} onChange={(v) => set({ impersonation: v })} />
          <Toggle label="Katıldı/ayrıldı yazılarını sil" checked={g.cleanService} onChange={(v) => set({ cleanService: v })} />
        </div>
        <NumberField label="Baskın koruması: 1 dakikada bu kadar kişi girerse grup otomatik kilitlenir (0 = kapalı)" value={g.raidJoins} onChange={(v) => set({ raidJoins: v })} suffix="kişi" />
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

function TicketItem({ t }: { t: TicketRow }) {
  const [answer, setAnswer] = useState('')
  const a = useAction()
  const open = t.status === 'open' || t.status === 'claimed'
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">#{t.id}</span> · {t.name}
          {t.username ? ` (@${t.username})` : ''} · {t.sponsor} · {t.category}
        </span>
        <span>{fmt(t.createdAt)}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{t.text}</p>
      {open ? (
        <>
          <textarea aria-label="Cevap" className="min-h-16 rounded-lg border border-border bg-background p-2 text-sm text-foreground" placeholder="Üyeye gidecek cevap ya da red nedeni" value={answer} onChange={(e) => setAnswer(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} disabled={a.pending} onClick={() => a.run(() => closeTicketAction(t.id, 'resolved', answer))}>
              Çözüldü olarak gönder
            </button>
            <button type="button" className={btnGhost} disabled={a.pending} onClick={() => a.run(() => closeTicketAction(t.id, 'rejected', answer))}>
              Reddet
            </button>
          </div>
          {a.note}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t.status === 'resolved' ? 'Çözüldü' : 'Reddedildi'} · {t.answer}
          {t.rating ? ` · Puan ${t.rating}/5` : ''}
        </p>
      )}
    </li>
  )
}

function SupportSection({ d }: { d: TgHubData }) {
  const [cfg, setCfg] = useState(d.hub)
  const [cats, setCats] = useState(d.hub.support.categories.join(', '))
  const a = useAction()
  const s = cfg.support
  const set = (patch: Partial<HubConfig['support']>) => setCfg((c) => ({ ...c, support: { ...c.support, ...patch } }))
  const open = d.tickets.filter((t) => t.status === 'open' || t.status === 'claimed')
  return (
    <div className="flex flex-col gap-4">
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
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={btn} disabled={a.pending} onClick={() => a.run(() => saveHubSettings({ ...cfg, support: { ...s, categories: cats.split(',').map((x) => x.trim()).filter(Boolean) } }))}>
            {a.pending ? 'Kaydediliyor…' : 'Destek ayarlarını kaydet'}
          </button>
          {a.note}
        </div>
      </Card>
      <Card title={`Açık biletler (${open.length})`} hint="Biletleri Telegram grubundan da cevaplayabilirsin; burası yedek ekran.">
        {d.tickets.length ? (
          <ul className="flex flex-col gap-2">
            {d.tickets.map((t) => (
              <TicketItem key={t.id} t={t} />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Bilet yok.</p>
        )}
      </Card>
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

function CounterSection({ d }: { d: TgHubData }) {
  const [cfg, setCfg] = useState(d.hub)
  const [rewards, setRewards] = useState(d.hub.counter.rewards.join(', '))
  const a = useAction()
  const c = cfg.counter
  return (
    <div className="flex flex-col gap-4">
      <Toggle label="Mesaj sayacı açık" hint="Telegram gruplarında ve sitedeki canlı sohbette yazılanları sayar. /stats ve /top komutları grupta çalışır." checked={c.enabled} onChange={(v) => setCfg((x) => ({ ...x, counter: { ...x.counter, enabled: v } }))} />
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

function CleanupSection({ d }: { d: TgHubData }) {
  const [chat, setChat] = useState(d.hub.groups[0]?.chatId ?? '')
  const [tgId, setTgId] = useState('')
  const ghost = useAction()
  const wipe = useAction()
  return (
    <div className="flex flex-col gap-4">
      <Card title="Silinmiş hesapları topluca çıkar" hint="Grubu tarar, 'Silinmiş Hesap' görünen üyeleri çıkarır. Grupta /hayalet yazarak da çalıştırabilirsin. Not: Telegram, kanalların abone listesini botlara vermez; bu sadece gruplarda çalışır.">
        <div className="flex flex-col gap-2 sm:flex-row">
          <select aria-label="Grup" className={input} value={chat} onChange={(e) => setChat(e.target.value)}>
            {d.hub.groups.map((g) => (
              <option key={g.chatId} value={g.chatId}>
                {g.title}
              </option>
            ))}
          </select>
          <button type="button" className={btn} disabled={ghost.pending || !chat} onClick={() => ghost.run(() => sweepGhosts(chat))}>
            {ghost.pending ? 'Taranıyor…' : 'Taramayı başlat'}
          </button>
        </div>
        {ghost.note}
      </Card>
      <Card title="Bir kişinin mesajlarını topluca sil" hint="Telegram ID'sini gir (log grubunda her kaydın yanında yazar). Son 48 saatteki tüm mesajları tüm gruplardan silinir.">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input aria-label="Telegram ID" className={input} inputMode="numeric" placeholder="ör. 123456789" value={tgId} onChange={(e) => setTgId(e.target.value)} />
          <button type="button" className={btn} disabled={wipe.pending || !tgId} onClick={() => wipe.run(() => wipeUserMessages(tgId))}>
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

// --- Broadcast -------------------------------------------------------------------

function BroadcastSection({ d }: { d: TgHubData }) {
  const [text, setText] = useState('')
  const [bText, setBText] = useState('')
  const [bUrl, setBUrl] = useState('')
  const a = useAction()
  const stop = useAction()
  return (
    <div className="flex flex-col gap-4">
      <Card title="DM duyuru gönder" hint={`Hesabını Telegram'a bağlamış ${d.linkedMembers} üyeye Canlı Sohbet botundan özel mesaj gider. Mesajın altında "Bildirimleri kapat" butonu otomatik olur. Haftada 1-2 duyurudan fazlası şikâyete yol açar.`}>
        <textarea aria-label="Duyuru metni" className="min-h-28 rounded-lg border border-border bg-background p-3 text-sm text-foreground" placeholder="Duyuru metni" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="grid gap-2 md:grid-cols-2">
          <input aria-label="Buton yazısı" className={input} placeholder="Buton yazısı (isteğe bağlı)" value={bText} onChange={(e) => setBText(e.target.value)} />
          <input aria-label="Buton linki" className={input} placeholder="https://…" value={bUrl} onChange={(e) => setBUrl(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={btn}
            disabled={a.pending || text.trim().length < 5}
            onClick={() => {
              if (!confirm(`Bu mesaj ${d.linkedMembers} kişiye gidecek. Emin misin?`)) return
              a.run(async () => {
                const r = await sendBroadcast(text, bText, bUrl)
                if (r.ok) setText('')
                return r
              })
            }}
          >
            {a.pending ? 'Gönderiliyor…' : 'Duyuruyu gönder'}
          </button>
          {a.note}
        </div>
      </Card>
      <Card title="Son duyurular">
        {d.broadcasts.length ? (
          <ul className="flex flex-col gap-2">
            {d.broadcasts.map((b) => (
              <li key={b.id} className="flex flex-col gap-1 rounded-lg border border-border p-3 text-sm">
                <p className="line-clamp-2 text-foreground">{b.text}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {fmt(b.createdAt)} · {b.status === 'done' ? 'Bitti' : b.status === 'cancelled' ? 'Durduruldu' : 'Gönderiliyor'} · {b.sent}/{b.total} ulaştı{b.failed ? `, ${b.failed} hata` : ''}
                  </span>
                  {b.status !== 'done' && b.status !== 'cancelled' && (
                    <button type="button" className="text-destructive hover:underline" disabled={stop.pending} onClick={() => stop.run(() => stopBroadcast(b.id))}>
                      Durdur
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Henüz duyuru yok.</p>
        )}
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
        {t.name} <span className="text-xs text-muted-foreground">· ID {t.tgId}</span>
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
  return (
    <li className="flex items-center justify-between gap-2 py-1.5 text-sm">
      <span className="min-w-0 truncate text-foreground">
        {b.who} <span className="text-xs text-muted-foreground">· {b.reason}</span>
      </span>
      <button type="button" className="shrink-0 text-xs text-primary hover:underline" disabled={a.pending} onClick={() => a.run(() => unbanEverywhere(b.tgId))}>
        Yasağı kaldır
      </button>
    </li>
  )
}

function OverviewSection({ d }: { d: TgHubData }) {
  const [cfg, setCfg] = useState(d.hub)
  const save = useAction()
  const report = useAction()
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
        <Toggle label="Haftalık raporu gönder" checked={cfg.report.enabled} onChange={(v) => setCfg((c) => ({ ...c, report: { enabled: v } }))} />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btn} disabled={save.pending} onClick={() => save.run(() => saveHubSettings(cfg))}>
            Kaydet
          </button>
          <button type="button" className={btnGhost} disabled={report.pending || !d.hub.logChatId} onClick={() => report.run(sendWeeklyNow)}>
            {report.pending ? 'Gönderiliyor…' : 'Raporu şimdi gönder (deneme)'}
          </button>
        </div>
        {save.note}
        {report.note}
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Son işlemler">
          {d.log.length ? (
            <ul className="flex max-h-96 flex-col divide-y divide-border overflow-y-auto">
              {d.log.map((l) => (
                <li key={l.id} className="flex flex-col gap-0.5 py-2 text-sm">
                  <span className="text-foreground">
                    <span className="font-semibold">{l.action}</span> · {l.who}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {l.chatTitle ? `${l.chatTitle} · ` : ''}
                    {l.reason} · {fmt(l.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Henüz kayıt yok.</p>
          )}
        </Card>
        <div className="flex flex-col gap-4">
          <Card title="Gizli güven puanı (en düşükler)" hint="Herkes 50 ile başlar. Temiz yazdıkça artar, uyarı/susturma aldıkça düşer. 30'un altındakilerin linkleri ve medyası otomatik silinir. Üyeler bu puanı görmez.">
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
          <Card title={`Tüm gruplardan yasaklılar (${s.globalBans})`} hint="Bir grupta banlanan kişi tüm Alkanka gruplarından banlanır.">
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
    </div>
  )
}

export function TgHubManager({ data }: { data: TgHubData }) {
  const openTickets = data.tickets.filter((t) => t.status === 'open' || t.status === 'claimed').length
  return (
    <TelegramTabs
      label="Telegram Merkezi bölümleri"
      tabs={[
        { id: 'hub-setup', label: 'Kurulum', status: data.hub.guardBotId && data.hub.groups.length ? 'on' : 'off', content: <SetupSection d={data} /> },
        { id: 'hub-overview', label: 'Özet & Kayıtlar', content: <OverviewSection d={data} /> },
        { id: 'hub-guard', label: 'Bekçi', status: data.hub.guard.enabled ? 'on' : 'off', content: <GuardSection d={data} /> },
        { id: 'hub-support', label: `Destek${openTickets ? ` (${openTickets})` : ''}`, status: data.hub.support.enabled ? 'on' : 'off', content: <SupportSection d={data} /> },
        { id: 'hub-counter', label: 'Sayaç', status: data.hub.counter.enabled ? 'on' : 'off', content: <CounterSection d={data} /> },
        { id: 'hub-clean', label: 'Temizlik', content: <CleanupSection d={data} /> },
        { id: 'hub-dm', label: 'DM Duyuru', content: <BroadcastSection d={data} /> },
      ]}
    />
  )
}
