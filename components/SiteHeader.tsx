import Link from "next/link";
import { MobileDock, SiteNav } from "@/components/SiteNav";
import { TrackedLink } from "@/components/SiteAnalytics";

export function SiteHeader({
  telegramUrl,
  username,
}: {
  telegramUrl: string;
  username: string | null;
}) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#d4af37]/25 bg-[#07090f]/92 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="AL KANKA" className="h-10 w-auto" />
            <div className="leading-tight max-[420px]:hidden">
              <div className="text-base font-black tracking-widest text-white sm:text-lg">AL KANKA</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] gold-text">
                Bahis Rehberi
              </div>
            </div>
          </Link>
          <SiteNav className="ml-4 hidden items-center gap-1 lg:flex" />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Link href="/puan" className="btn btn-gold btn-sm hidden sm:inline-flex">
              Puan
            </Link>
            {username ? (
              <Link href="/profil" className="btn btn-line btn-sm max-w-[9rem] truncate">
                {username}
              </Link>
            ) : (
              <>
                <Link href="/kayit" className="btn btn-gold btn-sm">
                  Kayıt Ol
                </Link>
                <Link href="/giris" className="btn btn-line btn-sm">
                  Giriş
                </Link>
              </>
            )}
            <TrackedLink
              href={telegramUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              track={{ target: "telegram", label: "Telegram (üst menü)" }}
              className="btn btn-ghost btn-sm max-[380px]:hidden"
            >
              Telegram
            </TrackedLink>
          </div>
        </div>
      </header>
      <MobileDock loggedIn={Boolean(username)} />
    </>
  );
}
