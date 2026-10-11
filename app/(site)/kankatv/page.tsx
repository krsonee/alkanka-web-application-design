import { pageMeta } from '@/lib/seo'
import { getChannels, getScoreBoard } from '@/lib/kankatv'
import { KankaTvBoard } from '@/components/alkanka/kankatv/board'

export const metadata = pageMeta('kankatv')
export const revalidate = 30

export default async function KankaTvPage() {
  const [board, channels] = await Promise.all([getScoreBoard('futbol', 0), getChannels()])
  return <KankaTvBoard initialBoard={board} initialChannels={channels} />
}
