import { pageMeta } from '@/lib/seo'
import { getChannels, getScoreBoard } from '@/lib/kankatv'
import { getMemberChannels } from '@/lib/member-streams'
import { KankaTvBoard } from '@/components/alkanka/kankatv/board'
import { AdFrame } from '@/components/alkanka/ad-frame'

export const metadata = pageMeta('kankatv')
export const revalidate = 30

export default async function KankaTvPage() {
  const [board, channels, members] = await Promise.all([getScoreBoard('futbol', 0), getChannels(), getMemberChannels()])
  return (
    <AdFrame page="kankatv">
      <KankaTvBoard initialBoard={board} initialChannels={[...members, ...channels]} />
    </AdFrame>
  )
}
