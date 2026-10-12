import { isAuthenticated } from "@/lib/admin-gate";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { MirrorDesk } from "@/components/admin/MirrorDesk";
import { SeoDesk } from "@/components/admin/SeoDesk";
import { CommunityDesk } from "@/components/admin/CommunityDesk";
import { KpManager } from "@/components/admin/KpManager";
import { StudioDesk } from "@/components/admin/StudioDesk";
import { AUTO_LABELS, getKpConfig, leaderboard, listSpecialBadges, recentAwards } from "@/lib/kanka-puan";

export const dynamic = "force-dynamic";

async function kpPanel() {
  try {
    const [cfg, badges, awards, board] = await Promise.all([
      getKpConfig(),
      listSpecialBadges({ includeInactive: true }),
      recentAwards(),
      leaderboard(50),
    ]);
    return <KpManager levels={cfg.levels} rules={cfg.rules} badges={badges} awards={awards} board={board} autoLabels={AUTO_LABELS} />;
  } catch (error) {
    console.error("[kp-panel]", error);
    return <p className="text-sm text-destructive">Rozet sistemi yüklenemedi.</p>;
  }
}

export default async function AdminPage() {
  const authed = await isAuthenticated();
  if (!authed) return <AdminLogin />;
  return (
    <AdminDashboard
      seo={<SeoDesk />}
      mirror={<MirrorDesk />}
      studio={<StudioDesk />}
      community={<CommunityDesk />}
      badges={await kpPanel()}
    />
  );
}
