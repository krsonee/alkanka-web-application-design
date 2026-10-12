import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountSettings } from "@/components/points/AccountSettings";
import { SiteFrame } from "@/components/SiteFrame";
import { getCurrentMember } from "@/lib/member-auth";
import { getAccount } from "@/lib/points";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hesap",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const member = await getCurrentMember();
  if (!member) redirect("/giris");
  const account = await getAccount(member.id);

  return (
    <SiteFrame>
      <section className="mx-auto max-w-xl px-4 py-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Üye</p>
        <h1 className="mt-1 text-3xl font-black">
          <span className="text-primary">{member.username}</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">E-posta ve şifre bu hesapta durur. Eski üyeler e-postasız kalabilir.</p>
        <AccountSettings email={account?.email ?? ""} />
      </section>
    </SiteFrame>
  );
}
