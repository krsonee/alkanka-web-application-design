'use client'

import { Plus, X } from 'lucide-react'
import { GOAL_MAX_RULES, GOAL_RULE_KINDS, goalRuleText, isGoalRuleKind, type GoalRule, type GoalRuleMode } from '@/lib/goal-rewards-shared'
import { TASK_GAMES } from '@/lib/task-kinds'
import { cn } from '@/lib/utils'

const field = 'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground'
const hint = 'text-xs font-normal leading-relaxed text-muted-foreground'
const ghost = 'h-9 rounded-lg border border-border px-3 text-xs font-bold text-foreground hover:bg-secondary disabled:opacity-40'

const PRESETS: { label: string; rule: GoalRule }[] = [
  { label: 'Herhangi bir oyunda 30 dakika', rule: { kind: 'minutes', game: '', amount: 30 } },
  { label: 'Herhangi bir oyunda 1 saat', rule: { kind: 'minutes', game: '', amount: 60 } },
  { label: 'Herhangi bir oyunda 3 maç', rule: { kind: 'play', game: '', amount: 3 } },
  { label: 'Herhangi bir oyunda 1 galibiyet', rule: { kind: 'win', game: '', amount: 1 } },
]

const kindOf = (id: GoalRule['kind']) => GOAL_RULE_KINDS.find((k) => k.id === id) ?? GOAL_RULE_KINDS[0]
const same = (a: GoalRule, b: GoalRule) => a.kind === b.kind && a.game === b.game

/**
 * What a member has to do on the match day before an Alkanka event pays its reward.
 * Staff picks from what the site can actually count: matches played, matches won, minutes spent in a game.
 */
export function GoalRulesEditor({ rules, mode, onChange }: { rules: GoalRule[]; mode: GoalRuleMode; onChange: (rules: GoalRule[], mode: GoalRuleMode) => void }) {
  const full = rules.length >= GOAL_MAX_RULES
  const set = (index: number, patch: Partial<GoalRule>) => onChange(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)), mode)
  const add = (rule: GoalRule) => !full && !rules.some((r) => same(r, rule)) && onChange([...rules, rule], mode)
  const duplicate = (index: number) => rules.some((r, i) => i !== index && same(r, rules[index]))

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <legend className="px-1 text-xs font-bold text-foreground">Ödül şartı (isteğe bağlı)</legend>
      <p className={hint}>
        Şart eklersen üye ödülü ancak maçın oynandığı gün (Türkiye saatiyle 00:00 - 23:59) şartı tamamlarsa alır; tamamlayınca ödül kendiliğinden yatar, gün biterse verilmez. Şart eklemezsen ödül maç sonuçlanınca hemen yatar.
      </p>

      {rules.map((r, i) => {
        const kind = kindOf(r.kind)
        const bad = !Number.isInteger(r.amount) || r.amount < kind.min || r.amount > kind.max
        return (
          <div key={i} className="flex flex-col gap-2 rounded-lg bg-secondary/50 p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_6rem_auto]">
              <label className="flex flex-col gap-1 text-xs font-semibold text-foreground">
                Ne yapmalı
                <select value={r.kind} onChange={(e) => isGoalRuleKind(e.target.value) && set(i, { kind: e.target.value, amount: kindOf(e.target.value).id === 'minutes' ? 30 : 1 })} className={field}>
                  {GOAL_RULE_KINDS.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-foreground">
                Hangi oyunda
                <select value={r.game} onChange={(e) => set(i, { game: e.target.value })} className={field}>
                  <option value="">Herhangi bir oyun</option>
                  {TASK_GAMES.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-foreground">
                <span className="capitalize">{kind.unit}</span>
                <input
                  inputMode="numeric"
                  value={r.amount === 0 ? '' : String(r.amount)}
                  aria-invalid={bad}
                  onChange={(e) => set(i, { amount: Number(e.target.value.replace(/\D/g, '').slice(0, 3)) })}
                  className={cn(field, bad && 'border-destructive')}
                />
              </label>
              <button type="button" onClick={() => onChange(rules.filter((_, at) => at !== i), mode)} aria-label={`${i + 1}. şartı kaldır`} className={cn(ghost, 'flex h-10 items-center justify-center self-end px-2.5')}>
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <p className={hint}>
              {kind.hint} Aralık: {kind.min} - {kind.max} {kind.unit}.
            </p>
            {duplicate(i) ? (
              <p role="alert" className="text-xs font-medium text-destructive">
                Bu şart zaten eklenmiş. Oyunu ya da türünü değiştir.
              </p>
            ) : (
              !bad && <p className="text-xs font-semibold text-foreground">Üye şunu görür: {goalRuleText(r)}.</p>
            )}
          </div>
        )
      })}

      {rules.length > 1 && (
        <div role="radiogroup" aria-label="Şartlar nasıl sayılır" className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ['all', 'Hepsi tamamlanmalı', 'Üye şartların tümünü yapar.'],
              ['any', 'Biri yeterli', 'Şartlardan herhangi birini yapması yeter.'],
            ] as const
          ).map(([id, title, text]) => (
            <button key={id} type="button" role="radio" aria-checked={mode === id} onClick={() => onChange(rules, id)} className={cn('flex flex-col gap-0.5 rounded-lg border p-2.5 text-left', mode === id ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary')}>
              <span className="text-xs font-bold text-foreground">{title}</span>
              <span className={hint}>{text}</span>
            </button>
          ))}
        </div>
      )}

      {full ? (
        <p className={hint}>En fazla {GOAL_MAX_RULES} şart eklenebilir.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => add({ kind: 'play', game: rules.some((r) => r.kind === 'play' && r.game === '') ? 'tavla' : '', amount: 1 })} className={cn(ghost, 'flex items-center gap-1.5')}>
            <Plus className="size-3.5" aria-hidden="true" /> Şart ekle
          </button>
          {PRESETS.filter((p) => !rules.some((r) => same(r, p.rule))).map((p) => (
            <button key={p.label} type="button" onClick={() => add(p.rule)} className="h-9 rounded-full border border-dashed border-border px-3 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary">
              + {p.label}
            </button>
          ))}
        </div>
      )}
    </fieldset>
  )
}
