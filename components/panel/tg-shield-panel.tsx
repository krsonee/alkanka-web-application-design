'use client'

import { useState, useTransition } from 'react'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { Card, NumberField, Toggle, btn, btnDanger, btnGhost, fmt, input, useAction } from '@/components/panel/tg-hub-ui'
import {
  CAPTCHA_MINUTES,
  CAPTCHA_MODES,
  CONTENT_KINDS,
  NEW_MEMBER_HOURS,
  RAID_BAN_MINUTES,
  RECOMMENDED_SHIELD,
  WAVE_MINUTES,
  generalRules,
  rulesDiff,
  rulesFor,
  type ContentRule,
  type GroupRules,
  type HubConfig,
  type HubGroup,
  type LockRow,
  type QuietConfig,
  type QuietRow,
  type ShieldConfig,
  type SuspectRow,
} from '@/lib/tg-hub-shared'
import { loadSuspects, saveGroupRules, saveShieldSettings, suspectAction, sweepWaveAction, unlockChatAction } from '@/app/panel/tg-hub-actions'
import { openMemberCard } from '@/components/panel/tg-member-card'

const CONTENT_RULES: { value: ContentRule; label: string }[] = [
  { value: 'allow', label: 'Serbest' },
  { value: 'new', label: 'Yeni üyeye kapalı' },
  { value: 'block', label: 'Herkese kapalı' },
]

// --- Active locks ----------------------------------------------------------------

function LockItem({ l }: { l: LockRow }) {
  const a = useAction()
  const raid = l.kind === 'raid'
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">
            {l.title} · {raid ? 'Baskın modu' : 'Elle kilit (/kilit)'}
          </span>
          <span className="text-xs leading-relaxed text-muted-foreground">
            {l.locked ? 'Grup yazmaya kapalı.' : 'Grup yazmaya açık.'}
            {raid ? ` Yeni gelenler ${RAID_BAN_MINUTES} dakikalığına çıkarılıyor.` : ''} Başlangıç {fmt(l.startedAt)} ·{' '}
            {l.until ? `bitiş ${fmt(l.until)}` : 'süresiz, elle açılır'}
            {l.turnedAway ? ` · ${l.turnedAway} giriş geri çevrildi` : ''}
          </span>
          {l.reason && <span className="text-xs text-muted-foreground">Neden: {l.reason}</span>}
        </div>
        <button type="button" className={btn} disabled={a.pending} onClick={() => a.run(() => unlockChatAction(l.chatId))}>
          {a.pending ? 'Açılıyor…' : raid ? 'Baskın modunu kapat' : 'Kilidi aç'}
        </button>
      </div>
      {a.note}
    </li>
  )
}

function LocksCard({ locks, quiet }: { locks: LockRow[]; quiet: QuietRow[] }) {
  return (
    <Card
      title="Şu an açık kilitler"
      hint="Süresi dolan baskın modu, siteye gelen ilk ziyarette ya da gruba ilk yeni girişte kapanır; girişler hâlâ sınırın üstündeyse 5 dakika uzar. Buradan elle de kapatabilirsin. Sessiz saatler kendi saatinde biter; erken bitirmek için ayarını kapatıp kaydet."
    >
      {locks.length || quiet.length ? (
        <ul className="flex flex-col gap-2">
          {locks.map((l) => (
            <LockItem key={l.chatId} l={l} />
          ))}
          {quiet.map((q) => (
            <li key={`quiet-${q.chatId}`} className={`flex flex-col gap-0.5 rounded-lg border p-3 ${q.stuck ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/50'}`}>
              <span className="text-sm font-semibold text-foreground">{q.title} · Sessiz saatler</span>
              <span className="text-xs leading-relaxed text-muted-foreground">
                {q.mode === 'text' ? 'Grup sadece yazıya açık.' : 'Grup yazmaya kapalı.'} Başlangıç {fmt(q.since)}
              </span>
              {q.stuck && (
                <span className="text-xs leading-relaxed text-destructive">
                  Süre bitti ama grubun izinleri geri açılamadı; bot denemeye devam ediyor. Acilse Telegram’da grup izinlerinden mesaj göndermeyi elle aç.
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Açık baskın modu, kilit ya da sessiz saat yok.</p>
      )}
    </Card>
  )
}

function QuietCard({ value, set }: { value: QuietConfig; set: (patch: Partial<QuietConfig>) => void }) {
  const field = 'flex flex-col gap-1 text-xs text-muted-foreground'
  return (
    <Card
      title="Sessiz saatler"
      hint="Belirlediğin saatlerde grup kapanır ya da sadece yazıya açık kalır; süre bitince grubun izinleri eski haline döner. Saatler Türkiye saatidir. Bitiş başlangıçtan küçükse pencere gece yarısını geçer (01:00 – 08:00 gibi). Yöneticiler etkilenmez."
    >
      <Toggle label="Sessiz saatleri kullan" checked={value.enabled} onChange={(v) => set({ enabled: v })} />
      <div className="grid gap-3 md:grid-cols-3">
        <label className={field}>
          Başlangıç
          <input type="time" className={input} value={value.from} onChange={(e) => set({ from: e.target.value })} />
        </label>
        <label className={field}>
          Bitiş
          <input type="time" className={input} value={value.to} onChange={(e) => set({ to: e.target.value })} />
        </label>
        <label className={field}>
          Bu saatlerde grup
          <select className={input} value={value.mode} onChange={(e) => set({ mode: e.target.value === 'text' ? 'text' : 'lock' })}>
            <option value="lock">Tamamen yazmaya kapalı</option>
            <option value="text">Sadece yazıya açık (medya kapalı)</option>
          </select>
        </label>
      </div>
      <Toggle
        label="Başlarken ve biterken gruba kısa bilgi mesajı at"
        hint="Başlangıç mesajı pencere bitince silinir, bitiş mesajı 10 dakika sonra silinir."
        checked={value.announce}
        onChange={(v) => set({ announce: v })}
      />
      <p className="text-xs leading-relaxed text-muted-foreground">
        Zamanlama dakikası dakikasına değildir: sitede dakikalık zamanlayıcı çalışmıyor. Pencere, saatinden sonraki ilk site ziyaretinde ya da ilk Telegram bildiriminde (gruba yazılan ilk mesaj dahil) başlar ve
        biter; o ilk mesaj da silinir. Grup tamamen kapalıyken içeriden mesaj gelemediği için sabah açılış, sitenin ilk ziyaretçisini ya da botlara gelen başka bir bildirimi bekler. Baskın modu ya da /kilit grubu
        kapatmışken sessiz saat başlamaz, kilit bitince başlar. Bekçi botunda {'"üyeleri kısıtlama"'} yetkisi olmalı; yoksa bot izinleri değiştiremez ama bu saatlerde gelen mesajları tek tek siler.
      </p>
    </Card>
  )
}

// --- Settings fields (shared by the general form and the per-group form) ---------

type ShieldRules = Pick<GroupRules, keyof GroupRules & keyof ShieldConfig>

function ShieldFields({ value, set, raidJoins, floodMuteMinutes }: { value: ShieldRules; set: (patch: Partial<ShieldRules>) => void; raidJoins: number; floodMuteMinutes: number }) {
  return (
    <>
      <Card
        title="Baskın modu"
        hint={`Sınır, Bekçi ayarındaki "Baskın koruması" sayısıdır (şu an 1 dakikada ${raidJoins} kişi${raidJoins > 0 ? '' : ', yani kapalı'}). Kapalıyken eski davranış sürer: sadece sınırı aşan girişler ${RAID_BAN_MINUTES} dakikalığına çıkarılır.`}
      >
        <Toggle
          label="Baskın modunu kullan"
          hint={`Sınır aşılınca mod açılır ve süre boyunca her yeni gelen ${RAID_BAN_MINUTES} dakikalığına çıkarılır (kalıcı ban yok). Kayıt grubuna "Baskın modunu kapat" ve "Son ${WAVE_MINUTES} dk girenleri çıkar" butonlu bildirim düşer.`}
          checked={value.raidMode}
          onChange={(v) => set({ raidMode: v })}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <NumberField label="Baskın modu kaç dakika sürsün" value={value.raidMinutes} onChange={(v) => set({ raidMinutes: v })} suffix="dk" />
          <Toggle
            label="Bu sürede grubu yazmaya kapat"
            hint="Grubun izinleri kaydedilir, mod bitince aynen geri yüklenir."
            checked={value.raidLock}
            onChange={(v) => set({ raidLock: v })}
          />
        </div>
      </Card>

      <Card title="Toplu üye ekleme" hint="Yöneticilerin eklediği kişiler sayılmaz.">
        <div className="grid gap-3 md:grid-cols-2">
          <NumberField
            label={`Bir üye 10 dakikada bu sayıdan fazla kişi eklerse: eklediklerinin hepsi ${RAID_BAN_MINUTES} dakikalığına çıkarılır, kendisi banlanır (0 = kapalı)`}
            value={value.inviteLimit}
            onChange={(v) => set({ inviteLimit: v })}
            suffix="kişi"
          />
          <Toggle
            label="Böyle bir durumda üyelerin kişi ekleme iznini kapat"
            hint="Bot grup izinlerinden 'üye ekleme'yi kapatır. Geri açmak için Telegram'da grup izinlerine girmen gerekir."
            checked={value.inviteLock}
            onChange={(v) => set({ inviteLock: v })}
          />
        </div>
      </Card>

      <Card title="Yorum kalkanı" hint="Kanal postlarının yorumları, kanala bağlı yorum grubuna düşer. Bu ayarlar o grup korunan listedeyse çalışır.">
        <Toggle
          label="Üye olmayanın ilk yorumunda doğrulama iste"
          hint={`Gruba üye olmadan yazan hesabın yorumu silinir ve ${CAPTCHA_MINUTES} dakika içinde "Ben insanım" butonuna basması istenir. Basınca yazabilir. Sadece Bekçi'nin ilk kez gördüğü hesaplara uygulanır; daha önce yazmış olanlara dokunmaz.`}
          checked={value.commentShield}
          onChange={(v) => set({ commentShield: v })}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <NumberField
            label="Bir postun altına 1 dakikada bu sayıdan fazla yorum gelirse o postun yorumları kapatılır (0 = kapalı, en az 5)"
            value={value.commentRate}
            onChange={(v) => set({ commentRate: v })}
            suffix="yorum"
          />
          <NumberField label="Yorumlar kaç dakika kapalı kalsın" value={value.commentLockMinutes} onChange={(v) => set({ commentLockMinutes: v })} suffix="dk" />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Kapalıyken o postun yeni yorumları silinir, kayıt grubuna {'"Yorumları şimdi aç"'} butonu düşer. Yöneticiler ve güvenilir üyeler etkilenmez. Sayım sadece bu ayar açıldıktan sonra atılan
          postlarda çalışır.
        </p>
      </Card>

      <Card
        title="Yeni üye ve içerik türleri"
        hint={`Yeni üye: Bekçi'nin ilk kez gördüğü hesap. Bugüne kadar grupta hiç yazmamış eski üyeler de ilk yazdıklarında yeni sayılır. Buradaki kurallar ceza vermez: mesaj silinir, kısa bir açıklama yazılır. Yöneticiler ve güvenilir üyeler etkilenmez.`}
      >
        <NumberField
          label="Karantina: yeni üye ilk bu kadar saat sadece düz yazı yazabilir; medya, çıkartma, iletme ve etiket silinir (0 = kapalı)"
          value={value.quarantineHours}
          onChange={(v) => set({ quarantineHours: v })}
          suffix="saat"
        />
        <div className="grid gap-2 md:grid-cols-2">
          {CONTENT_KINDS.map((k) => (
            <label key={k.key} className="flex flex-col gap-1 text-xs text-muted-foreground">
              {k.label}
              <select
                className={input}
                value={value.content[k.key]}
                onChange={(e) => set({ content: { ...value.content, [k.key]: e.target.value as ContentRule } })}
              >
                {CONTENT_RULES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {`"Yeni üyeye kapalı" süresi karantina saatiyle aynıdır; karantina kapalıysa ${NEW_MEMBER_HOURS} saat.`}
        </p>
      </Card>

      <Card title="Koordineli spam, gizli reklam, isim nöbeti">
        <NumberField
          label={`Aynı yazı (20 harf ve üstü) 5 dakika içinde bu kadar farklı hesaptan gelirse hepsi silinir, hesaplar ${floodMuteMinutes} dakika susturulur; baskın modu açıksa grup baskın moduna girer (0 = kapalı, en az 2)`}
          value={value.swarmAccounts}
          onChange={(v) => set({ swarmAccounts: v })}
          suffix="hesap"
        />
        <div className="grid gap-2 md:grid-cols-2">
          <Toggle
            label="Gizlenmiş reklamı tara"
            hint="Mesajın altındaki butonlar, alıntı ve başka sohbete verilen yanıtın önizlemesindeki linkler de kontrol edilir. Başka kanaldan alıntı ve hikâye iletme silinir. Ceza yabancı link ile aynıdır."
            checked={value.hiddenAds}
            onChange={(v) => set({ hiddenAds: v })}
          />
          <Toggle
            label="İsim nöbeti (girdikten sonra isim değiştiren)"
            hint={`Üye yazdığında adına bakılır. "Sahte yönetici koruması" açıksa adında alkanka, destek, admin, yönetici, support ya da moderator geçen hesap banlanır (kayıtta "Geri al" butonu olur). Adı bir yöneticiyle aynı görünen hesap banlanmaz, kayıt grubuna butonla bildirilir. Kiril ve Yunan harfleri, rakamla yazım (adm1n) ve l / I / ı oyunları çözülür.`}
            checked={value.nameWatch}
            onChange={(v) => set({ nameWatch: v })}
          />
        </div>
      </Card>

      <QuietCard value={value.quiet} set={(patch) => set({ quiet: { ...value.quiet, ...patch } })} />
    </>
  )
}

type GuardRules = Omit<GroupRules, keyof ShieldRules>

function GuardFields({ value, set }: { value: GuardRules; set: (patch: Partial<GuardRules>) => void }) {
  const [mutes, setMutes] = useState(value.muteMinutes.join(', '))
  return (
    <Card title="Bekçi kuralları (bu grup için)">
      <div className="grid gap-3 md:grid-cols-2">
        <NumberField label="Kaç uyarıdan sonra susturulsun" value={value.warnLimit} onChange={(v) => set({ warnLimit: v })} />
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Susturma süreleri (dakika, sırayla artar)
          <input
            className={input}
            value={mutes}
            onChange={(e) => {
              setMutes(e.target.value)
              set({ muteMinutes: e.target.value.split(',').map((x) => Number(x.trim())).filter((n) => n > 0) })
            }}
          />
        </label>
        <NumberField label="Flood: bu kadar mesaj…" value={value.floodCount} onChange={(v) => set({ floodCount: v })} suffix="mesaj" />
        <NumberField label="…bu kadar saniye içinde" value={value.floodSeconds} onChange={(v) => set({ floodSeconds: v })} suffix="sn" />
        <NumberField label="Flood yapan kaç dakika sussun" value={value.floodMuteMinutes} onChange={(v) => set({ floodMuteMinutes: v })} suffix="dk" />
        <NumberField label="Aynı mesajı kaç kez tekrarlarsa sussun" value={value.repeatLimit} onChange={(v) => set({ repeatLimit: v })} />
        <NumberField label="Baskın sınırı: 1 dakikada bu sayıdan fazla giriş (0 = kapalı)" value={value.raidJoins} onChange={(v) => set({ raidJoins: v })} suffix="kişi" />
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Yabancı link atana ne yapılsın
          <select className={input} value={value.linkAction} onChange={(e) => set({ linkAction: e.target.value as 'ban' | 'warn' })}>
            <option value="ban">Sil ve banla</option>
            <option value="warn">Sil ve uyar</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Doğrulama türü
          <select className={input} value={value.captchaMode} disabled={!value.captcha} onChange={(e) => set({ captchaMode: e.target.value as GuardRules['captchaMode'] })}>
            {CAPTCHA_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        <Toggle label="Yeni gelene doğrulama" checked={value.captcha} onChange={(v) => set({ captcha: v })} />
        <Toggle label="İletilen mesajları sil" checked={value.blockForwards} onChange={(v) => set({ blockForwards: v })} />
        <Toggle label="Katıldı/ayrıldı yazılarını sil" checked={value.cleanService} onChange={(v) => set({ cleanService: v })} />
      </div>
    </Card>
  )
}

// --- General settings --------------------------------------------------------------

function GeneralForm({ hub }: { hub: HubConfig }) {
  const [shield, setShield] = useState(hub.shield)
  const [filled, setFilled] = useState(false)
  const a = useAction()
  const set = (patch: Partial<ShieldConfig>) => setShield((s) => ({ ...s, ...patch }))
  return (
    <>
      <Card
        title="Hızlı kurulum"
        hint="Tüm korumalar kapalı gelir; hiçbiri sen açmadan çalışmaz. Buton formu önerilen değerlerle doldurur, kaydetmeden hiçbir şey değişmez."
      >
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={btnGhost}
            onClick={() => {
              setShield(RECOMMENDED_SHIELD)
              setFilled(true)
            }}
          >
            Önerilen ayarları doldur
          </button>
          {filled && (
            <p role="status" className="text-sm text-muted-foreground">
              Form dolduruldu. Gözden geçir, sonra aşağıdan kaydet.
            </p>
          )}
        </div>
      </Card>

      <ShieldFields value={shield} set={set} raidJoins={hub.guard.raidJoins} floodMuteMinutes={hub.guard.floodMuteMinutes} />

      <Card
        title="Kanal girişleri ve yönetici alarmı"
        hint="Maliyet: bu ikisinden biri açıkken Telegram, Bekçi'nin yönetici olduğu her sohbetteki her giriş ve çıkışı siteye bildirir ve her bildirim veritabanını uyandırır. Normal günde az, baskında çok. İkisi de kapalıyken bu bildirimler hiç istenmez. Bekçi kanalda da yönetici olmalı."
      >
        <NumberField
          label={`Kanala 10 dakikada bu kadar yeni abone girerse kayıt grubuna alarm ve "Son ${WAVE_MINUTES} dk girenleri çıkar" butonu düşer; alarm ${WAVE_MINUTES} dakikada en çok bir kez gelir (0 = kapalı, en az 5)`}
          value={shield.channelJoinAlert}
          onChange={(v) => set({ channelJoinAlert: v })}
          suffix="abone"
        />
        <Toggle
          label="Yönetici ve bot yetkisi alarmı"
          hint="Korunan bir grup ya da kanalda yönetici eklenir ya da çıkarılırsa, Bekçi atılır ya da silme / engelleme yetkisi alınırsa kayıt grubuna bildirim gelir."
          checked={shield.adminAlerts}
          onChange={(v) => set({ adminAlerts: v })}
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Giriş takibi açıkken tüm gruplardan yasaklı bir hesap kanala girerse kanaldan da çıkarılır.
        </p>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btn} disabled={a.pending} onClick={() => a.run(() => saveShieldSettings(shield))}>
          {a.pending ? 'Kaydediliyor…' : 'Koruma ayarlarını kaydet'}
        </button>
        {a.note}
      </div>
    </>
  )
}

// --- Per-group settings --------------------------------------------------------------

function GroupEditor({ hub, group }: { hub: HubConfig; group: HubGroup }) {
  const [own, setOwn] = useState<GroupRules | null>(group.rules ? rulesFor(hub, group.chatId) : null)
  const a = useAction()
  const set = (patch: Partial<GroupRules>) => setOwn((o) => (o ? { ...o, ...patch } : o))
  const different = own ? Object.keys(rulesDiff(generalRules(hub), own)).length : 0
  return (
    <div className="flex flex-col gap-4">
      <Toggle
        label={`"${group.title}" için ayrı ayar kullan`}
        hint="Açınca aşağıdaki form genel ayarların kopyasıyla dolar. Yalnızca genelden farklı bıraktığın alanlar bu gruba özel saklanır; diğerleri genel ayar değişince onunla birlikte değişir."
        checked={own !== null}
        onChange={(v) => setOwn(v ? rulesFor(hub, group.chatId) : null)}
      />
      {own && (
        <>
          <GuardFields value={own} set={set} />
          <ShieldFields value={own} set={set} raidJoins={own.raidJoins} floodMuteMinutes={own.floodMuteMinutes} />
        </>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {own || group.rules ? (
          <button type="button" className={btn} disabled={a.pending} onClick={() => a.run(() => saveGroupRules(group.chatId, own))}>
            {a.pending ? 'Kaydediliyor…' : own ? 'Bu grubun ayarlarını kaydet' : 'Genel ayarlara dön'}
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">Bu grup genel ayarları kullanıyor.</span>
        )}
        {own && <span className="text-xs text-muted-foreground">{different ? `${different} ayar genelden farklı` : 'Şu an genel ayarlarla aynı'}</span>}
        {a.note}
      </div>
    </div>
  )
}

function GroupRulesCard({ hub }: { hub: HubConfig }) {
  const groups = hub.groups.filter((g) => g.type !== 'channel')
  const [chatId, setChatId] = useState(groups[0]?.chatId ?? '')
  const group = groups.find((g) => g.chatId === chatId)
  return (
    <Card title="Gruba özel ayar" hint="Sohbet grubu ile yorum grubunu farklı sertlikte tutmak için. Kanallar listede yok: kanalda mesaj kuralları çalışmaz.">
      {groups.length ? (
        <>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Grup
            <select className={input} value={chatId} onChange={(e) => setChatId(e.target.value)}>
              {groups.map((g) => (
                <option key={g.chatId} value={g.chatId}>
                  {g.title}
                  {g.rules ? ' · ayrı ayarlı' : ''}
                </option>
              ))}
            </select>
          </label>
          {group && <GroupEditor key={group.chatId} hub={hub} group={group} />}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Korunan listede grup yok. Önce Kurulum sekmesinden grup ekle.</p>
      )}
    </Card>
  )
}

// --- Join wave -------------------------------------------------------------------

function WaveCard({ hub }: { hub: HubConfig }) {
  const [chatId, setChatId] = useState(hub.groups[0]?.chatId ?? '')
  const a = useAction()
  const title = hub.groups.find((g) => g.chatId === chatId)?.title ?? ''
  return (
    <Card
      title={`Son ${WAVE_MINUTES} dakikada girenleri çıkar`}
      hint={`Seçtiğin sohbete son ${WAVE_MINUTES} dakikada giren herkes ${RAID_BAN_MINUTES} dakikalığına çıkarılır; süre bitince tekrar girebilirler. Güvenilir işaretli hesaplara dokunulmaz. Gruplarda girişler bu güncellemeden sonra kaydedilmeye başlar; kanallarda yalnızca "kanal girişleri" ya da "yönetici alarmı" açıkken kaydedilir.`}
    >
      {hub.groups.length ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <select aria-label="Grup veya kanal" className={input} value={chatId} onChange={(e) => setChatId(e.target.value)}>
            {hub.groups.map((g) => (
              <option key={g.chatId} value={g.chatId}>
                {g.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`${btnDanger} shrink-0 whitespace-nowrap`}
            disabled={a.pending || !chatId}
            onClick={() => {
              void askConfirm(`"${title}" sohbetine son ${WAVE_MINUTES} dakikada giren herkes ${RAID_BAN_MINUTES} dakikalığına çıkarılacak. Emin misin?`).then((ok) => {
                if (ok) a.run(() => sweepWaveAction(chatId))
              })
            }}
          >
            {a.pending ? 'Çıkarılıyor…' : 'Girenleri çıkar'}
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Korunan listede sohbet yok.</p>
      )}
      {a.note}
    </Card>
  )
}

// --- Suspects --------------------------------------------------------------------

const MAX_PER_ACTION = 100

function SuspectsCard({ initial }: { initial?: SuspectRow[] }) {
  const [list, setList] = useState<SuspectRow[] | null>(initial ?? null)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [loading, startLoad] = useTransition()
  const a = useAction()
  const busy = loading || a.pending
  const ids = [...picked]

  const load = () =>
    startLoad(async () => {
      setList(await loadSuspects())
      setPicked(new Set())
    })
  const act = (action: 'ban' | 'mute' | 'wipe' | 'clear') =>
    a.run(async () => {
      const res = await suspectAction(ids, action)
      if (res.ok) {
        setList(await loadSuspects())
        setPicked(new Set())
      }
      return res
    })
  const toggle = (id: number) =>
    setPicked((p) => {
      const next = new Set(p)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const allPicked = Boolean(list?.length) && picked.size === Math.min(list?.length ?? 0, MAX_PER_ACTION)

  return (
    <Card
      title="Şüpheli hesaplar"
      hint="Üç işarete bakılır: toplu üretilmiş isim kalıbı (iki isim parçası + uzun sayı, ör. DebraSchro900255), aynı dakikada 8 ve üstü hesapla birlikte giriş, isim nöbetinin bildirdiği hesaplar. Bunlar ipucudur, kanıt değil: listeyi gözden geçirip sen karar verirsin. Liste her açılışta değil, butona basınca taranır."
    >
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btnGhost} disabled={busy} onClick={load}>
          {loading ? 'Taranıyor…' : list ? 'Yeniden tara' : 'Şüphelileri tara'}
        </button>
        {list && <span className="text-xs text-muted-foreground">{list.length ? `${list.length} hesap` : 'Şüpheli hesap bulunmadı.'}</span>}
      </div>

      {list && list.length > 0 && (
        <>
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={allPicked}
                onChange={(e) => setPicked(e.target.checked ? new Set(list.slice(0, MAX_PER_ACTION).map((s) => s.tgId)) : new Set())}
              />
              {`Tümünü seç (bir seferde en çok ${MAX_PER_ACTION}) · ${picked.size} seçili`}
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnDanger}
                disabled={busy || !ids.length}
                onClick={() => {
                  void askConfirm(`${ids.length} hesap tüm gruplardan banlanacak. Emin misin?`).then((ok) => {
                    if (ok) act('ban')
                  })
                }}
              >
                Tüm gruplardan banla
              </button>
              <button type="button" className={btnGhost} disabled={busy || !ids.length} onClick={() => act('mute')}>
                24 saat sustur
              </button>
              <button type="button" className={btnGhost} disabled={busy || !ids.length} onClick={() => act('wipe')}>
                Mesajlarını sil
              </button>
              <button type="button" className={btnGhost} disabled={busy || !ids.length} onClick={() => act('clear')}>
                Şüpheli değil
              </button>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {'Ban, "Özet" sekmesindeki yasaklılar listesinden geri alınır. "Şüpheli değil" hesabı bu listeden kalıcı olarak çıkarır. Mesaj silme sadece son 48 saati kapsar.'}
            </p>
            {a.note}
          </div>

          <ul className="flex max-h-[32rem] flex-col divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {list.map((s) => (
              <li key={s.tgId}>
                <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-muted/50">
                  <input type="checkbox" className="mt-1 size-4 shrink-0 accent-primary" checked={picked.has(s.tgId)} onChange={() => toggle(s.tgId)} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm text-foreground [overflow-wrap:anywhere]">
                      {s.name}
                      {s.username && !s.name.includes(s.username) ? ` · @${s.username}` : ''}
                      <span className="text-xs text-muted-foreground"> · ID {s.tgId}</span>
                    </span>
                    <span className="text-xs leading-relaxed text-muted-foreground">{s.reasons.join(' · ')}</span>
                    <span>
                      <button type="button" className="text-xs text-primary hover:underline" onClick={() => openMemberCard(s.tgId)}>
                        Üye kartını aç
                      </button>
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {s.msgs} mesaj
                    <br />
                    {s.joinedAt ? `giriş ${fmt(s.joinedAt)}` : 'giriş kaydı yok'}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}

export function ShieldSection({
  hub,
  locks,
  quiet = [],
  initialSuspects,
  canSetup = true,
}: {
  hub: HubConfig
  locks: LockRow[]
  quiet?: QuietRow[]
  initialSuspects?: SuspectRow[]
  /** False for a moderator: locks and suspect lists stay, the rule settings are left out. */
  canSetup?: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      {!hub.guard.enabled && (
        <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          {canSetup ? 'Bekçi kapalı. Buradaki ayarlar kaydedilir ama Bekçi açılana kadar hiçbiri çalışmaz.' : 'Bekçi kapalı; koruma kuralları şu an çalışmıyor.'}
        </p>
      )}
      <LocksCard locks={locks} quiet={quiet} />
      {canSetup && <GeneralForm hub={hub} />}
      {canSetup && <GroupRulesCard hub={hub} />}
      <WaveCard hub={hub} />
      <SuspectsCard initial={initialSuspects} />
    </div>
  )
}
