import { Studio } from "@/components/panel/studio";
import { listAssets, listBrands, listJobs, studioSpend } from "@/lib/studio";

export async function StudioDesk() {
  const [brands, assets, jobs, spend] = await Promise.all([
    listBrands().catch(() => []),
    listAssets().catch(() => []),
    listJobs().catch(() => []),
    studioSpend().catch(() => ({ total: 0, month: 0, count: 0 })),
  ]);
  return <Studio brands={brands} assets={assets} jobs={jobs} spend={spend} />;
}
