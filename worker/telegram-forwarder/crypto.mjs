import { createDecipheriv, createHash } from "node:crypto";

// src/lib/secrets.ts ve src/lib/telegram-crypto.ts ile birebir aynı kural.
// Worker düz Node ESM olarak çalıştığı için (Next.js'in TS path-alias'larını
// kullanamaz) burada tekrarlanır.
function readKey() {
  const value = process.env.TELEGRAM_ENCRYPTION_KEY?.trim();
  if (!value) {
    throw new Error("TELEGRAM_ENCRYPTION_KEY ortam değişkeni tanımlanmalı (.env.example dosyasına bakın)");
  }
  if (/^[0-9a-f]{64}$/i.test(value)) return Buffer.from(value, "hex");
  if (value.length >= 32) return createHash("sha256").update(value, "utf8").digest();
  throw new Error(
    "TELEGRAM_ENCRYPTION_KEY 64 hex karakter ya da en az 32 karakterlik rastgele bir metin olmalı",
  );
}

const KEY = readKey();

export function decryptSecret(payload) {
  if (!payload) return "";
  const parts = payload.split(":");
  if (parts.length !== 3) return "";

  const [ivHex, authTagHex, dataHex] = parts;
  try {
    const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivHex, "hex"));
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
