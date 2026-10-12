"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/", "Siteler"],
  ["/puan", "Puan"],
  ["/gorevler", "Görevler"],
  ["/market", "Market"],
  ["/cark", "Çark"],
  ["/tahminler", "Tahmin"],
  ["/siralama", "Sıralama"],
] as const;

function active(path: string, href: string) {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

export function SiteNav({ className }: { className?: string }) {
  const path = usePathname();
  return (
    <nav className={className} aria-label="Ana menü">
      {LINKS.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className={active(path, href) ? "nav-link nav-link-active" : "nav-link"}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

const DOCK_IN = [
  ["/", "Ana"],
  ["/puan", "Puan"],
  ["/gorevler", "Görev"],
  ["/market", "Market"],
  ["/profil", "Hesap"],
] as const;

const DOCK_OUT = [
  ["/", "Ana"],
  ["/puan", "Puan"],
  ["/gorevler", "Görev"],
  ["/giris", "Giriş"],
  ["/kayit", "Kayıt Ol"],
] as const;

export function MobileDock({ loggedIn }: { loggedIn: boolean }) {
  const path = usePathname();
  const items = loggedIn ? DOCK_IN : DOCK_OUT;
  return (
    <nav className="dock lg:hidden" aria-label="Hızlı menü">
      {items.map(([href, label]) => {
        const on =
          href === "/profil"
            ? path === "/profil" || path === "/cuzdan"
            : href === "/giris"
              ? path === "/giris"
              : href === "/kayit"
                ? path === "/kayit"
                : active(path, href);
        return (
          <Link key={href} href={href} className={on ? "dock-link dock-link-active" : "dock-link"}>
            <span className="dock-mark" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
