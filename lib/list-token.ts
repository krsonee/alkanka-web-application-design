import { createHmac, timingSafeEqual } from "crypto";
import { getSessionSecret } from "@/lib/secrets";

const TTL_MS = 2 * 60 * 60 * 1000;

function sign(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Liste ucunu sayfayı gerçekten açmış istemcilere kilitler. Token sunucuda
 * üretilip HTML'e gömülür, IP'ye bağlanır ve süresi dolar; böylece uç,
 * doğrudan betikle çağrılıp sayfa sayfa boşaltılamaz.
 */
export function createListToken(ip: string) {
  const expiresAt = Date.now() + TTL_MS;
  return `${expiresAt}.${sign(`${expiresAt}.${ip}`)}`;
}

export function verifyListToken(token: string | null, ip: string) {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [expiresAt, signature] = parts;
  const expiry = Number(expiresAt);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) return false;

  return safeEqual(signature, sign(`${expiresAt}.${ip}`));
}
