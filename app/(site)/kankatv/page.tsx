import { pageMeta } from '@/lib/seo'
import { getKankaTvData } from '@/lib/kankatv'
import { KankaTvBoard } from '@/components/alkanka/kankatv/board'

export const metadata = pageMeta('kankatv')
export const revalidate = 30

export default async function KankaTvPage() {
  const data = await getKankaTvData()
  return <KankaTvBoard initial={data} />
}
