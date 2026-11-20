'use client'

import { useActionState } from 'react'
import { Loader2, MousePointerClick, PencilLine, Share2 } from 'lucide-react'
import type { ActionState } from '@/app/panel/actions'
import { parseReplacements, serializeRules, type ReplaceRule } from '@/lib/text-replace'
import type { PostButton } from '@/lib/tg-buttons'
import { RuleTable } from './rule-table'
import { ButtonRows, type LinkChoice } from './tg-button-rows'

const input =
  'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'
const saveBtn = 'inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50'

type RuleProps = { mode: 'odds' | 'mirror'; mainLink?: string; shared?: ReplaceRule[] }

function Saved({ state }: { state: ActionState }) {
  if (!state.message) return null
  return (
    <p role="status" className={`text-xs ${state.ok ? 'text-primary' : 'text-destructive'}`}>
      {state.message}
    </p>
  )
}

/** Per-source rewrite rules and footer, shared by the post mirror and the special odds bot. */
export function SourceTextFields({
  replacements = '',
  footer = '',
  footerPlaceholder,
  mode,
  mainLink,
  shared,
}: { replacements?: string; footer?: string; footerPlaceholder: string } & RuleProps) {
  return (
    <>
      <RuleTable initial={replacements} mode={mode} mainLink={mainLink} shared={shared} />
      <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
        Alt satır yazısı (isteğe bağlı)
        <input name="footer" maxLength={300} defaultValue={footer} placeholder={footerPlaceholder} className={input} />
      </label>
    </>
  )
}

export function SourceTextEditor({
  id,
  linkName,
  link,
  replacements,
  footer,
  footerPlaceholder,
  action,
  mode,
  shared,
}: {
  id: number
  linkName: 'link' | 'siteLink'
  link: string
  replacements: string
  footer: string
  footerPlaceholder: string
  action: (state: ActionState, form: FormData) => Promise<ActionState>
} & Omit<RuleProps, 'mainLink'>) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {})
  const ruleCount = parseReplacements(replacements).length
  return (
    <details className="group w-full rounded-xl border border-border bg-background/50">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-semibold text-foreground">
        <PencilLine className="size-3.5" aria-hidden />
        Metin ve linkleri düzenle
        <span className="font-normal text-muted-foreground">{ruleCount ? `· ${ruleCount} kural` : '· kural yok'}</span>
      </summary>
      <form action={formAction} className="flex flex-col gap-3 border-t border-border p-3">
        <input type="hidden" name="id" value={id} />
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          Ana link
          <input name={linkName} type="url" required defaultValue={link} className={input} />
        </label>
        <SourceTextFields replacements={replacements} footer={footer} footerPlaceholder={footerPlaceholder} mode={mode} mainLink={link} shared={shared} />
        <div className="flex items-center gap-3">
          <button disabled={pending} className={saveBtn}>
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            Kaydet
          </button>
          <Saved state={state} />
        </div>
      </form>
    </details>
  )
}

/** Our buttons under each shared post, and whether the source post's own buttons come along. */
export function SourceButtonFields({ buttons, carryButtons = false, links }: { buttons?: PostButton[]; carryButtons?: boolean; links?: LinkChoice[] }) {
  return (
    <>
      <ButtonRows initial={buttons} links={links} />
      <label className="flex items-start gap-2 text-sm text-foreground">
        <input type="checkbox" name="carryButtons" defaultChecked={carryButtons} className="mt-0.5 size-4 accent-primary" />
        <span className="flex flex-col gap-0.5">
          Kaynak postun kendi butonlarını da taşı
          <span className="text-xs leading-relaxed text-muted-foreground">
            Butonların linkleri kurallara göre değişir; kural tutmayan buton ana linke gider. “Buton linki” kuralında yeni linki boş bırakırsan o buton
            taşınmaz. Sadece link açan butonlar taşınır.
          </span>
        </span>
      </label>
    </>
  )
}

export function SourceButtonsEditor({
  id,
  buttons,
  carryButtons,
  links,
  action,
}: {
  id: number
  buttons: PostButton[]
  carryButtons: boolean
  links?: LinkChoice[]
  action: (state: ActionState, form: FormData) => Promise<ActionState>
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {})
  return (
    <details className="w-full rounded-xl border border-border bg-background/50">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-semibold text-foreground">
        <MousePointerClick className="size-3.5" aria-hidden />
        Butonlar
        <span className="font-normal text-muted-foreground">
          · {buttons.length ? `${buttons.length} buton` : 'buton yok'}
          {carryButtons ? ' · kaynağın butonları taşınıyor' : ''}
        </span>
      </summary>
      <form action={formAction} className="flex flex-col gap-3 border-t border-border p-3">
        <input type="hidden" name="id" value={id} />
        <SourceButtonFields buttons={buttons} carryButtons={carryButtons} links={links} />
        <div className="flex items-center gap-3">
          <button disabled={pending} className={saveBtn}>
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            Kaydet
          </button>
          <Saved state={state} />
        </div>
      </form>
    </details>
  )
}

/** Rules applied to every source of both bots. A source's own rule for the same thing wins. */
export function SharedRulesCard({ rules, action }: { rules: ReplaceRule[]; action: (state: ActionState, form: FormData) => Promise<ActionState> }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {})
  return (
    <details className="rounded-2xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-semibold text-foreground">
        <Share2 className="size-4 text-accent" aria-hidden />
        Ortak değiştirme kuralları
        <span className="font-normal text-muted-foreground">· {rules.length ? `${rules.length} kural, bütün kaynaklarda` : 'kural yok'}</span>
      </summary>
      <form action={formAction} className="flex flex-col gap-3 border-t border-border p-4">
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          Buradaki kurallar post aktarma ve özel oran botunun bütün kaynaklarında uygulanır. Aynı şey için kaynağın kendi kuralı varsa o geçerli olur.
        </p>
        <RuleTable key={serializeRules(rules)} name="rules" initial={serializeRules(rules)} mode="mirror" offerShare={false} />
        <div className="flex items-center gap-3">
          <button disabled={pending} className={saveBtn}>
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            Ortak kuralları kaydet
          </button>
          <Saved state={state} />
        </div>
      </form>
    </details>
  )
}
