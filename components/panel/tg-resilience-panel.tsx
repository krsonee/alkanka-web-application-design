'use client'

import { useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { Check, Copy } from 'lucide-react'
import { INVITE_NAME_MAX, parseChannelAddress, type BridgeStats, type InviteRow, type ResilienceData } from '@/lib/tg-resilience-shared'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { Card, Toggle, btn, btnDanger, btnGhost, fmt, input, useAction, useFirstShown } from '@/components/panel/tg-hub-ui'
import { createInviteAction, loadResilienceAction, revokeInviteAction, switchChannelAction } from '@/app/panel/tg-resilience-actions'

const count = (n: number) => n.toLocaleString('tr-TR')

// --- Channel address ---------------------------------------------------------------

function AddressCard({ address, canSetup, onChanged }: { address: ResilienceData['address']; canSetup: boolean; onChanged: () => void }) {
  const a = useAction()
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState<string[]>([])
  const parsed = parseChannelAddress(value)
  const typed = value.trim().length > 0
  const feed = address.feed?.replace(/^@/, '')
  const source = address.custom
    ? feed
      ? `Elle girildi. Site içindeki duyuru akışı hâlâ @${feed} kanalını gösteriyor.`
      : 'Elle girildi.'
    : feed
      ? 'Duyuru kanalından geliyor (Kanallar sekmesi).'
      : 'Henüz kanal bağlanmadı; yerleşik adres kullanılıyor.'

  const change = async (e: FormEvent) => {
    e.preventDefault()
    if (!parsed) return
    const sure = await askConfirm(
      `Güncel kanal adresi ${parsed.url} olacak. Sitedeki linkler, üst şerit, oto cevap ve karşılama yazıları, bekleyen postlar ve DM duyuruları yeni adrese döner. Daha önce gönderilmiş postlar değişmez. Devam edilsin mi?`,
    )
    if (!sure) return
    a.run(async () => {
      const r = await switchChannelAction(parsed.url)
      setNotes(r.ok ? (r.notes ?? []) : [])
      if (r.ok) {
        setValue('')
        onChanged()
      }
      return { ok: r.ok, message: r.message }
    })
  }

  return (
    <Card
      title="Güncel kanal adresi"
      hint="Sitedeki tüm &quot;Telegram'a katıl&quot; linkleri, üst şerit, alt bilgi ve botların yazıları bu adresi kullanır. Kanal kapanır ya da kısıtlanırsa yeni adresi buraya yaz; hepsi tek seferde yeni kanala döner."
    >
      <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
        <a href={address.url} target="_blank" rel="noopener noreferrer" className="text-base font-semibold text-foreground underline-offset-2 [overflow-wrap:anywhere] hover:underline">
          {address.url}
        </a>
        <span className="text-xs leading-relaxed text-muted-foreground">{source}</span>
      </div>
      {canSetup ? (
        <form onSubmit={change} className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Yeni kanal adresi
            <input
              className={input}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="@yenikanal ya da https://t.me/+davetlinki"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={typed && !parsed}
            />
          </label>
          {typed && !parsed && <p className="text-xs text-destructive">Adres geçersiz. @kanaladi, t.me/kanaladi ya da t.me/+… davet linki yaz.</p>}
          {parsed && !parsed.username && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Bu özel bir davet linki. Linkler yeni adrese döner ama site içindeki duyuru akışı herkese açık kanal ister, o yüzden akış değişmez.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={btn} disabled={a.pending || !parsed}>
              {a.pending ? 'Değiştiriliyor…' : 'Yeni kanala geç'}
            </button>
            {a.note}
          </div>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">Adresi değiştirmek için &quot;Telegram kurulum&quot; izni gerekli.</p>
      )}
      {notes.length > 0 && (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-xs leading-relaxed text-foreground" aria-label="Yapılan değişiklikler">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// --- Member bridge -----------------------------------------------------------------

function BridgeCard({ bridge }: { bridge: BridgeStats }) {
  const cells = [
    { label: 'Telegram bağlı üye', value: bridge.linked },
    { label: 'Özelden yazılabilen', value: bridge.reachable },
    { label: 'Son 7 günde bağlayan', value: bridge.week },
    { label: 'Son 30 günde bağlayan', value: bridge.month },
  ]
  return (
    <Card
      title="Üye köprüsü"
      hint="Kanal giderse üyeye ulaşmanın tek yolu budur: Telegram'ını siteye bağlayan üyeye bot özelden yazabilir (Postlar > DM duyuru). Yeni kanalın adresini onlara bu yoldan duyurursun."
    >
      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {cells.map((c) => (
          <div key={c.label} className="flex flex-col gap-0.5 rounded-lg border border-border p-3">
            <dt className="text-xs text-muted-foreground">{c.label}</dt>
            <dd className="text-xl font-semibold tabular-nums text-foreground">{count(c.value)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {bridge.linked > bridge.reachable ? `${count(bridge.linked - bridge.reachable)} üye botu engellemiş ya da özel mesajı kapatmış; onlara yazılamaz. ` : ''}
        Bağlamayı artırmak için postlara &quot;Üyeye özel&quot; ya da &quot;Bota git&quot; butonu ekle (Postlar &gt; Yeni post).
      </p>
    </Card>
  )
}

// --- Campaign invite links ---------------------------------------------------------

function InviteItem({ invite, onChanged }: { invite: InviteRow; onChanged: () => void }) {
  const a = useAction()
  const [copied, setCopied] = useState(false)
  const open = !invite.revokedAt

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invite.link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }
  const revoke = async () => {
    if (!(await askConfirm(`"${invite.name}" linki iptal edilsin mi? Bu linkle artık kimse giremez; önceden girenler içeride kalır. İptal geri alınamaz.`))) return
    a.run(async () => {
      const r = await revokeInviteAction(invite.id)
      if (r.ok) onChanged()
      return r
    })
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground [overflow-wrap:anywhere]">{invite.name}</span>
          <span className="text-xs leading-relaxed text-muted-foreground">
            {invite.chatTitle || invite.chatId}
            {invite.approval ? ' · onaylı giriş' : ''} · açan {invite.createdBy || 'panel'} · {fmt(invite.createdAt)}
          </span>
        </div>
        <span className="flex shrink-0 flex-col items-end">
          <span className="text-xl font-semibold tabular-nums text-foreground">{count(invite.joins)}</span>
          <span className="text-xs text-muted-foreground">giriş</span>
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {invite.lastJoinAt ? `Son giriş ${fmt(invite.lastJoinAt)}` : 'Bu linkle henüz giren olmadı'}
        {open && invite.recentJoins > 0 ? <span className="font-semibold text-foreground"> · son 1 saatte {count(invite.recentJoins)} giriş</span> : null}
        {invite.revokedAt ? ` · ${fmt(invite.revokedAt)} tarihinde iptal edildi` : ''}
      </p>
      {open && (
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 basis-48 truncate rounded-md bg-muted px-2 py-2 font-mono text-xs text-foreground">{invite.link}</code>
          <button type="button" className={`${btnGhost} gap-1.5`} onClick={copy}>
            {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            {copied ? 'Kopyalandı' : 'Kopyala'}
          </button>
          <button type="button" className={btnDanger} disabled={a.pending} onClick={revoke}>
            {a.pending ? 'İptal ediliyor…' : 'İptal et'}
          </button>
        </div>
      )}
      {a.note}
    </li>
  )
}

function InvitesCard({ data, onChanged }: { data: ResilienceData; onChanged: () => void }) {
  const a = useAction()
  const [chatId, setChatId] = useState(data.chats[0]?.chatId ?? '')
  const [name, setName] = useState('')
  const [approval, setApproval] = useState(false)
  const open = data.invites.filter((i) => !i.revokedAt)
  const revoked = data.invites.filter((i) => i.revokedAt)

  const create = (e: FormEvent) => {
    e.preventDefault()
    a.run(async () => {
      const r = await createInviteAction(chatId, name, approval)
      if (r.ok) {
        setName('')
        onChanged()
      }
      return { ok: r.ok, message: r.message }
    })
  }

  return (
    <Card
      title={`Kampanya davet linkleri (${open.length} açık)`}
      hint="Her reklama ya da paylaşıma ayrı link ver: hangi linkten kaç kişi geldiği burada görünür. Saldırı bir linkten geliyorsa sadece o link iptal edilir, diğerleri çalışmaya devam eder."
    >
      {!data.guardReady && (
        <p className="rounded-lg border border-border bg-muted p-3 text-xs leading-relaxed text-foreground">
          Bekçi kapalı ya da botu seçilmemiş. Linkleri Bekçi botu açar ve girişleri o sayar; önce Telegram Merkezi &gt; Kurulum bölümünden Bekçi&apos;yi aç.
        </p>
      )}
      {data.chats.length ? (
        <form onSubmit={create} className="flex flex-col gap-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Grup ya da kanal
              <select className={input} value={chatId} onChange={(e) => setChatId(e.target.value)}>
                {data.chats.map((c) => (
                  <option key={c.chatId} value={c.chatId}>
                    {c.title || c.chatId}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Kampanya adı
              <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={INVITE_NAME_MAX} placeholder="Instagram reklamı" required />
            </label>
          </div>
          <Toggle
            label="Onaylı giriş"
            hint="Bu linkle gelen kişi doğrudan girmez, katılma isteği gönderir. Bekçi isteği giriş kurallarından geçirir: temizse onaylar, şüpheliyse reddeder."
            checked={approval}
            onChange={setApproval}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={btn} disabled={a.pending || !name.trim() || !chatId}>
              {a.pending ? 'Açılıyor…' : 'Link aç'}
            </button>
            {a.note}
          </div>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">Link, korunan listedeki bir grup ya da kanal için açılır. Önce Telegram Merkezi &gt; Kurulum bölümünden sohbeti listeye ekle.</p>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Maliyet: açık bir link varken Bekçi, yönetici olduğu sohbetlerdeki her giriş ve çıkışı dinler (Koruma sekmesindeki giriş takibiyle aynı bildirimler) ve her bildirim veritabanını uyandırır. Son link
        iptal edilince, giriş ve yönetici alarmı da kapalıysa dinleme durur.
      </p>
      {open.length > 0 && (
        <ul className="flex flex-col gap-2">
          {open.map((i) => (
            <InviteItem key={i.id} invite={i} onChanged={onChanged} />
          ))}
        </ul>
      )}
      {revoked.length > 0 && (
        <details className="rounded-lg border border-border">
          <summary className="cursor-pointer px-3 py-2 text-sm text-foreground">İptal edilen linkler ({revoked.length})</summary>
          <ul className="flex flex-col gap-2 p-2">
            {revoked.map((i) => (
              <InviteItem key={i.id} invite={i} onChanged={onChanged} />
            ))}
          </ul>
        </details>
      )}
    </Card>
  )
}

// --- Screen ------------------------------------------------------------------------

export function ResilienceSection({ canSetup }: { canSetup: boolean }) {
  const { ref, shown } = useFirstShown<HTMLDivElement>()
  const { data, error, isLoading, mutate } = useSWR(shown ? 'tg-resilience' : null, () => loadResilienceAction(), { revalidateOnFocus: false })
  const reload = () => void mutate()

  return (
    <div ref={ref} className="flex flex-col gap-4">
      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground">
          Bilgiler okunamadı.{' '}
          <button type="button" className="font-semibold underline underline-offset-2" onClick={reload}>
            Tekrar dene
          </button>
        </p>
      ) : data ? (
        <>
          <AddressCard address={data.address} canSetup={canSetup} onChanged={reload} />
          <BridgeCard bridge={data.bridge} />
          <InvitesCard data={data} onChanged={reload} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{isLoading || !shown ? 'Yükleniyor…' : 'Bu ekran için "Telegram moderasyon" izni gerekli.'}</p>
      )}
    </div>
  )
}
