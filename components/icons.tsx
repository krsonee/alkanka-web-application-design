type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function AwardIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="9" r="5.5" />
      <path d="M8.5 13.6 7 21l5-2.6L17 21l-1.5-7.4" />
    </svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3 5 6v5.5c0 4.2 2.9 7.6 7 9.5 4.1-1.9 7-5.3 7-9.5V6z" />
      <path d="m9.2 12 2 2 3.6-3.8" />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

export function LinkIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10.5 13.5a3.6 3.6 0 0 0 5.2 0l2.6-2.7a3.7 3.7 0 0 0-5.2-5.2l-1.3 1.3" />
      <path d="M13.5 10.5a3.6 3.6 0 0 0-5.2 0l-2.6 2.7a3.7 3.7 0 0 0 5.2 5.2l1.3-1.3" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

export function ArrowUpRightIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8 16 16 8" />
      <path d="M9.5 8H16v6.5" />
    </svg>
  );
}

export function ChevronIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function SparkIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 4.5 13.9 10l5.6 2-5.6 2-1.9 5.5L10.1 14l-5.6-2 5.6-2z" />
    </svg>
  );
}
