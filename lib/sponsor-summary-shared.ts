export type SponsorEarningRow = { period: string; model: string; ftd: number; amount: number; currency: string; status: string }

/** Panel sections the summary links to; a link is shown only to an account that may open that section. */
export const SUMMARY_SECTIONS = ['community', 'growth', 'marketing', 'catalog'] as const
export type SummarySection = (typeof SUMMARY_SECTIONS)[number]

export type SponsorSummary = {
  id: number
  name: string
  slug: string
  active: boolean
  links: { entry: boolean; site: boolean }
  /** `ends` is YYYY-MM-DD or empty; `daysLeft` is null without an end date; `fee` is the monthly TL fee, 0 when not entered. */
  deal: { ends: string; daysLeft: number | null; fee: number }
  clicks: {
    week: number
    month: number
    total: number
    /** Signed-in members among the last 30 days' clicks. */
    members: number
    /** Last 30 Istanbul days, oldest first. */
    daily: { day: string; n: number }[]
    sources: { src: string; n: number }[]
  }
  reviews: { approved: number; pending: number; rejected: number; average: number | null; editorRating: number }
  complaints: { open: number; forwarded: number; resolved: number; rejected: number }
  followers: number
  accounts: { pending: number; approved: number; rejected: number }
  content: { campaigns: number; liveCampaigns: number; bonuses: number }
  /** null when the viewer lacks the Kampanya permission. */
  earnings: null | {
    rows: SponsorEarningRow[]
    totals: { currency: string; pending: number; claimed: number; paid: number }[]
    ftd: number
  }
  /** Names of the figures that could not be read; they show as 0 and the screen says so. */
  missing: string[]
}
