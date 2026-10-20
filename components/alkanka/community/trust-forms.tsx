'use client'

import { useState } from 'react'
import { AlertTriangle, Gift, MessageSquare, Star } from 'lucide-react'
import { addComplaintAction, addReviewAction } from '@/app/actions/community'
import { cn } from '@/lib/utils'
import { usePoints } from '../points-context'
import { StatusLine, useAction } from './use-action'
import { WithdrawForm } from './withdraw-form'
import { ProofUpload } from './proof-upload'

const proofKp = 30

const field =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring'

type Mode = 'review' | 'complaint' | 'cekim'

const TABS: { id: Mode; label: string; icon: typeof Star }[] = [
  { id: 'review', label: 'Yorum', icon: MessageSquare },
  { id: 'complaint', label: 'Şikâyet', icon: AlertTriangle },
  { id: 'cekim', label: 'Çekim', icon: Gift },
]

export function TrustForms({ siteId, siteName, initialMode = 'review' }: { siteId: string; siteName: string; initialMode?: Mode }) {
  const { member } = usePoints()
  const [mode, setMode] = useState<Mode>(initialMode)
  const review = useAction()
  const complaint = useAction()
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')

  if (!member) {
    return (
      <div className="panel-gold flex flex-col items-start gap-3 rounded-xl p-5">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Yorum ve şikâyetleri yalnızca doğrulanmış üyeler yazabilir. Böylece sahte yorumların önüne geçiyoruz.
        </p>
        <a href="#giris" className="h-10 rounded-lg bg-primary px-4 text-xs font-bold uppercase leading-10 tracking-wider text-primary-foreground">Giriş yap</a>
      </div>
    )
  }

  return (
    <div className="panel-gold border-flow flex flex-col gap-4 rounded-xl p-5" style={{ '--flow-speed': '7s', '--flow-opacity': '0.85' } as React.CSSProperties}>
      <div role="tablist" className="relative grid grid-cols-3 rounded-lg bg-background p-1">
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-md bg-primary shadow-[0_0_18px_-4px_var(--primary)] transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(${TABS.findIndex((t) => t.id === mode) * 100}%)` }}
        />
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={mode === id}
            onClick={() => setMode(id)}
            className={cn(
              'relative z-10 flex h-9 items-center justify-center gap-1 rounded-md px-1 text-[11px] font-bold uppercase tracking-wide transition-colors duration-300',
              mode === id ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden />
            {label}
            {id === 'cekim' && mode !== 'cekim' && (
              <span className="absolute right-1 top-1 flex size-2" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-live" />
              </span>
            )}
          </button>
        ))}
      </div>

      <div key={mode} className="animate-rise motion-reduce:animate-none">
      {mode === 'cekim' ? (
        <WithdrawForm siteId={siteId} siteName={siteName} />
      ) : mode === 'review' ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            review.run(() => addReviewAction(siteId, rating, body), () => {
              setBody('')
              setRating(0)
            })
          }}
        >
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-xs font-semibold text-muted-foreground">{siteName} için puanın</legend>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} yıldız`} aria-pressed={rating === n} className="p-0.5">
                  <Star className={cn('size-7', n <= rating ? 'fill-primary text-primary' : 'text-muted-foreground')} aria-hidden />
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
            Deneyimin
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={1000} placeholder="Çekim hızı, destek, bonus şartları..." className={field} />
          </label>
          <button disabled={review.pending || rating === 0 || body.trim().length < 20} className="btn-sheen h-10 rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-40">
            {review.pending ? 'Gönderiliyor...' : 'Yorumu gönder'}
          </button>
          <StatusLine status={review.status} />
          <ProofUpload siteId={siteId} kp={proofKp} />
        </form>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            complaint.run(() => addComplaintAction(siteId, title, detail), () => {
              setTitle('')
              setDetail('')
            })
          }}
        >
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
            Başlık
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Örn. Çekim talebim 3 gündür bekliyor" className={field} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
            Ne oldu?
            <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={5} maxLength={2000} placeholder="Tarih, tutar ve yaşadığın sorunu yaz. Şifre ya da kart bilgisi paylaşma." className={field} />
          </label>
          <button disabled={complaint.pending || title.trim().length < 5 || detail.trim().length < 30} className="btn-sheen h-10 rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-40">
            {complaint.pending ? 'Gönderiliyor...' : 'Şikâyeti gönder'}
          </button>
          <p className="text-xs leading-relaxed text-muted-foreground">Ekibimiz şikâyeti inceleyip siteye iletir. Durumu profilinden takip edersin.</p>
          <StatusLine status={complaint.status} />
        </form>
      )}
      </div>
    </div>
  )
}
