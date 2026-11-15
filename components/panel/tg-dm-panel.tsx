'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, X } from 'lucide-react'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { Card, btn, btnGhost, input, useAction } from '@/components/panel/tg-hub-ui'
import { uploadPostMedia } from '@/components/panel/tg-post-fields'
import { when } from '@/components/panel/tg-post-ui'
import { ReplyButtonsEditor } from '@/components/panel/tg-reply-buttons'
import { sendBroadcast, stopBroadcast, testBroadcastAction } from '@/app/panel/tg-hub-actions'
import {
  DM_AUDIENCES,
  DM_BUTTON_MAX,
  DM_CAPTION_MAX,
  DM_TEXT_MAX,
  type BroadcastRow,
  type DmAudience,
  type DmDraft,
  type DmPanelData,
  type ReplyButton,
} from '@/lib/tg-hub-shared'
import { isoToLocal, mediaUrl } from '@/lib/tg-posts-shared'

const fieldLabel = 'flex flex-col gap-1 text-xs text-muted-foreground'
const audienceLabel = (value: DmAudience) => DM_AUDIENCES.find((a) => a.value === value)?.label ?? 'Herkes'

/** The message as it lands in the member's private chat with the bot. */
function DmPreview({ text, photoPath, buttons }: { text: string; photoPath: string | null; buttons: ReplyButton[] }) {
  const shown = buttons.filter((b) => b.text.trim())
  return (
    <div className="flex flex-col gap-1">
      <div className="overflow-hidden rounded-2xl rounded-bl-md border border-border bg-card">
        {photoPath && (
          // eslint-disable-next-line @next/next/no-img-element -- private Blob file served through the panel's own route
          <img src={mediaUrl(photoPath)} alt="Duyuru görseli" className="max-h-72 w-full object-cover" />
        )}
        <p className="whitespace-pre-wrap px-3 py-2 text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
          {text.trim() || <span className="text-muted-foreground">Duyuru metni burada görünecek.</span>}
        </p>
      </div>
      {[...shown.map((b) => b.text.trim()), 'Bildirimleri kapat'].map((label, i) => (
        <span key={i} className="truncate rounded-lg bg-foreground/10 px-2 py-2 text-center text-sm font-medium text-foreground">
          {label}
        </span>
      ))}
    </div>
  )
}

function Composer({ data }: { data: DmPanelData }) {
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [buttons, setButtons] = useState<ReplyButton[]>([])
  const [audience, setAudience] = useState<DmAudience>('all')
  const [scheduled, setScheduled] = useState(false)
  const [at, setAt] = useState('')
  const [testChat, setTestChat] = useState(data.testChat)
  const file = useRef<HTMLInputElement>(null)
  const send = useAction()
  const test = useAction()

  const limit = photo ? DM_CAPTION_MAX : DM_TEXT_MAX
  const length = text.trim().length
  const tooLong = length > limit
  const reach = data.audiences[audience] ?? 0
  const draft: DmDraft = { text, photoPath: photo, buttons, audience, sendAt: scheduled ? at : null }
  const blocked = !data.botReady || uploading || length < 3 || tooLong

  const pick = async (picked: File | undefined) => {
    if (!picked) return
    setUploadError(null)
    if (!/^image\/(jpeg|png|webp)$/.test(picked.type)) return setUploadError('Sadece JPG, PNG ya da WEBP görsel yüklenebilir.')
    setUploading(true)
    try {
      const item = await uploadPostMedia(picked)
      if (item.kind !== 'photo') throw new Error('Bu dosya görsel olarak gönderilemiyor.')
      setPhoto(item.path)
    } catch (error) {
      setUploadError(String((error as Error).message))
    } finally {
      setUploading(false)
      if (file.current) file.current.value = ''
    }
  }

  const submit = () => {
    const question = scheduled
      ? `Duyuru ${at.replace('T', ' ')} (Türkiye saati) için zamanlanacak. "${audienceLabel(audience)}" kitlesinde şu an ${reach} kişi var. Onaylıyor musun?`
      : `Bu mesaj "${audienceLabel(audience)}" kitlesindeki ${reach} kişiye şimdi gidecek ve geri alınamaz. Emin misin?`
    void askConfirm(question).then((ok) => {
      if (!ok) return
      send.run(async () => {
        const result = await sendBroadcast(draft)
        if (result.ok) {
          setText('')
          setPhoto(null)
          setButtons([])
          setScheduled(false)
        }
        return result
      })
    })
  }

  return (
    <Card
      title="DM duyuru hazırla"
      hint={'Duyuru, Telegram hesabını siteye bağlamış üyelere Canlı Sohbet botundan özel mesaj olarak gider. Her mesajın altına "Bildirimleri kapat" butonu kendiliğinden eklenir. Haftada 1-2 duyurudan fazlası şikâyete ve botun engellenmesine yol açar.'}
    >
      {!data.botReady && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Canlı Sohbet botu bağlı değil. Duyurular o bottan gittiği için önce Canlı Sohbet sekmesinden botu bağla.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="flex min-w-0 flex-col gap-4">
          <label className={fieldLabel}>
            <span className="flex items-center justify-between gap-2">
              Duyuru metni
              <span className={tooLong ? 'font-semibold text-destructive' : ''}>
                {length} / {limit}
              </span>
            </span>
            <textarea className="min-h-32 rounded-lg border border-border bg-background p-3 text-sm text-foreground" value={text} onChange={(e) => setText(e.target.value)} />
            {tooLong && photo && <span className="text-destructive">Görselli mesajda Telegram en fazla {DM_CAPTION_MAX} karaktere izin veriyor. Metni kısalt ya da görseli kaldır.</span>}
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">Görsel (isteğe bağlı, tek fotoğraf)</span>
            <div className="flex flex-wrap items-center gap-2">
              <label className={`${btnGhost} cursor-pointer gap-1.5 focus-within:ring-2 focus-within:ring-ring`}>
                <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={(e) => void pick(e.target.files?.[0])} />
                <ImagePlus className="size-4" aria-hidden="true" />
                {uploading ? 'Yükleniyor…' : photo ? 'Görseli değiştir' : 'Görsel ekle'}
              </label>
              {photo && (
                <button type="button" className={`${btnGhost} gap-1.5`} onClick={() => setPhoto(null)}>
                  <X className="size-4" aria-hidden="true" />
                  Görseli kaldır
                </button>
              )}
            </div>
            {uploadError && (
              <p role="alert" className="text-xs text-destructive">
                {uploadError}
              </p>
            )}
          </div>

          <ReplyButtonsEditor value={buttons} onChange={setButtons} max={DM_BUTTON_MAX} label="Link butonları" />

          <label className={fieldLabel}>
            Kime gitsin
            <select className={input} value={audience} onChange={(e) => setAudience(e.target.value as DmAudience)}>
              {DM_AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label} ({data.audiences[a.value] ?? 0} kişi)
                </option>
              ))}
            </select>
            <span>{DM_AUDIENCES.find((a) => a.value === audience)?.hint} Duyuruları kapatan ve botu engelleyen üyeler hiçbir kitlede sayılmaz.</span>
          </label>

          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <label className="flex items-center gap-3 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={scheduled}
                onChange={(e) => {
                  setScheduled(e.target.checked)
                  if (e.target.checked && !at) setAt(isoToLocal(Date.now() + 60 * 60 * 1000))
                }}
              />
              İleri bir saate zamanla
            </label>
            {scheduled && (
              <label className={fieldLabel}>
                Gönderim zamanı (Türkiye saati)
                <input type="datetime-local" className={input} value={at} onChange={(e) => setAt(e.target.value)} />
                <span>
                  Dakikası dakikasına garanti yok: sitede dakikalık zamanlayıcı çalışmıyor. Duyuru, bu saatten sonraki ilk site ziyaretinde ya da ilk Telegram bildiriminde çıkar. Kitle o an yeniden
                  sayılır.
                </span>
              </label>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Önizleme</span>
          <div className="rounded-xl bg-muted p-3">
            <DmPreview text={text} photoPath={photo} buttons={buttons} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
        <label className={fieldLabel}>
          Önce bana gönder: kendi Telegram sayı ID’n
          <span className="flex flex-col gap-2 sm:flex-row">
            <input className={input} inputMode="numeric" placeholder="Örnek: 123456789" value={testChat} onChange={(e) => setTestChat(e.target.value)} />
            <button type="button" className={`${btnGhost} shrink-0`} disabled={blocked || test.pending || !testChat.trim()} onClick={() => test.run(() => testBroadcastAction({ ...draft, sendAt: null }, testChat))}>
              {test.pending ? 'Gönderiliyor…' : 'Önce bana gönder'}
            </button>
          </span>
          <span>Mesaj sadece bu hesaba gider, listeye yazılmaz. Canlı Sohbet botuna daha önce /start yazmış olman gerekir. Denemedeki “Bildirimleri kapat” butonu bir şey yapmaz.</span>
        </label>
        {test.note}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btn} disabled={blocked || send.pending || (scheduled && !at)} onClick={submit}>
          {send.pending ? 'Kaydediliyor…' : scheduled ? 'Duyuruyu zamanla' : `Duyuruyu gönder (${reach} kişi)`}
        </button>
        {send.note}
      </div>
    </Card>
  )
}

function statusText(b: BroadcastRow) {
  if (b.status === 'done') return `Bitti${b.finishedAt ? ` · ${when(b.finishedAt)}` : ''}`
  if (b.status === 'cancelled') return 'Durduruldu'
  if (b.status === 'sending') return 'Gönderiliyor'
  return b.sendAt ? `Zamanlandı · ${when(b.sendAt)}` : 'Sırada'
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col rounded-lg bg-muted px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  )
}

function BroadcastItem({ b }: { b: BroadcastRow }) {
  const stop = useAction()
  const live = b.status === 'queued' || b.status === 'sending'
  const waiting = b.status === 'queued'
  const handled = b.sent + b.blocked + b.failed
  const left = Math.max(0, b.total - handled)
  const percent = b.total > 0 ? Math.min(100, Math.round((handled / b.total) * 100)) : 0
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-semibold text-foreground">{statusText(b)}</span>
          <span className="text-xs text-muted-foreground">
            {audienceLabel(b.audience)}
            {b.photoPath ? ' · görselli' : ''}
            {b.buttons.length ? ` · ${b.buttons.length} buton` : ''}
            {b.author ? ` · ${b.author}` : ''} · hazırlandı {when(b.createdAt)}
          </span>
        </div>
        {live && (
          <button
            type="button"
            className="shrink-0 text-xs font-medium text-destructive hover:underline disabled:opacity-50"
            disabled={stop.pending}
            onClick={() => {
              void askConfirm(waiting ? 'Bu duyuru hiç gönderilmeden iptal edilsin mi?' : 'Gönderim durdurulsun mu? O ana kadar gidenler geri alınamaz.').then((ok) => {
                if (ok) stop.run(() => stopBroadcast(b.id))
              })
            }}
          >
            {stop.pending ? 'Durduruluyor…' : waiting ? 'İptal et' : 'Durdur'}
          </button>
        )}
      </div>
      <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{b.text}</p>
      {waiting ? (
        <p className="text-xs text-muted-foreground">Kitlede şu an {b.total} kişi var; gönderim başlarken yeniden sayılır.</p>
      ) : (
        <>
          {b.status === 'sending' && (
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Gönderim ilerlemesi" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
              <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
          )}
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Ulaştı" value={b.sent} />
            <Stat label="Botu engellemiş" value={b.blocked} />
            <Stat label="Başarısız" value={b.failed} />
            <Stat label={b.status === 'cancelled' ? 'Gönderilmedi' : 'Kalan'} value={left} />
          </dl>
        </>
      )}
      {b.note && <p className="text-xs text-destructive">{b.note}</p>}
      {stop.note}
    </li>
  )
}

/** Takes only what it shows, so an account limited to posting is never sent moderation data. */
export function DmPanel({ data }: { data: DmPanelData }) {
  const router = useRouter()
  const sending = data.broadcasts.some((b) => b.status === 'sending' || (b.status === 'queued' && !b.sendAt))
  useEffect(() => {
    if (!sending) return
    const timer = setInterval(() => router.refresh(), 4000)
    return () => clearInterval(timer)
  }, [sending, router])
  return (
    <div className="flex flex-col gap-4">
      <Composer data={data} />
      <Card title="Duyurular ve sonuçları" hint="“Botu engellemiş” sayılan üyeler bir sonraki duyuruda listeden düşer; bota yeniden yazarlarsa geri gelirler. “Başarısız” Telegram’ın başka bir nedenle kabul etmediği gönderimlerdir.">
        {data.broadcasts.length ? (
          <ul className="flex flex-col gap-2">
            {data.broadcasts.map((b) => (
              <BroadcastItem key={b.id} b={b} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Henüz duyuru yok.</p>
        )}
      </Card>
    </div>
  )
}
