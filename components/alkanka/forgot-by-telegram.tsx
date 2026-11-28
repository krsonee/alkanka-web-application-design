'use client'

import { Send } from 'lucide-react'
import { PASSWORD_COMMAND } from '@/lib/tg-hub-shared'
import { useTelegramUrl } from './telegram-address'

const cta =
  'flex h-11 items-center justify-center gap-2 rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90'

/** Password renewal while the site has no e-mail: the support bot hands out a single-use link. */
export function ForgotByTelegram({ bot, loading, onLogin }: { bot: string | null; loading: boolean; onLogin: () => void }) {
  const channel = useTelegramUrl()
  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-xl font-bold">Şifreni sıfırla</h2>
      {loading ? (
        <p role="status" className="text-sm leading-relaxed text-muted-foreground">
          Bekle kanka…
        </p>
      ) : bot ? (
        <>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Şifreni Telegram&apos;daki destek botumuz yeniliyor. Botu aç ve <span className="font-mono font-semibold text-foreground">{PASSWORD_COMMAND}</span> yaz.
          </p>
          <ul className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">Telegram hesabın üyeliğine bağlıysa</span> tek kullanımlık şifre yenileme bağlantın hemen gelir.
            </li>
            <li>
              <span className="font-semibold text-foreground">Bağlı değilse</span> bot kullanıcı adını ve kayıtlı e-postanı sorar, talebini yetkililere iletir.
            </li>
          </ul>
          <a href={`https://t.me/${bot}?start=${PASSWORD_COMMAND.slice(1)}`} target="_blank" rel="noopener noreferrer" className={cta}>
            <Send className="size-4" aria-hidden="true" />
            Destek botunu aç
          </a>
        </>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Şifre yenileme şu an Telegram üzerinden yapılıyor. Kanalımızdan yetkililere yaz; kullanıcı adını ve kayıtlı e-postanı sorup şifreni yenileyecekler.
          </p>
          <a href={channel} target="_blank" rel="noopener noreferrer" className={cta}>
            <Send className="size-4" aria-hidden="true" />
            Telegram&apos;a git
          </a>
        </>
      )}
      <p className="text-center text-xs text-muted-foreground">
        Şifreni hatırladın mı?{' '}
        <button type="button" onClick={onLogin} className="font-semibold text-primary hover:underline">
          Giriş yap
        </button>
      </p>
    </div>
  )
}
