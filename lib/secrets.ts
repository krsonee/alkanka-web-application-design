import { createHash } from "crypto";

// Değerler ilk kullanımda okunur: `next build` sırasında modüller yüklenir ama
// gizli değerler derleme ortamında bulunmak zorunda değildir.

const MIN_PASSWORD_LENGTH = 12;
const MIN_SECRET_LENGTH = 32;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} ortam değişkeni tanımlanmalı (.env.example dosyasına bakın)`);
  }
  return value;
}

let adminPassword: string | undefined;
export function getAdminPassword(): string {
  if (adminPassword) return adminPassword;
  const value = required("ADMIN_PASSWORD");
  if (value.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD en az ${MIN_PASSWORD_LENGTH} karakter olmalı`);
  }
  adminPassword = value;
  return value;
}

let sessionSecret: string | undefined;
export function getSessionSecret(): string {
  if (sessionSecret) return sessionSecret;
  const value = required("ADMIN_SESSION_SECRET");
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(`ADMIN_SESSION_SECRET en az ${MIN_SECRET_LENGTH} karakter olmalı`);
  }
  sessionSecret = value;
  return value;
}

let encryptionKey: Buffer | undefined;
/**
 * 64 hex karakterlik değer doğrudan 32 baytlık anahtar olarak kullanılır.
 * Daha uzun rastgele bir metin (ör. Render'ın ürettiği değer) SHA-256 ile
 * 32 bayta indirilir. Aynı kural worker/telegram-forwarder/crypto.mjs'de de var.
 */
export function getTelegramEncryptionKey(): Buffer {
  if (encryptionKey) return encryptionKey;
  const value = required("TELEGRAM_ENCRYPTION_KEY");
  if (/^[0-9a-f]{64}$/i.test(value)) {
    encryptionKey = Buffer.from(value, "hex");
  } else if (value.length >= MIN_SECRET_LENGTH) {
    encryptionKey = createHash("sha256").update(value, "utf8").digest();
  } else {
    throw new Error(
      "TELEGRAM_ENCRYPTION_KEY 64 hex karakter ya da en az 32 karakterlik rastgele bir metin olmalı",
    );
  }
  return encryptionKey;
}
