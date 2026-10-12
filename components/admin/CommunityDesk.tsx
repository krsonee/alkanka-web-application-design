import { CommunityManager } from "@/components/panel/community";
import { siteNames } from "@/lib/sponsor-catalog";
import { adminComplaints, listLeagueMatches, pendingReviews, publishedReviews } from "@/lib/community";

export async function CommunityDesk() {
  const [reviews, published, complaints, matches] = await Promise.all([
    pendingReviews().catch(() => []),
    publishedReviews().catch(() => []),
    adminComplaints().catch(() => []),
    listLeagueMatches(null, { admin: true }).catch(() => []),
  ]);
  return (
    <CommunityManager
      reviews={reviews}
      published={published}
      complaints={complaints}
      matches={matches}
      siteNames={await siteNames().catch(() => ({}))}
    />
  );
}
