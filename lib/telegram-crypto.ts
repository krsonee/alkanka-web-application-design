import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { getTelegramEncryptionKey } from "@/lib/secrets";

// api_hash ve Telegram oturum dizesi veritabanında düz metin durmamalı;
// biri veritabanı dökümünü ele geçirirse hesaba tam erişim kazanır.
// Anahtar ADMIN_SESSION_SECRET'ten bağımsız tutulur, böylece biri sızarsa
// diğeri geçersiz kalmaz.
export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getTelegramEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptSecret(payload: string): string {
  if (!payload) return "";
  const parts = payload.split(":");
  if (parts.length !== 3) return "";

  const [ivHex, authTagHex, dataHex] = parts;
  const key = getTelegramEncryptionKey();
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}
