'use client'

import { useState, useTransition } from 'react'
import { Check, Copy, KeyRound, Shuffle, UserCog } from 'lucide-react'
import { confirmed } from '@/components/panel/confirm-dialog'
import { memberInfoAction, memberPasswordAction, memberResetLinkAction } from '@/app/panel/members-actions'

type Outcome = { ok: true; message: string } | { ok: false; error: string }
type Run = (fn: () => Promise<Outcome>, after?: () => void) => void
type Member = { id: string; name: string; email: string; phone: string | null }

const input = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary'
const ghost = 'flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-secondary disabled:opacity-40'
const solid = 'rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40'
const box = 'flex flex-col gap-2 rounded-xl border border-border p-4'
const heading = 'flex items-center gap-2 text-sm font-semibold text-foreground'
const label = 'flex flex-col gap-1 text-xs text-muted-foreground'

const MIN_PASSWORD = 8
const READABLE = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Leaves out 0/O and 1/l, so a password read out over Telegram is not typed wrong. */
function randomPassword(length = 12) {
  const picks = new Uint32Array(length)
  crypto.getRandomValues(picks)
  return Array.from(picks, (n) => READABLE[n % READABLE.length]).join('')
}

function CopyButton({ text, name }: { text: string; name: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className={ghost}
      onClick={() =>
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          })
          .catch(() => setCopied(false))
      }
    >
      {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      {copied ? 'Kopyalandı' : 'Kopyala'}
      <span className="sr-only">: {name}</span>
    </button>
  )
}

/** Membership details and password, changed by staff when the member asks for it. */
export function MemberAccount({ member, busy, run }: { member: Member; busy: boolean; run: Run }) {
  const [name, setName] = useState(member.name)
  const [email, setEmail] = useState(member.email)
  const [phone, setPhone] = useState(member.phone ?? '')
  const [password, setPassword] = useState('')
  const [link, setLink] = useState<{ url: string; minutes: number } | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [making, startLink] = useTransition()

  const dirty = name.trim() !== member.name || email.trim().toLowerCase() !== member.email.toLowerCase() || phone.trim() !== (member.phone ?? '')

  return (
    <>
      <div className={box}>
        <h4 className={heading}>
          <UserCog className="size-4 text-primary" aria-hidden="true" />
          Üyelik bilgileri
        </h4>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Üye talep ettiğinde düzelt. Üye bundan sonra yeni kullanıcı adı ya da e-postasıyla giriş yapar; değişiklik panel kayıtlarına yazılır.
        </p>
        <label className={label}>
          Kullanıcı adı
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="off" />
        </label>
        <label className={label}>
          E-posta
          <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" autoCapitalize="none" />
        </label>
        <label className={label}>
          Telefon
          <input className={input} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} placeholder="Boş bırakılabilir" autoComplete="off" />
        </label>
        <button
          type="button"
          disabled={busy || !dirty}
          className={solid}
          onClick={() => confirmed(`${member.name} üyeliğinin bilgileri değiştirilsin mi?`, () => run(() => memberInfoAction(member.id, { name, email, phone })))}
        >
          Bilgileri kaydet
        </button>
      </div>

      <div className={box}>
        <h4 className={heading}>
          <KeyRound className="size-4 text-primary" aria-hidden="true" />
          Şifre
        </h4>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Önce üyenin gerçekten hesabın sahibi olduğundan emin ol: kayıtlı e-postasını, telefonunu ya da bağlı Telegram hesabını sor. Şifre panelde hiçbir yerde saklanmaz ve görünmez.
        </p>

        <div className="flex flex-col gap-2 rounded-lg bg-background p-3">
          <p className="text-sm font-medium text-foreground">Tek kullanımlık bağlantı (önerilen)</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Üye bağlantıya girip şifresini kendi belirler, sen şifreyi görmezsin. Yeni bağlantı üretince eskisi geçersiz olur.
          </p>
          <button
            type="button"
            disabled={busy || making}
            className={ghost}
            onClick={() =>
              startLink(async () => {
                const r = await memberResetLinkAction(member.id)
                setLink(r.ok ? { url: r.url, minutes: r.minutes } : null)
                setLinkError(r.ok ? null : r.error)
              })
            }
          >
            {making ? 'Üretiliyor…' : link ? 'Yeni bağlantı üret' : 'Bağlantı üret'}
          </button>
          {link && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input aria-label="Şifre yenileme bağlantısı" className={input} readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} />
                <CopyButton text={link.url} name="şifre yenileme bağlantısı" />
              </div>
              <p role="status" className="text-xs leading-relaxed text-muted-foreground">
                {link.minutes} dakika geçerli ve tek kullanımlık. Sadece üyenin kendisine gönder; üye şifresini kaydedince açık oturumları kapanır.
              </p>
            </div>
          )}
          {linkError && (
            <p role="alert" className="text-xs leading-relaxed text-destructive">
              {linkError}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-lg bg-background p-3">
          <p className="text-sm font-medium text-foreground">Şifreyi elle belirle</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Üye bağlantıyı açamıyorsa kullan. Şifreyi üyeye ilet ve girişten sonra Profil sayfasından değiştirmesini söyle.
          </p>
          <div className="flex gap-2">
            <input
              aria-label="Yeni şifre"
              className={input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`En az ${MIN_PASSWORD} karakter`}
              maxLength={128}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" className={ghost} onClick={() => setPassword(randomPassword())}>
              <Shuffle className="size-4" aria-hidden="true" />
              Rastgele
            </button>
            {password.length >= MIN_PASSWORD && <CopyButton text={password} name="yeni şifre" />}
          </div>
          <button
            type="button"
            disabled={busy || password.length < MIN_PASSWORD}
            className={solid}
            onClick={() =>
              confirmed(`${member.name} üyeliğinin şifresi değiştirilsin mi? Üye tüm cihazlarda oturumdan çıkar.`, () =>
                run(() => memberPasswordAction(member.id, password)),
              )
            }
          >
            Şifreyi değiştir
          </button>
        </div>
      </div>
    </>
  )
}
