'use client'

import { useEffect, useRef } from 'react'
import Script from 'next/script'
import { usePathname } from 'next/navigation'
import type { TrackingSettings } from '@/lib/marketing-shared'

type Win = Window & { gtag?: (...args: unknown[]) => void; fbq?: (...args: unknown[]) => void }

function sponsorFromHref(href: string) {
  try {
    const url = new URL(href, window.location.origin)
    if (url.origin !== window.location.origin) return null
    const m = url.pathname.match(/^\/(git|r)\/([^/?#]+)/)
    return m ? m[2] : null
  } catch {
    return null
  }
}

export function MarketingTags({ settings }: { settings: TrackingSettings }) {
  const { ga4Id, adsId, adsSignupLabel, adsSponsorLabel, metaPixelId } = settings
  const gtagId = ga4Id || adsId
  const pathname = usePathname()
  const firstView = useRef(true)

  useEffect(() => {
    if (firstView.current) {
      firstView.current = false
      return
    }
    ;(window as Win).fbq?.('track', 'PageView')
  }, [pathname])

  useEffect(() => {
    const w = window as Win
    const fireSignup = () => {
      if (!document.cookie.split('; ').some((c) => c === 'alk_new=1')) return
      document.cookie = 'alk_new=; Max-Age=0; path=/; SameSite=Lax; Secure'
      w.gtag?.('event', 'sign_up', { method: 'site' })
      if (adsId && adsSignupLabel) w.gtag?.('event', 'conversion', { send_to: `${adsId}/${adsSignupLabel}` })
      w.fbq?.('track', 'CompleteRegistration')
    }
    const timer = window.setInterval(fireSignup, 3000)
    window.setTimeout(fireSignup, 1500)

    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a) return
      const sponsor = sponsorFromHref(a.getAttribute('href') ?? '')
      if (!sponsor) return
      w.gtag?.('event', 'sponsor_click', { sponsor, transport_type: 'beacon' })
      if (adsId && adsSponsorLabel) w.gtag?.('event', 'conversion', { send_to: `${adsId}/${adsSponsorLabel}`, transport_type: 'beacon' })
      w.fbq?.('trackCustom', 'SponsorClick', { sponsor })
    }
    document.addEventListener('click', onClick, true)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('click', onClick, true)
    }
  }, [adsId, adsSignupLabel, adsSponsorLabel])

  if (!gtagId && !metaPixelId) return null

  const gtagConfig = [ga4Id && `gtag('config','${ga4Id}');`, adsId && `gtag('config','${adsId}');`].filter(Boolean).join('')

  return (
    <>
      {gtagId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gtagId}`} strategy="afterInteractive" />
          <Script id="alk-gtag" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());${gtagConfig}`}
          </Script>
        </>
      )}
      {metaPixelId && (
        <Script id="alk-fbq" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixelId}');fbq('track','PageView');`}
        </Script>
      )}
    </>
  )
}
