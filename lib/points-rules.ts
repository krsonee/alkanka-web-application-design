export const SIGNUP_REASON = "signup_bonus";
export const DAILY_REASON = "daily_claim";

export const SIGNUP_BONUS_DEFAULT = 500;
export const DAILY_AMOUNT_DEFAULT = 100;
export const PENDING_COPY = "Bu özellik aktif olacak. İçerik kısa sürede eklenecek.";
export const CLOSED_COPY = "Bu bölüm şu an kapalı.";
export const POINTS_AMOUNT_MAX = 1_000_000;
export const ISTANBUL_TZ = "Europe/Istanbul";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!USERNAME_RE.test(value)) return null;
  return value;
}

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

export function normalizeEmail(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (value.length < 6 || value.length > 120) return null;
  if (!EMAIL_RE.test(value)) return null;
  return value;
}

export function passwordIssue(password: string): string | null {
  if (password.length < 8) return "Şifre en az 8 karakter olmalı.";
  if (password.length > 72) return "Şifre en fazla 72 karakter olabilir.";
  return null;
}

export function istanbulDay(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ISTANBUL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  if (!year || !month || !day) return "1970-01-01";
  return `${year}-${month}-${day}`;
}

export function parseSettingAmount(raw: string | undefined, fallback: number): number {
  if (raw == null) return fallback;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return fallback;
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value > POINTS_AMOUNT_MAX) return fallback;
  return value;
}

export function parseNonNegativeAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    if (value < 0 || value > POINTS_AMOUNT_MAX) return null;
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    if (!Number.isSafeInteger(parsed) || parsed > POINTS_AMOUNT_MAX) return null;
    return parsed;
  }
  return null;
}

export function parseSignedAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    if (value === 0 || Math.abs(value) > POINTS_AMOUNT_MAX) return null;
    return value;
  }
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    if (!Number.isSafeInteger(parsed) || parsed === 0 || Math.abs(parsed) > POINTS_AMOUNT_MAX) {
      return null;
    }
    return parsed;
  }
  return null;
}

export function cleanAdjustReason(raw: string): string | null {
  const reason = raw.trim().replace(/\s+/g, " ");
  if (reason.length < 2 || reason.length > 160) return null;
  if (/[\u0000-\u001F]/.test(reason)) return null;
  if (reason === SIGNUP_REASON || reason === DAILY_REASON) return null;
  return reason;
}

export function pointReasonLabel(reason: string): string {
  if (reason === SIGNUP_REASON) return "Kayıt bonusu";
  if (reason === DAILY_REASON) return "Günlük puan";
  return reason;
}

export function formatPoints(amount: number): string {
  return amount.toLocaleString("tr-TR");
}

export function formatPointsWhen(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("tr-TR", {
    timeZone: ISTANBUL_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
