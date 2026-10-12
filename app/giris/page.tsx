import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { SiteFrame } from "@/components/SiteFrame";
import { getCurrentMember } from "@/lib/member-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Giriş Yap",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  if (await getCurrentMember()) redirect("/profil");
  return (
    <SiteFrame>
      <AuthForm mode="giris" />
    </SiteFrame>
  );
}
