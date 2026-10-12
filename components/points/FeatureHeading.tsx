import { PENDING_COPY } from "@/lib/points-rules";

export function FeatureHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="page-head">
      <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-primary sm:text-4xl">{title}</h1>
      {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}

export function PendingNote() {
  return <p className="text-sm font-semibold leading-relaxed text-[#e8d9a8]">{PENDING_COPY}</p>;
}

export function ClosedNote() {
  return <p className="text-sm font-semibold leading-relaxed text-[#b8c0d4]">Bu bölüm şu an kapalı.</p>;
}

export const disabledBtn =
  "mt-6 rounded-xl gold-gradient px-6 py-3 text-sm font-extrabold uppercase tracking-wider text-black disabled:cursor-not-allowed disabled:opacity-50";
