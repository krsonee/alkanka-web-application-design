'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { addComplaintAction, addReviewAction } from '@/app/actions/community'
import { cn } from '@/lib/utils'
import { usePoints } from '../points-context'
import { StatusLine, useAction } from './use-action'

const field =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring'

export function TrustForms({ siteId, siteName, initialMode = 'review' }: { siteId: string; siteName: string; initialMode?: 'review' | 'complaint' }) {
  const { member } = usePoints()
  const [mode, setMode] = useState<'review' | 'complaint'>(initialMode)
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
    <div className="panel-gold flex flex-col gap-4 rounded-xl p-5">
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-lg bg-background p-1">
        {(['review', 'complaint'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn('h-9 rounded-md text-xs font-bold uppercase tracking-wider', mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
          >
            {m === 'review' ? 'Yorum yaz' : 'Şikâyet bildir'}
          </button>
        ))}
      </div>

      {mode === 'review' ? (
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
          <button disabled={review.pending || rating === 0 || body.trim().length < 20} className="h-10 rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-40">
            {review.pending ? 'Gönderiliyor...' : 'Yorumu gönder'}
          </button>
          <StatusLine status={review.status} />
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
          <button disabled={complaint.pending || title.trim().length < 5 || detail.trim().length < 30} className="h-10 rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-40">
            {complaint.pending ? 'Gönderiliyor...' : 'Şikâyeti gönder'}
          </button>
          <p className="text-xs leading-relaxed text-muted-foreground">Ekibimiz şikâyeti inceleyip siteye iletir. Durumu profilinden takip edersin.</p>
          <StatusLine status={complaint.status} />
        </form>
      )}
    </div>
  )
}
