import { BrandProvider } from '@/components/alkanka/brand-context'
import { PointsProvider } from '@/components/alkanka/points-context'
import { Sidebar } from '@/components/alkanka/sidebar'
import { Topbar } from '@/components/alkanka/topbar'
import { LiveRail } from '@/components/alkanka/live-rail'
import { MobileNav } from '@/components/alkanka/mobile-nav'
import { Footer } from '@/components/alkanka/footer'
import { AuthModal } from '@/components/alkanka/auth-modal'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <BrandProvider>
      <PointsProvider>
        <Sidebar />
        <LiveRail />
        <div className="min-h-dvh lg:pl-64 xl:pr-80">
          <Topbar />
          <main className="mx-auto flex max-w-screen-2xl flex-col gap-10 px-4 py-5 pb-24 lg:px-6 lg:pb-5">
            {children}
            <Footer />
          </main>
        </div>
        <MobileNav />
        <AuthModal />
      </PointsProvider>
    </BrandProvider>
  )
}
