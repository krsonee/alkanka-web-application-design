import { BrandProvider } from "@/components/alkanka/brand-context";
import { DesignContentProvider } from "@/components/alkanka/content-context";
import { Footer } from "@/components/alkanka/footer";
import { LiveRail } from "@/components/alkanka/live-rail";
import { LogoProvider } from "@/components/alkanka/logo-context";
import { MobileNav } from "@/components/alkanka/mobile-nav";
import { AppPrompts } from "@/components/alkanka/app/app-prompts";
import { PwaProvider } from "@/components/alkanka/app/pwa-provider";
import { SiteTour } from "@/components/alkanka/app/site-tour";
import { ReferralLinker } from "@/components/alkanka/community/referral-linker";
import { KpHeartbeat } from "@/components/alkanka/kp/heartbeat";
import { PointsProvider } from "@/components/alkanka/points-context";
import { Sidebar } from "@/components/alkanka/sidebar";
import { Topbar } from "@/components/alkanka/topbar";
import { SiteGuard } from "@/components/SiteGuard";
import { logoMaps } from "@/lib/design-content";
import { getDesignContent } from "@/lib/load-design-content";
import { getCurrentMember } from "@/lib/member-auth";
import { getBalance } from "@/lib/points";
import { getSocialLinks } from "@/lib/social";

export async function SiteShell({ children }: { children: React.ReactNode }) {
  const member = await getCurrentMember();
  const balance = member ? await getBalance(member.id) : 0;
  const content = await getDesignContent();
  const social = await getSocialLinks().catch(() => ({}));

  return (
    <DesignContentProvider value={content}>
    <LogoProvider value={logoMaps(content)}>
    <BrandProvider>
      <PointsProvider>
      <PwaProvider>
        <SiteGuard />
        <Sidebar social={social} />
        <LiveRail />
        <div className="min-h-dvh bg-background font-sans text-foreground lg:pl-64 xl:pr-80">
          <Topbar social={social} />
          <main className="mx-auto flex max-w-screen-2xl flex-col gap-10 px-4 py-5 pb-24 lg:px-6 lg:pb-5">
            {children}
            <Footer />
          </main>
        </div>
        <MobileNav />
        <AppPrompts />
        <SiteTour />
        <ReferralLinker />
        <KpHeartbeat />
      </PwaProvider>
      </PointsProvider>
    </BrandProvider>
    </LogoProvider>
    </DesignContentProvider>
  );
}

export async function SiteFrame({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
