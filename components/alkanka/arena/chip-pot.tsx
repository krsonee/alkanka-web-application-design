"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatAC } from "../points-context";

const CHIP_ROW =
  "grid w-full grid-cols-4 justify-items-center gap-2 px-1 py-1 sm:flex sm:w-auto sm:flex-wrap sm:justify-center";

/**
 * Pick a chip, then tap the pot to stack it onto the bet. The chip stays picked, so
 * tapping the pot again adds another one. "Temizle" empties the pot to start over.
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
  const max = Math.max(...bets);
  const shown = stack ?? current;
  const full = stack !== null && stack + (picked ?? 0) > max;

  function addChip() {
    if (picked === null) return;
    const next = Math.min(max, (stack ?? 0) + picked);
    setStack(next);
    onPlace(next);
  }

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className={CHIP_ROW} role="radiogroup" aria-label="Çip seç">
        {bets.map((b) => (
          <button
            key={b}
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
      <div className="flex items-center gap-3">
        <button
          disabled={disabled || picked === null || full}
          onClick={addChip}
          aria-label={
            picked === null
              ? `Pot, şu anki bahis ${formatAC(shown)}`
              : `${formatAC(picked)} çipi pota ekle, pot ${formatAC(shown)}`
          }
          className={cn(
            "flex size-20 flex-col items-center justify-center rounded-full border-2 border-dashed border-primary/60 bg-primary/10 text-primary transition disabled:cursor-not-allowed",
            picked !== null && !full && "animate-pulse border-solid bg-primary/20",
          )}
        >
          <span className="text-xs font-bold uppercase tracking-wider">Pot</span>
          <span className="text-sm font-bold tabular-nums">{formatAC(shown)}</span>
        </button>
        <button
          disabled={disabled || stack === 0}
          onClick={() => setStack(0)}
          className="rounded-lg border border-border px-3 py-2 text-xs font-bold uppercase text-muted-foreground transition hover:text-foreground disabled:opacity-40"
        >
          Temizle
        </button>
      </div>
      <p className="text-pretty text-center text-xs leading-relaxed text-muted-foreground">
        {stack === 0
          ? `Pot boş. Çip seçip pota bas, şu an ${formatAC(current)} geçerli.`
          : full
            ? `En fazla ${formatAC(max)} koyabilirsin.`
            : picked === null
              ? "Önce bir çip seç, sonra pota bas. Her basışta çip eklenir."
              : `${formatAC(picked)} seçili. Her basışta pota eklenir.`}
      </p>
    </div>
  );
}
