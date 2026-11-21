import { pageMeta } from '@/lib/seo'
import { LeaguePage, leagueAddress } from '@/components/alkanka/predictions/league-page'

export const metadata = pageMeta('tahminler')
export const dynamic = 'force-dynamic'

export default async function PredictionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <LeaguePage address={leagueAddress(await searchParams)} />
}
