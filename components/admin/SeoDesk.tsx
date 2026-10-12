import { SeoManager } from "@/components/panel/seo-manager";
import { listPosts } from "@/lib/blog";
import { dealsPublishing, getVerification, listDeals } from "@/lib/deals";
import { SITE_URL } from "@/lib/seo";

export async function SeoDesk() {
  const [posts, deals, publishing, verification] = await Promise.all([
    listPosts({ includeDrafts: true }),
    listDeals(30),
    dealsPublishing(),
    getVerification().catch(() => ({ google: "", bing: "", yandex: "" })),
  ]);

  return (
    <SeoManager posts={posts} deals={deals} publishing={publishing} verification={verification} siteUrl={SITE_URL} />
  );
}
