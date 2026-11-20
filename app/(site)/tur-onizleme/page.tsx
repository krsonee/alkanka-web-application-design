import { TourSettingsEditor } from '@/components/panel/tour-settings-editor'
import { normalizeTourSettings } from '@/lib/tour-config'
import type { TourFunnel, TourStats } from '@/lib/tour'

export default function Page() {
  const base = normalizeTourSettings(null)
  const settings = normalizeTourSettings({
    ...base,
    split: true,
    version: 3,
    versionNote: 'Tahmin ligi eklendi',
    rewardDays: 7,
    tours: {
      member: base.tours.member.map((s, i) => (i === 3 ? { ...s, show: 'open', image: '/images/slides/okey.png' } : i === 5 ? { ...s, enabled: false } : s)),
      guest: base.tours.guest,
    },
  })
  const stats: TourStats = {
    done: 1840,
    rewarded: 1312,
    blocked: 2,
    paidTotal: 131200,
    recentBlocked: [
      { userId: 'u1', name: 'kanka_42', reason: 'aynı ağ / cihaz', at: '2026-11-19T18:20:00.000Z' },
      { userId: 'u2', name: 'zar_ustasi', reason: 'işaretli hesap', at: '2026-11-18T09:05:00.000Z' },
    ],
  }
  const counts = (list: { id: string; title: string }[], seen: number[], exits: number[]) => list.map((s, i) => ({ id: s.id, title: s.title, seen: seen[i] ?? 0, exits: exits[i] ?? 0 }))
  const funnel: TourFunnel = {
    guest: { runs: 920, finished: 310, steps: counts(settings.tours.guest, [920, 760, 610, 540, 420, 350, 330], [160, 150, 70, 120, 70, 20, 20]) },
    member: {
      runs: 480,
      finished: 402,
      steps: counts(
        settings.tours.member.filter((s) => s.enabled),
        [480, 470, 455, 440, 425, 415, 405],
        [10, 15, 15, 15, 10, 10, 3],
      ),
    },
  }
  return (
    <div className="mx-auto max-w-4xl p-4">
      <TourSettingsEditor settings={settings} stats={stats} funnel={funnel} siteBase="" />
    </div>
  )
}
