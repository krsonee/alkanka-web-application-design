'use client'

import { useActionState } from 'react'
import { Loader2, PencilLine } from 'lucide-react'
import type { ActionState } from '@/app/panel/actions'

const input =
  'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'

const EXAMPLE = 'eskimarka => Alkanka\n@eskikanal => @alkanka\neskisite.com => https://senin-linkin.com'

/** Per-source text/link rewrite fields shared by the post mirror and the special odds bot. */
export function SourceTextFields({ replacements = '', footer = '', footerPlaceholder }: { replacements?: string; footer?: string; footerPlaceholder: string }) {
  return (
    <>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
        Değiştirilecek metin ve linkler (bu sponsora özel)
        <textarea name="replacements" rows={4} defaultValue={replacements} placeholder={EXAMPLE} className={`${input} font-mono text-xs leading-relaxed`} />
        <span className="text-xs font-normal leading-relaxed text-muted-foreground">
          Her satıra bir kural: <code className="font-mono">eski =&gt; yeni</code>. Sağ taraf bir link ise, içinde soldaki kelime geçen linkler o linke yönlenir.
          Diğer tüm linkler yukarıdaki ana linke gider.
        </span>
      </label>
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
}: {
  id: number
  linkName: 'link' | 'siteLink'
  link: string
  replacements: string
  footer: string
  footerPlaceholder: string
  action: (state: ActionState, form: FormData) => Promise<ActionState>
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {})
  const ruleCount = replacements.split('\n').filter((l) => l.includes('=>')).length
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
        <SourceTextFields replacements={replacements} footer={footer} footerPlaceholder={footerPlaceholder} />
        <div className="flex items-center gap-3">
          <button
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            Kaydet
          </button>
          {state.message ? (
            <p role="status" className={`text-xs ${state.ok ? 'text-primary' : 'text-destructive'}`}>
              {state.message}
            </p>
          ) : null}
        </div>
      </form>
    </details>
  )
}
