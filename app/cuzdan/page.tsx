import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFrame } from "@/components/SiteFrame";
import { FeatureHeading } from "@/components/points/FeatureHeading";
import { getCurrentMember } from "@/lib/member-auth";
import { getBalance, listLedgerPage } from "@/lib/points";
import { formatPoints, formatPointsWhen, pointReasonLabel } from "@/lib/points-rules";

export const dynamic = "force-dynamic";

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ sayfa?: string }>;
}) {
  const member = await getCurrentMember();
  if (!member) redirect("/giris");
  const query = await searchParams;
  const page = Number(query.sayfa ?? "1");
  const [balance, ledger] = await Promise.all([getBalance(member.id), listLedgerPage(member.id, page)]);

  return (
    <SiteFrame>
      <section className="mx-auto max-w-3xl px-4 py-12">
        <FeatureHeading title="Cüzdan" subtitle={member.username} />
        <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Bakiye</div>
          <div className="mt-2 font-display text-5xl font-bold text-primary">{formatPoints(balance)}</div>
        </div>
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
          {ledger.rows.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto mb-4 h-1 w-16 rounded-full gold-gradient" />
              <p className="text-sm font-semibold text-foreground">Henüz puan hareketi yok.</p>
            </div>
          ) : (
            <ul>
              {ledger.rows.map((row, index) => (
                <li
                  key={`${row.createdAt}-${index}`}
                  className="flex items-center justify-between gap-4 border-b border-[#d4af37]/10 px-5 py-3 last:border-b-0"
                >
                  <div>
                    <div className="text-sm font-semibold">{pointReasonLabel(row.reason)}</div>
                    <div className="text-[11px] text-muted-foreground">{formatPointsWhen(row.createdAt)}</div>
                  </div>
                  <div className={`text-sm font-black ${row.amount > 0 ? "text-primary" : "text-destructive"}`}>
                    {row.amount > 0 ? "+" : ""}
                    {formatPoints(row.amount)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-4 flex justify-center gap-4 text-sm font-bold text-primary">
          {ledger.page > 1 ? (
            <Link href={`/cuzdan?sayfa=${ledger.page - 1}`} className="btn btn-line btn-sm">
              Önceki
            </Link>
          ) : null}
          <span className="text-muted-foreground">
            {ledger.page} / {ledger.pages}
          </span>
          {ledger.page < ledger.pages ? (
            <Link href={`/cuzdan?sayfa=${ledger.page + 1}`} className="btn btn-line btn-sm">
              Sonraki
            </Link>
          ) : null}
        </div>
      </section>
    </SiteFrame>
  );
}
