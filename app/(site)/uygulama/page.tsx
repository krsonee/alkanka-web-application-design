import { pageMeta } from '@/lib/seo'
import { PageHero } from '@/components/alkanka/page-hero'
import { InstallGuide } from '@/components/alkanka/app/install-guide'
import { getAppProgress } from '@/app/actions/app'
import { getAppSettings } from '@/lib/app-settings'

export const metadata = pageMeta('uygulama')

export default async function AppPage() {
  const [progress, settings] = await Promise.all([getAppProgress(), getAppSettings()])
  const total = settings.installBonus + settings.pushBonus
  return (
    <>
      <PageHero
        compact
        eyebrow="Mobil uygulama"
        title={`2 adım, ${total.toLocaleString('tr-TR')} KC`}
        description="Ana ekrana ekle, bildirimleri aç. Turnuvalara ilk sen gir, promo kodları ilk sen kap."
        image="/images/heroes/uygulama.png"
      />
      <InstallGuide installClaimed={progress.install} pushClaimed={progress.push} />
    </>
  )
}
