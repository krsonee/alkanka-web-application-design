import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { SiteFrame } from "@/components/SiteFrame";
import { getCurrentMember } from "@/lib/member-auth";
import { getPointsConfig } from "@/lib/points";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kayıt Ol",
  robots: { index: false, follow: false },
};

export default async function RegisterPage() {
  if (await getCurrentMember()) redirect("/profil");
  const { signupBonus } = await getPointsConfig();
  return (
    <SiteFrame>
      <AuthForm mode="kayit" signupBonus={signupBonus} />
    </SiteFrame>
  );
}
