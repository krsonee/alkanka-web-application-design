import { pageMeta } from '@/lib/seo'
import { PageHero } from '@/components/alkanka/page-hero'
import { InstallGuide } from '@/components/alkanka/app/install-guide'
import { getAppBonusClaimed } from '@/app/actions/app'
import { APP_BONUS } from '@/lib/app-config'

export const metadata = pageMeta('uygulama')

export default async function AppPage() {
  const claimed = await getAppBonusClaimed()
  return (
    <>
      <PageHero
        eyebrow="Mobil uygulama"
        title={`Telefonuna ekle, ${APP_BONUS} KC kap`}
        description="Mağazaya gerek yok. AL KANKA'yı Android ya da iPhone ana ekranına 1 dakikada ekle, bildirimleri aç, kampanyaları ilk sen yakala."
        image="/images/heroes/uygulama.png"
        stats={[
          { label: 'Uygulama bonusu', value: `${APP_BONUS} KC` },
          { label: 'Boyut', value: '< 1 MB' },
          { label: 'Mağaza', value: 'Gerekmez' },
        ]}
      />
      <InstallGuide claimed={claimed} />
    </>
  )
}
