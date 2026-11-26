"use client";

import { useRef, useState } from "react";
import { Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAC } from "../points-context";

const CHIP_ROW =
  "grid w-full grid-cols-4 justify-items-center gap-2 px-1 py-1 sm:flex sm:w-auto sm:flex-wrap sm:justify-center";

/**
 * Pick a chip, then press "Bahis al" to stack it onto the bet. The chip stays picked, so pressing
 * again adds another one. "Bahsi tekrarla" puts back the bet the hand opened with; "Temizle" empties it.
 */
export function ChipPot({
  bets,
  current,
  disabled = false,
  onPlace,
}: {
  bets: number[];
  current: number;
  disabled?: boolean;
  onPlace: (bet: number) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [stack, setStack] = useState<number | null>(null);
  // The bet this hand opened with: at a seat that is the one carried over from the hand before.
  const opening = useRef(current).current;
  const max = Math.max(...bets);
  const shown = stack ?? current;
  const full = stack !== null && stack + (picked ?? 0) > max;
  const cleared = stack === 0;

  function addChip() {
    if (picked === null) return;
    const next = Math.min(max, (stack ?? 0) + picked);
    setStack(next);
    onPlace(next);
  }

  function repeat() {
    setStack(null);
    if (current !== opening) onPlace(opening);
  }

  const canRepeat = cleared || current !== opening;

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className={CHIP_ROW} role="radiogroup" aria-label="Çip seç">
        {bets.map((b) => (
          <button
            key={b}
            type="button"
            role="radio"
            aria-checked={picked === b}
            disabled={disabled}
            onClick={() => setPicked(b)}
            className={cn("chip", picked === b && "chip-active")}
          >
            {formatAC(b)}
          </button>
        ))}
      </div>
      <div className="flex w-full max-w-sm flex-col gap-2">
        <p
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-xl border border-primary/50 bg-background/80 px-4 py-2"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {cleared ? "Geçerli bahis" : "Bahsin"}
          </span>
          <span className="text-lg font-bold tabular-nums text-foreground">
            {formatAC(cleared ? current : shown)} KC
          </span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={disabled || picked === null || full}
            onClick={addChip}
            className="flex h-12 touch-manipulation items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-bold uppercase text-primary-foreground shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">
              Bahis al{picked !== null && !full ? ` +${formatAC(picked)}` : ""}
            </span>
          </button>
          <button
            type="button"
            disabled={disabled || !canRepeat}
            onClick={repeat}
            className="flex h-12 touch-manipulation items-center justify-center gap-1.5 rounded-xl border-2 border-primary bg-primary/15 px-3 text-sm font-bold uppercase text-foreground transition hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Bahsi tekrarla</span>
          </button>
        </div>
        <button
          type="button"
          disabled={disabled || cleared}
          onClick={() => setStack(0)}
          className="self-center rounded-lg border border-border px-3 py-1.5 text-xs font-bold uppercase text-muted-foreground transition hover:text-foreground disabled:opacity-40"
        >
          Temizle
        </button>
      </div>
      <p className="text-pretty text-center text-xs leading-relaxed text-muted-foreground">
        {cleared
          ? `Bahis temizlendi. Çip seçip "Bahis al"a bas ya da "Bahsi tekrarla" ile ${formatAC(opening)} KC'ye dön.`
          : full
            ? `En fazla ${formatAC(max)} KC koyabilirsin.`
            : picked === null
              ? 'Önce bir çip seç, sonra "Bahis al"a bas. Her basışta çip eklenir.'
              : `${formatAC(picked)} seçili. "Bahis al"a her basışta bahsine eklenir.`}
      </p>
    </div>
  );
}
