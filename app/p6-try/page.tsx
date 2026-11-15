'use client'

import { DmPanel } from '@/components/panel/tg-dm-panel'
import { TgHubManager, type TgHubData } from '@/components/panel/tg-hub-manager'
import { TgAccessContext } from '@/components/panel/tg-hub-ui'
import { DEFAULT_HUB, type DmPanelData, type HubConfig, type TicketRow } from '@/lib/tg-hub-shared'

const ago = (min: number) => new Date(Date.UTC(2026, 10, 15, 18, 0) - min * 60_000).toISOString()

const hub: HubConfig = {
  ...DEFAULT_HUB,
  guardBotId: 1,
  supportBotId: 3,
  logChatId: '-1009',
  logChatTitle: 'Kayıt grubu',
  groups: [
    { chatId: '-1001', title: 'Alkanka Sohbet', type: 'supergroup' },
    { chatId: '-1002', title: 'Kanal yorumları', type: 'supergroup' },
  ],
  guard: { ...DEFAULT_HUB.guard, enabled: true, captcha: true, captchaMode: 'emoji' },
  shield: { ...DEFAULT_HUB.shield, quiet: { enabled: true, from: '01:00', to: '08:00', mode: 'text', announce: true } },
  support: {
    ...DEFAULT_HUB.support,
    enabled: true,
    staffChatId: '-1010',
    staffChatTitle: 'Yetkililer',
    sponsors: [{ name: 'BetKanka', chatId: '-1011', title: 'BetKanka Destek' }],
    canned: [
      { title: 'Çekim süresi', text: 'Çekimler en geç 24 saat içinde hesabına geçer. Geçmediyse kullanıcı adını yaz, hemen bakalım.' },
      { title: 'Bonus şartı', text: 'Bonusun tanımlanması için önce Alkanka üzerinden siteye girmiş olman gerekiyor.' },
    ],
    alertMinutes: 30,
  },
  autoReply: {
    ...DEFAULT_HUB.autoReply,
    enabled: true,
    rules: [
      { id: 'bonus01', enabled: true, words: ['bonus', 'freespin'], text: 'Güncel bonuslar sabit mesajda. Butona basarak da görebilirsin.', buttons: [{ text: 'Bonuslar', url: 'https://alkanka.com/bonuslar' }] },
      { id: 'cekim01', enabled: false, words: ['çekim süresi', 'para çekme'], text: 'Çekimler en geç 24 saat içinde yapılır.', buttons: [] },
    ],
    welcome: { enabled: true, text: 'Hoş geldin {isim}! Kurallar sabit mesajda.', buttons: [{ text: 'Kurallar', url: 'https://alkanka.com/kurallar' }], deleteMinutes: 5 },
  },
}

const ticket = (id: number, extra: Partial<TicketRow>): TicketRow => ({
  id,
  name: 'Ali Veli',
  username: 'aliveli',
  sponsor: 'BetKanka',
  category: 'Çekim',
  text: 'Çekimim 3 saattir gelmedi. Kullanıcı adım ali34, tutar 1.500 TL.',
  status: 'open',
  answer: null,
  rating: null,
  createdAt: ago(47),
  closedAt: null,
  claimedBy: null,
  waitMin: 47,
  ...extra,
})

const hubData: TgHubData = {
  hub,
  bots: [
    { id: 1, name: 'Bekçi', username: 'alkanka_bekci_bot', tokenHint: '…a1b2' },
    { id: 3, name: 'Destek', username: 'alkanka_destek_bot', tokenHint: '…c3d4' },
  ],
  stats: { deletedWeek: 41, mutedWeek: 6, bannedWeek: 3, joinsBlockedWeek: 12, openTickets: 3, resolvedWeek: 18, avgResolveMin: 22, globalBans: 4 },
  log: { rows: [], hasMore: false },
  locks: [],
  quiet: [
    { chatId: '-1001', title: 'Alkanka Sohbet', mode: 'text', since: ago(120), stuck: false },
    { chatId: '-1002', title: 'Kanal yorumları', mode: 'lock', since: ago(120), stuck: true },
  ],
  tickets: [
    ticket(104, {}),
    ticket(103, { name: 'Ayşe Kaya', username: null, sponsor: 'Alkanka (genel)', category: 'Hesap', text: 'Telegram hesabımı siteye bağlayamıyorum.', status: 'claimed', claimedBy: 'Mert', waitMin: 12, createdAt: ago(12) }),
    ticket(102, { name: 'Can', text: 'Bonusum tanımlanmadı.', category: 'Bonus', waitMin: 4, createdAt: ago(4) }),
    ticket(101, { name: 'Deniz', status: 'resolved', answer: 'Çekimin hesabına geçti, kontrol edebilirsin.', rating: 5, closedAt: ago(200), createdAt: ago(260), claimedBy: 'Mert', waitMin: 260 }),
    ticket(100, { name: 'Deneme', text: 'deneme 123', status: 'rejected', answer: 'Deneme bileti.', closedAt: ago(900), createdAt: ago(905), waitMin: 905 }),
  ],
  sponsorStats: [{ sponsor: 'BetKanka', total: 14, resolved: 11, rejected: 2, avgMin: 22, rating: 4.6 }],
  leaders: [],
  bans: [],
  trustLow: [],
  guardHook: { ok: true, pending: 0, lastError: null },
  supportHook: { ok: true, pending: 0, lastError: null },
  shareBotId: null,
  shareHook: null,
  linkedMembers: 1284,
}

const dm: DmPanelData = {
  botReady: true,
  testChat: '555000111',
  audiences: { all: 1284, linked7: 37, chat7: 212, site7: 640, away30: 311 },
  broadcasts: [
    { id: 9, text: 'Cumartesi 21:00 büyük çekiliş! Katılmak için siteye gir.', status: 'queued', sent: 0, failed: 0, blocked: 0, total: 1284, createdAt: ago(30), sendAt: ago(-1500), finishedAt: null, audience: 'all', photoPath: null, buttons: [{ text: 'Siteye git', url: 'https://alkanka.com' }], author: 'Batu', note: null },
    { id: 8, text: 'Yeni görevler eklendi, bu hafta ödüller iki kat.', status: 'done', sent: 601, failed: 4, blocked: 35, total: 640, createdAt: ago(3000), sendAt: null, finishedAt: ago(2990), audience: 'site7', photoPath: 'tgposts/afis.jpg', buttons: [], author: 'Batu', note: null },
    { id: 7, text: 'Seni özledik! 30 gündür yoksun, dönüş bonusun hazır.', status: 'cancelled', sent: 50, failed: 0, blocked: 2, total: 311, createdAt: ago(9000), sendAt: null, finishedAt: ago(8999), audience: 'away30', photoPath: null, buttons: [], author: 'Mert', note: 'Görsel okunamadı, duyuru durduruldu: Medya bulunamadı: afis.jpg' },
  ],
}

export default function Page() {
  return (
    <TgAccessContext.Provider value={{ posts: true, mod: true, setup: true, owner: true }}>
      <main className="mx-auto flex max-w-5xl flex-col gap-8 p-4">
        <section aria-label="DM duyuru" className="flex flex-col gap-3">
          <h1 className="text-lg font-semibold">DM duyuru</h1>
          <DmPanel data={dm} />
        </section>
        <section aria-label="Telegram Merkezi" className="flex flex-col gap-3">
          <h1 className="text-lg font-semibold">Telegram Merkezi</h1>
          <TgHubManager data={hubData} />
        </section>
      </main>
    </TgAccessContext.Provider>
  )
}
