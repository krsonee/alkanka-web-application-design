// Hız sınırları ziyaretçi IP'sine göre çalışır, bu yüzden bu değerin
// taklit edilememesi önemlidir.
//
// Sıra bilinçlidir: aşağıdaki başlıkları yalnızca ters vekil sunucu yazabilir.
// Cloudflare, istemcinin gönderdiği cf-connecting-ip değerini kendi bulduğu
// gerçek IP ile ezer. Buna karşılık x-forwarded-for istemci tarafından
// doldurulabilir; Cloudflare gelen değeri silmez, sonuna ekler. Bu yüzden
// x-forwarded-for en sona bırakıldı ve ilk değil son kayıt okunuyor: son kayıt
// zincirdeki en yakın güvenilir vekilin yazdığı değerdir.
//
// ÖNEMLİ: Bu güven yalnızca sunucuya doğrudan erişim kapalıysa geçerlidir.
// Origin IP'si dışarıya açıksa, Cloudflare'ı atlayıp sahte cf-connecting-ip
// gönderen biri her istekte yeni bir sayaca düşer. Sunucu güvenlik duvarı
// yalnızca Cloudflare IP aralıklarına izin vermelidir.
const PROXY_IP_HEADERS = [
  "cf-connecting-ip",
  "true-client-ip",
  "x-vercel-forwarded-for",
  "x-real-ip",
];

export function clientIp(headers: Headers): string {
  for (const name of PROXY_IP_HEADERS) {
    const value = headers.get(name)?.trim();
    if (value) return value;
  }

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const chain = forwarded.split(",");
    const last = chain[chain.length - 1]?.trim();
    if (last) return last;
  }

  return "127.0.0.1";
}

// Tarayıcı bu başlıkları kendisi üretir ve sayfa içi JavaScript ile
// değiştirilemez; basit kazıma denemelerini ve adres çubuğundan doğrudan
// erişimi eler. Sunucu tarafı istemciler yine de taklit edebilir.
export function isSameOriginRequest(req: {
  headers: Headers;
  nextUrl: URL;
}): boolean {
  if (req.headers.get("sec-fetch-mode") === "navigate") return false;

  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin";

  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  if (!origin) return false;

  try {
    return new URL(origin).host === req.nextUrl.host;
  } catch {
    return false;
  }
}
