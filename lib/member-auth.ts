import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { pool } from "@/db";
import { getSessionSecret } from "@/lib/secrets";

export const MEMBER_COOKIE = "alkanka_member";
export const MEMBER_MAX_AGE = 60 * 60 * 24 * 30;

export type MemberSession = {
  id: number;
  username: string;
};

function sign(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(`member.${payload}`).digest("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function createMemberSessionToken(memberId: number) {
  const expiresAt = Date.now() + MEMBER_MAX_AGE * 1000;
  const payload = `${memberId}.${expiresAt}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${sign(payload)}`;
}

export function readMemberId(token: string | undefined): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [idRaw, expiresAt, nonce, signature] = parts;
  if (!safeEqual(signature, sign(`${idRaw}.${expiresAt}.${nonce}`))) return null;
  const expiry = Number(expiresAt);
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (!Number.isFinite(expiry) || expiry <= Date.now()) return null;
  return id;
}

export function memberCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    path: "/",
    maxAge: MEMBER_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function getCurrentMember(): Promise<MemberSession | null> {
  const store = await cookies();
  const id = readMemberId(store.get(MEMBER_COOKIE)?.value);
  if (!id) return null;

  const { rows } = await pool.query<{ id: number; username: string }>(
    "SELECT id, username FROM members WHERE id = $1 AND closed_at IS NULL",
    [id],
  );
  return rows[0] ?? null;
}
