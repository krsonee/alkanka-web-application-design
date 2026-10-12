import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCb);
const KEY_LEN = 64;

// Var olmayan üye için de aynı maliyet çalışsın diye sabit, geçersiz bir özet.
const DUMMY_HASH =
  "scrypt$00112233445566778899aabbccddeeff$" + "ab".repeat(KEY_LEN);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, KEY_LEN)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const target = stored && stored.startsWith("scrypt$") ? stored : DUMMY_HASH;
  const [algo, salt, hash] = target.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;

  let derived: Buffer;
  try {
    derived = (await scrypt(password, salt, KEY_LEN)) as Buffer;
  } catch {
    return false;
  }

  const expected = Buffer.from(hash, "hex");
  if (expected.length !== derived.length) return false;
  const match = timingSafeEqual(derived, expected);
  return Boolean(stored) && match;
}
