'use client'

import { useState } from 'react'
import { Ban, Check, ShieldOff, Trash2, X } from 'lucide-react'
import {
  approveShare,
  fakeShare,
  rejectShare,
  removeShare,
  unblockShareUser,
  updateSiteReward,
  updateWithdrawSettings,
} from '@/app/panel/withdraw-actions'
import type { AdminWithdrawShare, SiteReward, WithdrawReward, WithdrawSettings } from '@/lib/withdrawals'
import { StatusLine, useAction } from '@/components/alkanka/community/use-action'
import { cn } from '@/lib/utils'

const field =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring'

type Block = { userId: string; name: string; until: string | null; reason: string }

type Props = {
  shares: AdminWithdrawShare[]
  settings: WithdrawSettings
  siteRewards: SiteReward[]
  sites: { id: string; name: string }[]
  blocks: Block[]
}

const STATUS: Record<AdminWithdrawShare['status'], { label: string; tone: string }> = {
  pending: { label: 'Onay bekliyor', tone: 'bg-primary/15 text-primary' },
  approved: { label: 'Yayında', tone: 'bg-live/15 text-live' },
  rejected: { label: 'Reddedildi', tone: 'bg-secondary text-muted-foreground' },
  fake: { label: 'Sahte', tone: 'bg-destructive/15 text-destructive' },
}

const time = (iso: string) => new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function WithdrawManager({ shares, settings, siteRewards, sites, blocks }: Props) {
  const [view, setView] = useState<'queue' | 'rewards' | 'rules'>('queue')
  const pendingCount = shares.filter((s) => s.status === 'pending').length
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" className="flex w-fit flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
        {(
          [
            ['queue', `Onay kuyruğu (${pendingCount})`],
            ['rewards', 'Ödüller'],
            ['rules', `Kurallar ve engeller (${blocks.length})`],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)} className={cn('h-9 rounded-md px-3 text-xs font-bold', view === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {label}
          </button>
        ))}
      </div>
      {view === 'queue' && <Queue shares={shares} sites={sites} siteRewards={siteRewards} settings={settings} />}
      {view === 'rewards' && <Rewards settings={settings} siteRewards={siteRewards} sites={sites} />}
      {view === 'rules' && <Rules settings={settings} blocks={blocks} />}
    </div>
  )
}

function defaultReward(siteId: string, settings: WithdrawSettings, siteRewards: SiteReward[]): WithdrawReward {
  const r = siteRewards.find((x) => x.siteId === siteId)
  return r ? { coin: r.coin, kp: r.kp, item: r.item } : { coin: settings.coin, kp: settings.kp, item: settings.item }
}

function Queue({ shares, siteRewards, settings }: { shares: AdminWithdrawShare[]; sites: Props['sites']; siteRewards: SiteReward[]; settings: WithdrawSettings }) {
  const { pending, status, run } = useAction()
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const list = filter === 'pending' ? shares.filter((s) => s.status === 'pending') : shares
  const dupes = new Map<string, number>()
  shares.forEach((s) => s.imageHash && dupes.set(s.imageHash, (dupes.get(s.imageHash) ?? 0) + 1))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm leading-relaxed text-muted-foreground">Onaylayınca paylaşım yayınlanır, ödül eklenir, kayan yazıya düşer ve Telegram kanalına gönderilir.</p>
        <select value={filter} onChange={(e) => setFilter(e.target.value as 'pending' | 'all')} className={cn(field, 'w-auto')} aria-label="Filtre">
          <option value="pending">Bekleyenler</option>
          <option value="all">Tümü</option>
        </select>
      </div>
      <StatusLine status={status} />
      {!list.length && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Onay bekleyen çekim yok.</p>}
      <ul className="grid gap-3 lg:grid-cols-2">
        {list.map((s) => (
          <ShareRow key={s.id} share={s} duplicate={(dupes.get(s.imageHash) ?? 0) > 1} initial={defaultReward(s.siteId, settings, siteRewards)} pending={pending} run={run} />
        ))}
      </ul>
    </div>
  )
}

function ShareRow({
  share: s,
  duplicate,
  initial,
  pending,
  run,
}: {
  share: AdminWithdrawShare
  duplicate: boolean
  initial: WithdrawReward
  pending: boolean
  run: ReturnType<typeof useAction>['run']
}) {
  const [reward, setReward] = useState(initial)
  const [note, setNote] = useState('')
  const st = STATUS[s.status]
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex gap-3">
        <a href={s.image} target="_blank" rel="noreferrer" className="block size-24 shrink-0 overflow-hidden rounded-lg border border-border bg-background">
          <img src={s.image || '/placeholder.svg'} alt={`${s.siteName} çekim ekran görüntüsü`} className="size-full object-cover" />
        </a>
        <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-bold text-foreground">{s.siteName}</span>
            <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold', st.tone)}>{st.label}</span>
          </div>
          <span className="text-foreground">
            <b>{s.amount.toLocaleString('tr-TR')} TL</b> · {time(s.paidAt)}
          </span>
          <span className="truncate text-muted-foreground">Site kullanıcı adı: <b className="text-foreground">{s.fullUsername}</b></span>
          <span className="truncate text-muted-foreground">Üye: {s.userName} · Gönderim {time(s.createdAt)}</span>
          {duplicate && <span className="text-xs font-bold text-destructive">Bu görüntü daha önce de yüklenmiş.</span>}
          {s.note && <span className="text-xs text-muted-foreground">Not: {s.note}</span>}
        </div>
      </div>

      {s.status === 'pending' ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Coin
              <input type="number" min={0} value={reward.coin} onChange={(e) => setReward({ ...reward, coin: Number(e.target.value) })} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Puan (KP)
              <input type="number" min={0} value={reward.kp} onChange={(e) => setReward({ ...reward, kp: Number(e.target.value) })} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Market ödülü
              <input value={reward.item} onChange={(e) => setReward({ ...reward, item: e.target.value })} placeholder="Opsiyonel" className={field} />
            </label>
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ret sebebi (reddedersen üyeye gider)" className={field} />
          <div className="flex flex-wrap gap-2">
            <button disabled={pending} onClick={() => run(() => approveShare(s.id, reward))} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-50">
              <Check className="size-4" aria-hidden /> Onayla ve yayınla
            </button>
            <button disabled={pending} onClick={() => run(() => rejectShare(s.id, note))} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 text-xs font-bold text-secondary-foreground disabled:opacity-50">
              <X className="size-4" aria-hidden /> Reddet
            </button>
            <button disabled={pending} onClick={() => confirm('Sahte olarak işaretlenecek ve üye çekim paylaşımından engellenecek. Emin misin?') && run(() => fakeShare(s.id))} className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-destructive/15 px-3 text-xs font-bold text-destructive disabled:opacity-50">
              <Ban className="size-4" aria-hidden /> Sahte
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Ödül: {[s.rewardCoin && `${s.rewardCoin} KC`, s.rewardKp && `${s.rewardKp} KP`, s.rewardItem].filter(Boolean).join(' + ') || 'yok'}
          </span>
          <button disabled={pending} onClick={() => confirm('Paylaşım ve görüntü silinecek. Emin misin?') && run(() => removeShare(s.id))} className="flex h-8 items-center gap-1 rounded-lg px-2 font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50">
            <Trash2 className="size-4" aria-hidden /> Sil
          </button>
        </div>
      )}
    </li>
  )
}

function RewardInputs({ value, onChange }: { value: WithdrawReward; onChange: (v: WithdrawReward) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <input type="number" min={0} aria-label="Coin" placeholder="Coin" value={value.coin} onChange={(e) => onChange({ ...value, coin: Number(e.target.value) })} className={field} />
      <input type="number" min={0} aria-label="Puan" placeholder="KP" value={value.kp} onChange={(e) => onChange({ ...value, kp: Number(e.target.value) })} className={field} />
      <input aria-label="Market ödülü" placeholder="Market ödülü" value={value.item} onChange={(e) => onChange({ ...value, item: e.target.value })} className={field} />
    </div>
  )
}

function Rewards({ settings, siteRewards, sites }: { settings: WithdrawSettings; siteRewards: SiteReward[]; sites: Props['sites'] }) {
  const { pending, status, run } = useAction()
  const [base, setBase] = useState<WithdrawReward>({ coin: settings.coin, kp: settings.kp, item: settings.item })
  return (
    <div className="flex flex-col gap-4">
      <StatusLine status={status} />
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-bold text-foreground">Varsayılan ödül</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">Özel ödülü olmayan tüm siteler için geçerli. Coin, puan, ikisi birden veya market ödülü verebilirsin; istemediğini 0 / boş bırak. Onay ekranında her paylaşım için ayrıca değiştirilebilir.</p>
        <RewardInputs value={base} onChange={setBase} />
        <button disabled={pending} onClick={() => run(() => updateWithdrawSettings(base))} className="h-9 w-fit rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-50">
          Kaydet
        </button>
      </section>
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-bold text-foreground">Siteye özel ödüller</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">Sponsorla anlaştığın ödülü buraya gir. Kaldırırsan site varsayılana döner.</p>
        <ul className="flex flex-col gap-3">
          {sites.map((site) => (
            <SiteRewardRow key={site.id} site={site} current={siteRewards.find((r) => r.siteId === site.id) ?? null} pending={pending} run={run} />
          ))}
        </ul>
      </section>
    </div>
  )
}

function SiteRewardRow({ site, current, pending, run }: { site: { id: string; name: string }; current: SiteReward | null; pending: boolean; run: ReturnType<typeof useAction>['run'] }) {
  const [value, setValue] = useState<WithdrawReward>(current ?? { coin: 0, kp: 0, item: '' })
  return (
    <li className="flex flex-col gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-semibold text-foreground">{site.name}</span>
        <span className="text-xs text-muted-foreground">{current ? 'Özel ödül' : 'Varsayılan'}</span>
      </div>
      <RewardInputs value={value} onChange={setValue} />
      <div className="flex gap-2">
        <button disabled={pending} onClick={() => run(() => updateSiteReward(site.id, value))} className="h-8 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-50">
          Kaydet
        </button>
        {current && (
          <button disabled={pending} onClick={() => run(() => updateSiteReward(site.id, null))} className="h-8 rounded-lg bg-secondary px-3 text-xs font-bold text-secondary-foreground disabled:opacity-50">
            Varsayılana dön
          </button>
        )}
      </div>
    </li>
  )
}

function Rules({ settings, blocks }: { settings: WithdrawSettings; blocks: Block[] }) {
  const { pending, status, run } = useAction()
  const [cfg, setCfg] = useState(settings)
  const num = (key: 'weekly' | 'minAmount' | 'maxAgeDays' | 'minAccountDays', label: string, hint: string) => (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">{label}</span>
      <input type="number" min={0} value={cfg[key]} onChange={(e) => setCfg({ ...cfg, [key]: Number(e.target.value) })} className={field} />
      <span>{hint}</span>
    </label>
  )
  return (
    <div className="flex flex-col gap-4">
      <StatusLine status={status} />
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-bold text-foreground">Kötüye kullanım kuralları</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {num('weekly', 'Haftalık limit', 'Bir üye 7 günde en fazla bu kadar paylaşım gönderebilir.')}
          {num('minAmount', 'Minimum tutar (TL)', 'Bunun altındaki çekimler kabul edilmez.')}
          {num('maxAgeDays', 'En eski çekim (gün)', 'Bu günden eski çekimler paylaşılamaz.')}
          {num('minAccountDays', 'Hesap yaşı (gün)', 'Yeni açılan hesaplar bu süre dolmadan paylaşamaz.')}
        </div>
        <ul className="flex flex-col gap-1 text-xs leading-relaxed text-muted-foreground">
          <li>Sabit kurallar: aynı görüntü ikinci kez yüklenemez, aynı site + kullanıcı adı + tutar + saat tekrar edilemez, sadece png/jpg/webp ve en fazla 5 MB.</li>
          <li>30 gün içinde 3 reddedilen paylaşım üyeyi 14 gün engeller. Sahte işaretlenen üye kalıcı engellenir ve ödülü geri alınır.</li>
        </ul>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={cfg.tgEnabled} onChange={(e) => setCfg({ ...cfg, tgEnabled: e.target.checked })} className="size-4 accent-primary" />
          Onaylanınca Telegram kanalına paylaş
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={cfg.tgShowAmount} onChange={(e) => setCfg({ ...cfg, tgShowAmount: e.target.checked })} className="size-4 accent-primary" />
          Telegram mesajında tutarı göster
        </label>
        <button disabled={pending} onClick={() => run(() => updateWithdrawSettings(cfg))} className="h-9 w-fit rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-50">
          Kuralları kaydet
        </button>
      </section>
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-bold text-foreground">Engellenen üyeler</h3>
        {!blocks.length && <p className="text-sm text-muted-foreground">Engellenen üye yok.</p>}
        <ul className="flex flex-col gap-2">
          {blocks.map((b) => (
            <li key={b.userId} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0">
                <b className="text-foreground">{b.name}</b>
                <span className="block truncate text-xs text-muted-foreground">
                  {b.reason} · {b.until ? `${time(b.until)} tarihine kadar` : 'Kalıcı'}
                </span>
              </span>
              <button disabled={pending} onClick={() => run(() => unblockShareUser(b.userId))} className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-secondary px-3 text-xs font-bold text-secondary-foreground disabled:opacity-50">
                <ShieldOff className="size-4" aria-hidden /> Kaldır
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
