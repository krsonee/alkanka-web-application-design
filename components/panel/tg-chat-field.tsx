'use client'

import { useState } from 'react'
import type { KnownChat } from '@/lib/tg-hub-shared'
import { input as defaultInput, useKnownChats } from '@/components/panel/tg-hub-ui'

const MANUAL = '__manual'

type FieldProps = Parameters<typeof ChatField>[0]

/** `ChatField` filled with every chat the Telegram section knows, minus the ones named in `exclude`. */
export function KnownChatField({ exclude, ...props }: Omit<FieldProps, 'chats'> & { exclude?: string[] }) {
  const known = useKnownChats()
  return <ChatField {...props} chats={exclude?.length ? known.filter((c) => !exclude.includes(c.chatId)) : known} />
}

/**
 * Picks a group or channel by name from the ones the panel already knows. Typing an @address or a
 * -100… id stays available for a chat that is not on the list yet. Works controlled (`value` and
 * `onChange`) or inside a plain form (`name`, optional `defaultValue`).
 */
export function ChatField({
  label,
  chats,
  value,
  onChange,
  name,
  defaultValue = '',
  placeholder = '@kanaladi ya da -100…',
  required,
  inputClassName = defaultInput,
}: {
  label: string
  chats: KnownChat[]
  value?: string
  onChange?: (value: string) => void
  name?: string
  defaultValue?: string
  placeholder?: string
  required?: boolean
  /** Lets the field take the look of the form it sits in. */
  inputClassName?: string
}) {
  const input = inputClassName
  const [own, setOwn] = useState(defaultValue)
  const current = value ?? own
  const listed = chats.some((c) => c.chatId === current)
  const [manual, setManual] = useState(chats.length === 0 || (current !== '' && !listed))
  const set = (next: string) => {
    setOwn(next)
    onChange?.(next)
  }

  if (chats.length === 0) {
    return <input aria-label={label} name={name} required={required} className={input} placeholder={placeholder} value={current} onChange={(e) => set(e.target.value)} />
  }
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
      <select
        aria-label={label}
        className={input}
        required={required && !manual}
        value={manual ? MANUAL : current}
        onChange={(e) => {
          const next = e.target.value
          setManual(next === MANUAL)
          set(next === MANUAL ? '' : next)
        }}
      >
        <option value="">Listeden seç…</option>
        {chats.map((c) => (
          <option key={c.chatId} value={c.chatId}>
            {c.title}
          </option>
        ))}
        <option value={MANUAL}>Listede yok, elle yaz…</option>
      </select>
      {manual ? (
        <input aria-label={`${label} adresi`} name={name} required={required} className={input} placeholder={placeholder} value={current} onChange={(e) => set(e.target.value)} />
      ) : (
        name && <input type="hidden" name={name} value={current} />
      )}
    </div>
  )
}
