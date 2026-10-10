import type { ReactNode } from 'react'
import { AuthModalProvider } from './auth-modal'
import { BrandProvider } from './brand-context'
import { Footer } from './footer'
import { LiveRail } from './live-rail'
import { MobileNav } from './mobile-nav'
import { PointsProvider } from './points-context'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <BrandProvider>
      <PointsProvider>
        <AuthModalProvider>
          <Sidebar />
          <LiveRail />
          <div className="min-h-dvh pb-16 lg:pb-0 lg:pl-64 xl:pr-80">
            <Topbar />
            <div className="mx-auto flex max-w-screen-2xl flex-col gap-12 px-4 py-5 lg:px-6">
              {children}
              <Footer />
            </div>
          </div>
          <MobileNav />
        </AuthModalProvider>
      </PointsProvider>
    </BrandProvider>
  )
}
