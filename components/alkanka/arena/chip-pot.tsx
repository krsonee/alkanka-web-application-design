"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatAC } from "../points-context";

const CHIP_ROW =
  "grid w-full grid-cols-4 justify-items-center gap-2 px-1 py-1 sm:flex sm:w-auto sm:flex-wrap sm:justify-center";

/** Pick a chip first, then tap the pot to place it as this hand's bet. */
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
      <button
        disabled={disabled || picked === null}
        onClick={() => {
          if (picked === null) return;
          onPlace(picked);
          setPicked(null);
        }}
        aria-label={
          picked === null
            ? `Pot, şu anki bahis ${formatAC(current)}`
            : `${formatAC(picked)} bahsi pota koy`
        }
        className={cn(
          "flex size-20 flex-col items-center justify-center rounded-full border-2 border-dashed border-primary/60 bg-primary/10 text-primary transition disabled:cursor-not-allowed",
          picked !== null && "animate-pulse border-solid bg-primary/20",
        )}
      >
        <span className="text-xs font-bold uppercase tracking-wider">Pot</span>
        <span className="text-sm font-bold">{formatAC(current)}</span>
      </button>
      <p className="text-pretty text-center text-xs leading-relaxed text-muted-foreground">
        {picked === null
          ? "Önce bir çip seç, sonra pota bas."
          : `${formatAC(picked)} seçildi. Bahse koymak için pota bas.`}
      </p>
    </div>
  );
}
