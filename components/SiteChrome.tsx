"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { TrackedLink } from "@/components/SiteAnalytics";
import { LOGO_CHOICES, LOGO_STORAGE_KEY, LogoPicker, logoSrc } from "@/components/LogoPicker";
import { LogoutButton } from "@/components/points/LogoutButton";

const NAV = [
  ["/", "Ana sayfa", "home"],
  ["/siteler", "Siteler", "grid"],
  ["/gorevler", "Görevler", "check"],
  ["/market", "Puan marketi", "bag"],
  ["/cark", "Çark", "wheel"],
  ["/zar", "Zar", "dice"],
  ["/sandik", "Sandık", "chest"],
  ["/biletler", "Biletler", "ticket"],
  ["/tahminler", "Tahminler", "flag"],
  ["/oranlar", "Özel oranlar", "odds"],
  ["/kampanyalar", "Kampanyalar", "megaphone"],
  ["/siralama", "Sıralama", "rank"],
] as const;

function SideIcon({ name }: { name: string }) {
  const props = {
    className: "side-ico",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "home") {
    return (
      <svg {...props}>
        <path d="M4 10.5 12 4l8 6.5V20H4z" />
        <path d="M10 20v-6h4v6" />
      </svg>
    );
  }
  if (name === "grid") {
    return (
      <svg {...props}>
        <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
        <rect x="13.5" y="4" width="6.5" height="6.5" rx="1" />
        <rect x="4" y="13.5" width="6.5" height="6.5" rx="1" />
        <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" />
      </svg>
    );
  }
  if (name === "check") {
    return (
      <svg {...props}>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="m8 12 2.5 2.5L16 9" />
      </svg>
    );
  }
  if (name === "bag") {
    return (
      <svg {...props}>
        <path d="M6 8h12l-1 12H7z" />
        <path d="M9 8V7a3 3 0 0 1 6 0v1" />
      </svg>
    );
  }
  if (name === "wheel") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="1.5" />
        <path d="M12 4v6M12 14v6M4.5 12h6M13.5 12h6" />
      </svg>
    );
  }
  if (name === "dice") {
    return (
      <svg {...props}>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <circle cx="9" cy="9" r="1" fill="currentColor" />
        <circle cx="15" cy="15" r="1" fill="currentColor" />
        <circle cx="15" cy="9" r="1" fill="currentColor" />
        <circle cx="9" cy="15" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (name === "chest") {
    return (
      <svg {...props}>
        <path d="M4 10h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
        <path d="M4 10 6 6h12l2 4" />
        <path d="M12 10v10" />
      </svg>
    );
  }
  if (name === "ticket") {
    return (
      <svg {...props}>
        <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />
      </svg>
    );
  }
  if (name === "flag") {
    return (
      <svg {...props}>
        <path d="M6 4v16" />
        <path d="M6 5h11l-2 3.5L17 12H6" />
      </svg>
    );
  }
  if (name === "odds") {
    return (
      <svg {...props}>
        <path d="M7 17 17 7" />
        <circle cx="8" cy="8" r="1.6" fill="currentColor" />
        <circle cx="16" cy="16" r="1.6" fill="currentColor" />
      </svg>
    );
  }
  if (name === "megaphone") {
    return (
      <svg {...props}>
        <path d="M5 10v4l10 3V7z" />
        <path d="M15 9.5a3.5 3.5 0 0 1 0 5" />
        <path d="M7 14.5 8.5 19" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <path d="M5 7h14M5 12h14M5 17h8" />
    </svg>
  );
}

function itemActive(path: string, href: string) {
  if (href === "/") return path === "/";
  if (href.startsWith("/#")) return false;
  return path === href || path.startsWith(`${href}/`);
}

function SideLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="mt-6 flex flex-col gap-1" aria-label="Bölümler">
      {NAV.map(([href, label, icon]) => {
        const on = itemActive(path, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={on ? "page" : undefined}
            className={on ? "side-link side-link-active" : "side-link"}
          >
            <span className="side-mark" />
            <SideIcon name={icon} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function AccountLinks({ username }: { username: string | null }) {
  if (username) {
    return (
      <>
        <Link href="/hesap" className="btn btn-line btn-sm max-w-[10rem] truncate">
          {username}
        </Link>
        <LogoutButton className="btn btn-gold btn-sm" label="Çıkış" />
      </>
    );
  }
  return (
    <>
      <Link href="/giris" className="btn btn-line btn-sm">
        Giriş
      </Link>
      <Link href="/kayit" className="btn btn-gold btn-sm">
        Kayıt Ol
      </Link>
    </>
  );
}

export function SiteChrome({
  username,
  telegramUrl,
  contactEmail,
  children,
}: {
  username: string | null;
  telegramUrl: string;
  contactEmail: string;
  children: React.ReactNode;
}) {
  const [menu, setMenu] = useState(false);
  const [logoId, setLogoId] = useState("site");
  const path = usePathname();

  useEffect(() => {
    setMenu(false);
  }, [path]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LOGO_STORAGE_KEY);
      if (saved && LOGO_CHOICES.some((item) => item.id === saved)) setLogoId(saved);
    } catch {
      /* depolama kapalıysa site logosu kalır */
    }
  }, []);

  function chooseLogo(id: string) {
    setLogoId(id);
    try {
      window.localStorage.setItem(LOGO_STORAGE_KEY, id);
    } catch {
      /* seçim bu oturumda yine görünür */
    }
  }

  return (
    <>
      <aside className="sidebar">
        <Link href="/" className="flex items-center gap-2.5 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc(logoId)} alt="AL KANKA" className="brand-mark" />
          <span className="text-sm font-black tracking-[0.18em] text-white">AL KANKA</span>
        </Link>
        <LogoPicker value={logoId} onChange={chooseLogo} />
        <SideLinks />
      </aside>

      {menu ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Menüyü kapat"
            onClick={() => setMenu(false)}
          />
          <div className="sidebar sidebar-drawer">
            <div className="flex items-center justify-between px-2">
              <span className="text-sm font-black tracking-[0.18em] text-white">Menü</span>
              <button type="button" className="btn btn-line btn-sm" onClick={() => setMenu(false)}>
                Kapat
              </button>
            </div>
            <LogoPicker value={logoId} onChange={chooseLogo} />
            <SideLinks onNavigate={() => setMenu(false)} />
          </div>
        </div>
      ) : null}

      <div className="shell-main">
        <div className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-[#d4af37]/20 bg-[#07090f]/92 px-3 py-2.5 backdrop-blur-md sm:px-5">
          <button type="button" className="btn btn-ghost btn-sm show-phone shrink-0" onClick={() => setMenu(true)}>
            Menü
          </button>
          <Link href="/" className="flex shrink-0 items-center lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc(logoId)} alt="AL KANKA" className="brand-mark brand-mark-sm" />
          </Link>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <AccountLinks username={username} />
            <TrackedLink
              href={telegramUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              track={{ target: "telegram", label: "Telegram (üst)" }}
              className="btn btn-ghost btn-sm show-wide"
            >
              Telegram
            </TrackedLink>
          </div>
        </div>
        {children}
        <footer className="border-t border-[#d4af37]/20 bg-[#0d1220]">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-10 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc(logoId)} alt="AL KANKA" className="brand-mark" />
            <p className="max-w-2xl text-xs leading-relaxed text-[#7e879c]">
              AL KANKA bir bahis sitesi değildir; yalnızca tanıtım ve yönlendirme yapan bağımsız bir
              rehberdir. 18 yaşından küçüklerin siteyi kullanması yasaktır. Kumar bağımlılık
              yapabilir, sorumlu oyna.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-semibold text-[#b8c0d4]">
              <Link href="/siteler" className="hover:text-[#f2c94c]">Siteler</Link>
              <Link href="/kayit" className="hover:text-[#f2c94c]">Kayıt Ol</Link>
              <Link href="/giris" className="hover:text-[#f2c94c]">Giriş</Link>
              <Link href="/cark" className="hover:text-[#f2c94c]">Çark</Link>
              <Link href="/market" className="hover:text-[#f2c94c]">Market</Link>
              {contactEmail ? (
                <a href={`mailto:${contactEmail}`} className="hover:text-[#f2c94c]">
                  {contactEmail}
                </a>
              ) : null}
            </div>
            <div className="text-[11px] text-[#7e879c]">
              © {new Date().getFullYear()} AL KANKA — Tüm hakları saklıdır.
            </div>
          </div>
        </footer>
      </div>

      <TrackedLink
        href={telegramUrl || "#"}
        target="_blank"
        rel="noopener noreferrer"
        track={{ target: "telegram", label: "Yüzen destek" }}
        className="float-support"
        aria-label="Telegram destek"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12 20 4l-6 16-2.5-6.5z" />
        </svg>
        Destek
      </TrackedLink>

      <nav className="dock lg:hidden" aria-label="Hızlı menü">
        {[
          ["/", "Ana"],
          ["/siteler", "Siteler"],
          ["/cark", "Çark"],
          ["/market", "Market"],
        ].map(([href, label]) => {
          const on = href === "/" ? path === "/" : itemActive(path, href);
          return (
            <Link key={label} href={href} className={on ? "dock-link dock-link-active" : "dock-link"}>
              <span className="dock-mark" />
              {label}
            </Link>
          );
        })}
        {username ? (
          <LogoutButton dock />
        ) : (
          <Link href="/kayit" className={path === "/kayit" ? "dock-link dock-link-active" : "dock-link"}>
            <span className="dock-mark" />
            Kayıt
          </Link>
        )}
      </nav>
    </>
  );
}
