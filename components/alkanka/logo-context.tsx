'use client'

import { createContext, useContext } from 'react'
import { cn } from '@/lib/utils'

export type LogoMaps = { sponsors: Record<string, string>; teams: Record<string, string> }

const LogoContext = createContext<LogoMaps>({ sponsors: {}, teams: {} })

export function LogoProvider({ value, children }: { value: LogoMaps; children: React.ReactNode }) {
  return <LogoContext.Provider value={value}>{children}</LogoContext.Provider>
}

export function useLogos() {
  return useContext(LogoContext)
}

export { splitMatch } from '@/lib/split-match'

function initialsOf(name: string) {
  return name
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export function TeamLogo({ name, className }: { name: string; className?: string }) {
  const src = useLogos().teams[name]
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background text-[10px] font-bold text-muted-foreground',
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- logos can come from any https host set in the panel
        <img src={src || '/placeholder.svg'} alt={`${name} logosu`} className="size-full object-contain p-1" />
      ) : (
        <span aria-hidden="true">{initialsOf(name)}</span>
      )}
    </span>
  )
}
