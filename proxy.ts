import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp, isSameOriginRequest } from "@/lib/request";

const isDev = process.env.NODE_ENV !== "production";

const BLOCKED_AGENTS =
  /(curl|wget|python-requests|httpie|scrapy|libwww-perl|java\/|go-http-client|axios\/|node-fetch|okhttp|puppeteer|headlesschrome|phantomjs)/i;

function createNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

function contentSecurityPolicy(_nonce: string) {
  // strict-dynamic ignores 'self', and prerendered pages do not stamp the
  // per-request nonce onto <script> tags, so the browser blocks every script
  // and the loader never goes away. Same-origin and inline bootstraps must run.
  const scriptSrc = isDev
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : "'self' 'unsafe-inline'";
  const connectSrc = isDev ? "'self' ws: wss:" : "'self'";

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'self' blob: https://www.youtube.com https://www.youtube-nocookie.com https://player.kick.com https://kick.com",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

function applySecurityHeaders(headers: Headers, csp: string) {
  headers.set("Content-Security-Policy", csp);
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  // Kendi sayfalarımız arasında referans bilgisi kalsın, dışarı hiç gitmesin.
  headers.set("Referrer-Policy", "same-origin");
  headers.set("X-DNS-Prefetch-Control", "off");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  );
  if (!isDev) {
    headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
}

function refererHost(referer: string): string | null {
  try {
    return new URL(referer).host;
  } catch {
    return null;
  }
}

function deny(status: number, message: string, retryAfter?: number) {
  const res = NextResponse.json({ error: message }, { status });
  if (retryAfter) res.headers.set("Retry-After", String(retryAfter));
  return res;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = clientIp(req.headers);
  const agent = req.headers.get("user-agent") ?? "";
  const nonce = createNonce();
  const csp = contentSecurityPolicy(nonce);

  // Eski yönetim adresi kalıcı olarak yeni panele gider. API uçları
  // (/api/admin) yerinde kalır; sayfa dosyası silinmez.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const url = req.nextUrl.clone();
    url.pathname = "/panel";
    return NextResponse.redirect(url, 308);
  }

  // Telegram webhook ve ayna cron'u tarayıcıdan gelmez. Aynı-origin kapısı
  // onları 403 yapmasın; anahtar kontrolü ilgili uçta duruyor.
  const telegramIngress =
    pathname === "/api/telegram/webhook" || pathname === "/api/cron/telegram";
  if (telegramIngress) {
    const result = rateLimit(`${ip}:tg-ingress`, 120, 60_000);
    if (!result.allowed) return deny(429, "Çok fazla istek gönderildi", result.retryAfter);
  }

  // Sağlık kontrolü izleme araçlarına açık kalmalı.
  if (pathname.startsWith("/api/") && pathname !== "/api/health" && !telegramIngress) {
    if (!agent || BLOCKED_AGENTS.test(agent)) {
      return deny(403, "Erişim reddedildi");
    }

    // Veri uçları yalnızca sitenin kendi sayfalarından çağrılabilir.
    if (
      !isSameOriginRequest(req) ||
      req.headers.get("sec-fetch-dest") === "document"
    ) {
      return deny(403, "Erişim reddedildi");
    }

    const isLogin = pathname === "/api/admin/login";
    const isMemberAuth =
      pathname === "/api/uye/giris" || pathname === "/api/uye/kayit";
    const isSiteList = pathname === "/api/sites";
    const isTrack = pathname === "/api/track";
    // Masa odası 1.5 sn'de bir, aktif masa listesi 5 sn'de bir yoklanır.
    // İki oyuncu aynı ağdaysa genel 90/dk kovası dolar, yoklama 429 olur ve
    // tahta kaybolur; hamle karşıya hiç ulaşmamış gibi görünür.
    const isTableRead = req.method === "GET" && pathname.startsWith("/api/tables");
    const limit = isLogin || isMemberAuth
      ? 8
      : pathname.startsWith("/api/admin")
        ? 240
        : isSiteList
          ? 30
          : isTrack
            ? 120
            : isTableRead
              ? 360
              : 90;
    const bucket = isLogin
      ? "login"
      : isMemberAuth
        ? "member-auth"
        : isSiteList
          ? "sites"
          : isTrack
            ? "track"
            : isTableRead
              ? "tables"
              : "api";
    const result = rateLimit(`${ip}:${bucket}`, limit, 60_000);
    if (!result.allowed) {
      return deny(429, "Çok fazla istek gönderildi", result.retryAfter);
    }
  }

  // Yönlendirme ucu affiliate adresini Location başlığında verir. Adres
  // çubuğundan veya betikten sırayla çağrılarak bağlantılar toplanmasın diye
  // yalnızca sitenin kendi sayfalarından gelen tıklamalara izin verilir.
  if (pathname.startsWith("/go/")) {
    if (!agent || BLOCKED_AGENTS.test(agent)) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    const fetchSite = req.headers.get("sec-fetch-site");
    const referer = req.headers.get("referer") ?? "";
    // Referer karşılaştırması yalnızca alan adına bakar. Ters vekil arkasında
    // istek sunucuya http olarak ulaşabildiği için tam origin karşılaştırması
    // (https://... ile http://...) yanlışlıkla eşleşmez ve tıklamalar ana
    // sayfaya geri düşerdi.
    const fromOwnPage = fetchSite
      ? fetchSite === "same-origin"
      : refererHost(referer) === req.nextUrl.host;

    if (!fromOwnPage) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    const result = rateLimit(`${ip}:go`, 40, 60_000);
    if (!result.allowed) {
      return deny(429, "Çok fazla istek gönderildi", result.retryAfter);
    }
  }

  // Sayfaların kendisi de sınırsız çekilemesin. Yalnızca gerçek sayfa
  // yüklemeleri sayılır; varlık ve HMR istekleri bütçeyi tüketmez. Başlığı
  // hiç göndermeyen istemciler de sayılır, çünkü tipik kazıma araçları böyle.
  const dest = req.headers.get("sec-fetch-dest");
  const isAssetPath =
    pathname.startsWith("/_next/") || /\.[a-z0-9]+$/i.test(pathname);

  if (
    !pathname.startsWith("/go/") &&
    !telegramIngress &&
    !isAssetPath &&
    (dest === "document" || dest === null)
  ) {
    const result = rateLimit(`${ip}:page`, 60, 60_000);
    if (!result.allowed) {
      return deny(429, "Çok fazla istek gönderildi", result.retryAfter);
    }
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  applySecurityHeaders(res.headers, csp);
  // YouTube gömme, istekte Referer yoksa oynatıcıyı 153 ile kapatır.
  // Yalnızca bu sayfa origin gönderir; sitenin geri kalanı same-origin kalır.
  if (pathname === "/kankatv") {
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  }

  // Sayfa HTML'i ziyaretçinin IP'sine bağlı liste jetonu taşır. Cloudflare gibi
  // ortak bir önbellek bu yanıtı başka bir ziyaretçiye servis ederse jeton
  // yanlış IP'ye düşer ve site listesi boş kalır. Statik varlıklar bu kuralın
  // dışında; onlar zaten proxy eşleşmesine girmiyor ya da isAssetPath ile eleniyor.
  if (!isAssetPath) {
    res.headers.set("Cache-Control", "private, no-store");
  }

  // First-touch attribution: ?src= or ?utm_source= is kept for 30 days.
  const rawSrc = req.nextUrl.searchParams.get("src") ?? req.nextUrl.searchParams.get("utm_source");
  if (rawSrc && !req.cookies.get("alk_src")) {
    const src = rawSrc.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
    if (src) {
      res.cookies.set("alk_src", src, {
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
        sameSite: "lax",
        secure: true,
        httpOnly: true,
      });
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logos/|uploads/|logo.png).*)"],
};
