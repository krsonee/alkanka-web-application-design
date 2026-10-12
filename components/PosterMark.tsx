export type PosterName = "wheel" | "bag" | "check" | "ticket" | "flag" | "dice";

export function PosterMark({ name, className = "" }: { name: PosterName; className?: string }) {
  return (
    <svg viewBox="0 0 240 180" className={className} aria-hidden="true">
      <rect x="8" y="8" width="224" height="164" rx="16" fill="#07090f" stroke="#d4af37" strokeWidth="1.5" />
      {name === "wheel" ? <Wheel /> : null}
      {name === "bag" ? <Bag /> : null}
      {name === "check" ? <Checks /> : null}
      {name === "ticket" ? <Ticket /> : null}
      {name === "flag" ? <Flag /> : null}
      {name === "dice" ? <Dice /> : null}
    </svg>
  );
}

function Wheel() {
  return (
    <>
      <circle cx="120" cy="90" r="58" fill="#121827" stroke="#d4af37" strokeWidth="6" />
      <path d="M120 32 A58 58 0 0 1 170 61 L120 90 Z" fill="#d4af37" />
      <path d="M170 61 A58 58 0 0 1 170 119 L120 90 Z" fill="#1a2338" />
      <path d="M170 119 A58 58 0 0 1 120 148 L120 90 Z" fill="#f2c94c" />
      <path d="M120 148 A58 58 0 0 1 70 119 L120 90 Z" fill="#121827" />
      <path d="M70 119 A58 58 0 0 1 70 61 L120 90 Z" fill="#d4af37" />
      <path d="M70 61 A58 58 0 0 1 120 32 L120 90 Z" fill="#1a2338" />
      <circle cx="120" cy="90" r="14" fill="#07090f" stroke="#f2c94c" strokeWidth="3" />
      <path d="M120 18 l8 14 h-16 z" fill="#f2c94c" />
    </>
  );
}

function Bag() {
  return (
    <>
      <path d="M78 68 h84 l-8 78 H86 z" fill="#121827" stroke="#d4af37" strokeWidth="3" />
      <path d="M96 68 v-8 a24 24 0 0 1 48 0 v8" fill="none" stroke="#f2c94c" strokeWidth="3" />
      <circle cx="108" cy="108" r="14" fill="#d4af37" />
      <circle cx="136" cy="118" r="10" fill="#f2c94c" />
      <path d="M102 108 h12 M108 102 v12" stroke="#07090f" strokeWidth="2" />
    </>
  );
}

function Checks() {
  return (
    <>
      <rect x="58" y="36" width="124" height="108" rx="10" fill="#121827" stroke="#d4af37" strokeWidth="3" />
      <path d="M74 68 h40 M130 62 l8 8 16-18" fill="none" stroke="#f2c94c" strokeWidth="3" strokeLinecap="round" />
      <path d="M74 96 h40 M130 90 l8 8 16-18" fill="none" stroke="#d4af37" strokeWidth="3" strokeLinecap="round" />
      <path d="M74 124 h40 M130 118 l8 8 16-18" fill="none" stroke="#f2c94c" strokeWidth="3" strokeLinecap="round" />
    </>
  );
}

function Ticket() {
  return (
    <>
      <path
        d="M48 58 h144 v18 a12 12 0 0 0 0 24 v18 H48 v-18 a12 12 0 0 0 0-24 z"
        fill="#121827"
        stroke="#d4af37"
        strokeWidth="3"
      />
      <path d="M128 66 v48" stroke="#f2c94c" strokeWidth="2" strokeDasharray="4 5" />
      <text x="78" y="100" fill="#f2c94c" fontSize="28" fontWeight="800" fontFamily="sans-serif">
        07
      </text>
    </>
  );
}

function Flag() {
  return (
    <>
      <rect x="52" y="40" width="136" height="86" rx="8" fill="#121827" stroke="#d4af37" strokeWidth="3" />
      <path d="M68 126 V58 h46 l-8 16 8 16 H68" fill="#d4af37" />
      <path d="M126 58 h46 v32 h-38 l-8-16 8-16 z" fill="#f2c94c" />
      <path d="M68 126 h104" stroke="#d4af37" strokeWidth="3" strokeLinecap="round" />
    </>
  );
}

function Dice() {
  return (
    <>
      <rect x="46" y="48" width="68" height="68" rx="12" fill="#121827" stroke="#d4af37" strokeWidth="3" transform="rotate(-8 80 82)" />
      <circle cx="68" cy="70" r="4" fill="#f2c94c" />
      <circle cx="92" cy="94" r="4" fill="#f2c94c" />
      <rect x="118" y="62" width="72" height="72" rx="12" fill="#d4af37" transform="rotate(8 154 98)" />
      <circle cx="138" cy="86" r="4" fill="#07090f" />
      <circle cx="154" cy="102" r="4" fill="#07090f" />
      <circle cx="170" cy="118" r="4" fill="#07090f" />
      <circle cx="170" cy="86" r="4" fill="#07090f" />
      <circle cx="138" cy="118" r="4" fill="#07090f" />
    </>
  );
}
