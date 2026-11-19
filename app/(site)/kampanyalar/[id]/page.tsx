import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { MembersOnly } from '@/components/alkanka/members-only'
import { CampaignSolo } from '@/components/alkanka/partner-sites'
import { getCatalog } from '@/lib/catalog'
import { isCampaignLive } from '@/lib/catalog-shared'
import { pageMeta } from '@/lib/seo'
import { getSponsorAccess, MEMBERS_ONLY_ROBOTS } from '@/lib/sponsor-access'

// Campaigns are for members only, so the share preview stays the general one: the record's name never reaches a visitor.
export const metadata = { ...pageMeta('kampanyalar'), robots: MEMBERS_ONLY_ROBOTS }
export const dynamic = 'force-dynamic'

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await getSponsorAccess()
  if (access.state !== 'open') return <MembersOnly state={access.state} title="Kampanyalar üyelere özel" />

  const id = decodeURIComponent((await params).id)
  const { campaigns, bonuses } = await getCatalog()
  const campaign = campaigns.find((c) => c.id === id && isCampaignLive(c))
  const bonus = campaign ? undefined : bonuses.find((b) => b.id === id)
  if (!campaign && !bonus) notFound()

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/kampanyalar?sekme=bonuslar"
        className="flex items-center gap-2 self-start rounded-lg border border-border bg-card px-3 py-2 text-sm font-bold text-foreground hover:bg-secondary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Tüm kampanyalar
      </Link>
      <h1 className="sr-only">{campaign?.title ?? bonus?.title}</h1>
      <CampaignSolo id={id} />
    </div>
  )
}
