import { cookies } from "next/headers";
import Link from "next/link";
import { SiteFrame } from "@/components/SiteFrame";
import {
  linkTelegram,
  readBotToken,
  readTelegramState,
  TG_STATE_COOKIE,
  verifyTelegramLogin,
} from "@/lib/telegram-member";

export const dynamic = "force-dynamic";

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function TelegramReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    const flat = one(value);
    if (flat) params[key] = flat;
  }
  const store = await cookies();
  const state = store.get(TG_STATE_COOKIE)?.value;
  const memberId = readTelegramState(state);
  const token = await readBotToken();
  let message = "Telegram bağlantısı tamamlanamadı.";
  let ok = false;

  if (!token) {
    message = "Telegram henüz bağlanmadı.";
  } else if (!memberId || params.state !== state) {
    message = "Bağlantı isteğinin süresi doldu. Profilden tekrar dene.";
  } else if (!verifyTelegramLogin(params, token)) {
    message = "Telegram doğrulaması geçersiz.";
  } else {
    const linked = await linkTelegram(memberId, params.id, params.username ?? "");
    ok = linked;
    message = linked
      ? "Telegram hesabın bağlandı."
      : "Bu Telegram hesabı başka bir üyeye bağlı.";
  }

  return (
    <SiteFrame>
      <section className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-black">
          <span className="gold-text">Telegram</span>
        </h1>
        <p className={`mt-4 text-sm font-semibold ${ok ? "text-[#f2c94c]" : "text-[#e8d9a8]"}`}>{message}</p>
        <Link href="/profil" className="btn btn-line mt-6">
          Profile dön
        </Link>
      </section>
    </SiteFrame>
  );
}
