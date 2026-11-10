'use client'

import { useActionState, useState } from 'react'
import { saveHomeV2, type ActionState } from '@/app/panel/actions'
import { DEFAULT_HOME_V2, OKEY_POINT_CHOICES, type HomeV2Settings, type DailyTile } from '@/lib/home-v2-shared'
import { ImageField } from '@/components/panel/image-field'

const input =
  'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
      {label}
      {children}
      {hint && <span className="font-normal leading-relaxed text-muted-foreground">{hint}</span>}
    </label>
  )
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 text-sm text-foreground">
      <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold">{label}</span>
        {hint && <span className="text-xs leading-relaxed text-muted-foreground">{hint}</span>}
      </span>
    </label>
  )
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <legend className="px-1 text-sm font-bold text-foreground">{title}</legend>
      {desc && <p className="-mt-2 text-xs leading-relaxed text-muted-foreground">{desc}</p>}
      {children}
    </fieldset>
  )
}

export function HomeV2Editor({ initial }: { initial: HomeV2Settings }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveHomeV2, {})
  const [v, setV] = useState<HomeV2Settings>(initial)
  const home = v.home
  const setup = v.setup
  const setHome = (patch: Partial<HomeV2Settings['home']>) => setV((p) => ({ ...p, home: { ...p.home, ...patch } }))
  const setSetup = (patch: Partial<HomeV2Settings['setup']>) => setV((p) => ({ ...p, setup: { ...p.setup, ...patch } }))
  const setTile = (i: number, patch: Partial<DailyTile>) =>
    setHome({ daily: home.daily.map((t, j) => (j === i ? { ...t, ...patch } : t)) })

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="payload" value={JSON.stringify(v)} />

      <Section title="Üye ana sayfası" desc="Giriş yapmış üyeler ana sayfada bu bölümü görür. Misafirler mevcut ana sayfayı görmeye devam eder.">
        <Toggle label="Yeni üye ana sayfasını göster" checked={home.enabled} onChange={(enabled) => setHome({ enabled })} hint="Kapatırsan üyeler eski ana sayfayı görür." />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Üst satır" hint="{ad} yazan yere üyenin adı gelir.">
            <input className={input} value={home.eyebrow} maxLength={60} onChange={(e) => setHome({ eyebrow: e.target.value })} />
          </Field>
          <Field label="Başlık">
            <input className={input} value={home.title} maxLength={90} onChange={(e) => setHome({ title: e.target.value })} />
          </Field>
          <Field label="Ana buton yazısı">
            <input className={input} value={home.primaryCta} maxLength={30} onChange={(e) => setHome({ primaryCta: e.target.value })} />
          </Field>
          <Field label="Ana buton linki" hint="Masa açma sihirbazı için: /oyunlar/okey?masa-ac=1">
            <input className={input} value={home.primaryHref} maxLength={200} onChange={(e) => setHome({ primaryHref: e.target.value })} />
          </Field>
          <Field label="İkinci buton yazısı">
            <input className={input} value={home.secondaryCta} maxLength={30} onChange={(e) => setHome({ secondaryCta: e.target.value })} />
          </Field>
          <Field label="İkinci buton linki">
            <input className={input} value={home.secondaryHref} maxLength={200} onChange={(e) => setHome({ secondaryHref: e.target.value })} />
          </Field>
        </div>
        <Field label="Etiketler" hint="Virgülle ayır, en fazla 5 tane. Örnek: 4 kişi, Tekli, 20 puan">
          <input
            className={input}
            value={home.pills.join(', ')}
            onChange={(e) => setHome({ pills: e.target.value.split(',').map((s) => s.trimStart()).slice(0, 5) })}
          />
        </Field>
        <ImageField label="Kapak görseli" value={home.heroImage} onChange={(heroImage) => setHome({ heroImage })} uploadId="home-v2-hero" />
      </Section>

      <Section title="Günlük kutular" desc="Ana sayfadaki 3 kısayol kutusu.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Bölüm başlığı">
            <input className={input} value={home.dailyTitle} maxLength={60} onChange={(e) => setHome({ dailyTitle: e.target.value })} />
          </Field>
          <Field label="Alt yazı">
            <input className={input} value={home.dailySub} maxLength={120} onChange={(e) => setHome({ dailySub: e.target.value })} />
          </Field>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {home.daily.map((t, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3">
              <span className="text-xs font-bold text-muted-foreground">{`Kutu ${i + 1}`}</span>
              <Field label="Başlık">
                <input className={input} value={t.title} maxLength={40} onChange={(e) => setTile(i, { title: e.target.value })} />
              </Field>
              <Field label="Buton yazısı">
                <input className={input} value={t.action} maxLength={24} onChange={(e) => setTile(i, { action: e.target.value })} />
              </Field>
              <Field label="Link">
                <input className={input} value={t.href} maxLength={200} onChange={(e) => setTile(i, { href: e.target.value })} />
              </Field>
              <ImageField label="Görsel" value={t.image} onChange={(image) => setTile(i, { image })} uploadId={`home-v2-tile-${i}`} compact />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Yan bloklar">
        <div className="grid gap-3 md:grid-cols-2">
          <Toggle label="Cüzdan kartı" checked={home.showWallet} onChange={(showWallet) => setHome({ showWallet })} />
          <Toggle label="Liderlik tablosu" checked={home.showLeaderboard} onChange={(showLeaderboard) => setHome({ showLeaderboard })} />
        </div>
        <Field label="Market linki">
          <input className={input} value={home.marketHref} maxLength={200} onChange={(e) => setHome({ marketHref: e.target.value })} />
        </Field>
      </Section>

      <Section title="Okey masa açma sihirbazı" desc="Okey sayfasında adım adım masa kurma ekranı.">
        <Toggle label="Sihirbazı aç" checked={setup.enabled} onChange={(enabled) => setSetup({ enabled })} hint="Kapalıyken okey lobisi eskisi gibi çalışır." />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Başlık">
            <input className={input} value={setup.title} maxLength={40} onChange={(e) => setSetup({ title: e.target.value })} />
          </Field>
          <Field label="Açıklama">
            <input className={input} value={setup.intro} maxLength={200} onChange={(e) => setSetup({ intro: e.target.value })} />
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-foreground">Seçilebilir başlangıç puanları</span>
          <div className="flex flex-wrap gap-2">
            {OKEY_POINT_CHOICES.map((p) => {
              const on = setup.points.includes(p)
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setSetup({ points: on ? setup.points.filter((x) => x !== p) : [...setup.points, p].sort((a, b) => a - b) })
                  }
                  className={`h-9 rounded-lg border px-4 text-sm font-bold transition-colors ${on ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-background text-muted-foreground'}`}
                >
                  {p === 0 ? 'Puansız' : `${p} puan`}
                </button>
              )
            })}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Toggle label="2 kişilik masaya izin ver" checked={setup.allowTwoSeats} onChange={(allowTwoSeats) => setSetup({ allowTwoSeats })} />
          <Toggle label="Bot ile doldurma seçeneği" checked={setup.quickBotEnabled} onChange={(quickBotEnabled) => setSetup({ quickBotEnabled })} />
        </div>
        <Field label="Puan kuralı açıklaması" hint="Puan adımında oyuncuya gösterilir.">
          <textarea
            className={`${input} h-28 py-2 leading-relaxed`}
            value={setup.ruleFull}
            maxLength={800}
            onChange={(e) => setSetup({ ruleFull: e.target.value })}
          />
        </Field>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="h-10 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-60">
          {pending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <button type="button" onClick={() => setV(DEFAULT_HOME_V2)} className="h-10 rounded-lg border border-border px-4 text-sm font-semibold text-muted-foreground hover:text-foreground">
          Varsayılana dön
        </button>
        {state.message && (
          <p role="status" className={`text-sm ${state.ok ? 'text-primary' : 'text-destructive'}`}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  )
}
