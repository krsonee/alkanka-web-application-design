import { ClosedNote, PendingNote } from "@/components/points/FeatureHeading";

export function EmptyState({
  closed = false,
  action,
}: {
  closed?: boolean;
  action: string;
}) {
  return (
    <div className="panel mt-8 rounded-2xl px-6 py-12 text-center">
      <div className="mx-auto mb-4 h-1 w-16 rounded-full gold-gradient" />
      {closed ? <ClosedNote /> : <PendingNote />}
      <button type="button" disabled className="btn btn-gold mt-6">
        {action}
      </button>
    </div>
  );
}
