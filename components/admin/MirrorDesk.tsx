import { TelegramChatSetup } from "@/components/panel/telegram-chat-setup";
import { TelegramMirror } from "@/components/panel/telegram-mirror";
import { SITE_URL } from "@/lib/seo";
import { chatStatus } from "@/lib/telegram-chat";
import { getCronKey, listBots, listLog, listSources, listTargets } from "@/lib/telegram-mirror";

export async function MirrorDesk() {
  const [bots, targets, sources, log, cronKey, status] = await Promise.all([
    listBots().catch(() => []),
    listTargets().catch(() => []),
    listSources().catch(() => []),
    listLog().catch(() => []),
    getCronKey().catch(() => ""),
    chatStatus().catch(() => null),
  ]);
  const cronUrl = cronKey ? `${SITE_URL}/api/cron/telegram?key=${cronKey}` : `${SITE_URL}/api/cron/telegram`;

  return (
    <div className="flex flex-col gap-6">
      <TelegramMirror bots={bots} targets={targets} sources={sources} log={log} cronUrl={cronUrl} />
      <TelegramChatSetup bots={bots} status={status} />
    </div>
  );
}
