import { pageMeta } from '@/lib/seo'
import { dayStats, getOddsBotConfig, listOddsByDay } from '@/lib/special-odds'
import { getChannelUsernames } from '@/lib/telegram-channels'
import { istanbulDay } from '@/lib/special-odds-shared'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { OddsFeed } from '@/components/alkanka/odds/odds-feed'

export const metadata = pageMeta('ozel-oranlar')
export const dynamic = 'force-dynamic'

export default async function OddsPage() {
  const today = istanbulDay()
  const [odds, config, channels] = await Promise.all([
    listOddsByDay(today),
    getOddsBotConfig().catch(() => null),
    getChannelUsernames().catch(() => null),
  ])
  const stats = dayStats(odds)
  const username = config?.channelUsername || channels?.['ozel-oran'] || null
  const channelUrl = username ? `https://t.me/${username.replace(/^@/, '')}` : null
  const settled = stats.won + stats.lost

  return (
    <>
      <EditableHero
        slug="ozel-oranlar"
        image="/images/heroes/ozel-oranlar.png"
        eyebrow="Özel oranlar"
        title="Artırılmış oranlar"
        description="Seçtiğimiz güvenilir sitelerin yükseltilmiş oranları, açıldığı an burada. Limit dolmadan kuponunu yap."
        pose="dusunen"
        speech="Oranlar 15 dakikada doluyor kanka, gözünü ayırma."
        tone="accent"
        compact
        stats={[
          { label: 'Şu an açık', value: String(stats.open) },
          { label: 'Bugün', value: String(stats.total) },
          { label: 'Kazanan', value: settled ? `${stats.won}/${settled}` : '-' },
        ]}
      />
      <OddsFeed initial={{ day: today, odds, stats }} today={today} channelUrl={channelUrl} />
    </>
  )
}
