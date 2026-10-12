import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getAdminPassword, getSessionSecret } from "@/lib/secrets";

export const SESSION_COOKIE = "alkanka_admin";
export const SESSION_MAX_AGE = 60 * 60 * 8;

// Oturum imzası şifreden bağımsız tutulur; böylece çerez sızsa bile
// şifre geri elde edilemez ve anahtar değiştirilince tüm oturumlar düşer.
function sign(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyPassword(candidate: string) {
  return safeEqual(candidate, getAdminPassword());
}

export function createSessionToken() {
  const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `${expiresAt}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined) {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [expiresAt, nonce, signature] = parts;
  if (!safeEqual(signature, sign(`${expiresAt}.${nonce}`))) return false;

  const expiry = Number(expiresAt);
  return Number.isFinite(expiry) && expiry > Date.now();
}

export async function isAuthenticated() {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function requireAuth() {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
  return null;
}
