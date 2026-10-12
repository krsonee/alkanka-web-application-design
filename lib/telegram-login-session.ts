import type { TelegramClient } from "teleproto";

// Giriş sihirbazı iki ayrı HTTP isteğine yayılıyor (telefon → kod → şifre),
// bu yüzden bekleyen adımın durumu istekler arasında bellekte tutulmalı.
// next start sürekli çalışan tek bir Node süreci olduğu için (sunucusuz değil)
// bu güvenle yapılabilir. Yalnızca tek bir admin olduğundan tek bir bekleyen
// oturum yeterli; globalThis'e konur ki geliştirmede sıcak yeniden yükleme
// (HMR) modülü sıfırlayınca durum kaybolmasın.

export type LoginPhase = "awaiting_code" | "awaiting_password" | "done" | "failed";

export type PendingLogin = {
  client: TelegramClient;
  apiId: number;
  apiHash: string;
  phoneNumber: string;
  phase: LoginPhase;
  resolveCode?: (code: string) => void;
  resolvePassword?: (password: string) => void;
  error?: string;
  lastError?: string;
  accountLabel?: string;
  createdAt: number;
};

const globalForLogin = globalThis as typeof globalThis & {
  __alkankaTelegramPendingLogin?: PendingLogin;
};

const MAX_AGE_MS = 10 * 60 * 1000;

export function getPendingLogin(): PendingLogin | undefined {
  const pending = globalForLogin.__alkankaTelegramPendingLogin;
  if (pending && Date.now() - pending.createdAt > MAX_AGE_MS) {
    void disconnectPending(pending);
    globalForLogin.__alkankaTelegramPendingLogin = undefined;
    return undefined;
  }
  return pending;
}

export function setPendingLogin(pending: PendingLogin) {
  globalForLogin.__alkankaTelegramPendingLogin = pending;
}

export function clearPendingLogin() {
  globalForLogin.__alkankaTelegramPendingLogin = undefined;
}

async function disconnectPending(pending: PendingLogin) {
  try {
    await pending.client.disconnect();
  } catch {
    // Bağlantı zaten kopmuş olabilir, yoksayılır.
  }
}

export async function waitFor(
  predicate: () => boolean,
  timeoutMs: number,
  intervalMs = 150,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return predicate();
}
