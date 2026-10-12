import {
  BONUSES,
  CAMPAIGNS,
  EVENTS,
  FAQ,
  LEADERBOARD,
  LIVE_WINS,
  MARKET_ITEMS,
  PREDICTIONS,
  QUICK_TILES,
  SLIDES,
  SPECIAL_ODDS,
  SPONSORS,
  TASKS,
  TICKER_EVENTS,
  type Bonus,
  type Campaign,
  type EventItem,
  type MarketItem,
  type Prediction,
  type QuickTile,
  type Slide,
  type SpecialOdd,
  type Sponsor,
  type SponsorTier,
  type TickerEvent,
} from "@/components/alkanka/data";

export const DESIGN_CONTENT_KEY = "design_content";

export const IMAGE_LIBRARY = [
  "/images/banner-wheel.png",
  "/images/banner-events.png",
  "/images/banner-telegram.png",
  "/images/collab/alkanka-makrobet-slider.png",
  "/images/collab/alkanka-makrobet-telegram.png",
  "/images/collab/alkanka-makrobet-popup.png",
  "/images/hero-chest.png",
  "/images/tile-wheel.png",
  "/images/tile-market.png",
  "/images/tile-tasks.png",
  "/images/tile-dice.png",
  "/images/tile-chest.png",
  "/images/tile-predict.png",
  "/images/heroes/sponsorlar.png",
  "/images/heroes/bonuslar.png",
  "/images/heroes/kampanyalar.png",
  "/images/heroes/ozel-oranlar.png",
  "/images/heroes/biletler.png",
  "/images/heroes/market.png",
  "/images/heroes/gorevler.png",
  "/images/heroes/tahminler.png",
  "/images/heroes/siralama.png",
  "/images/heroes/sss.png",
  "/images/heroes/oyunlar.png",
  "/images/heroes/turnuvalar.png",
  "/images/heroes/uygulama.png",
  "/images/games/tavla.png",
  "/images/games/okey.png",
  "/images/games/bilardo.png",
  "/images/games/blackjack.png",
  "/images/games/rulet.png",
  "/images/games/kafa-topu.png",
  "/images/games/kafa-basketbolu.png",
  "/images/mascots/jako.png",
  "/images/mascots/jako-merhaba.png",
  "/images/mascots/jako-duyuru.png",
  "/images/mascots/jako-kazandi.png",
  "/images/mascots/jako-market.png",
  "/images/mascots/jako-sandik.png",
  "/images/mascots/jako-zar.png",
  "/images/mascots/jako-telegram.png",
] as const;

const TASK_ICONS: Record<string, string> = {
  telegram: "send",
  "site-ziyareti": "eye",
  "arkadas-davet": "user-plus",
  "hesap-dogrula": "shield",
};

export const TASK_ICON_OPTIONS = [
  { value: "send", label: "Telegram" },
  { value: "eye", label: "Ziyaret" },
  { value: "user-plus", label: "Davet" },
  { value: "shield", label: "Doğrulama" },
  { value: "gift", label: "Hediye" },
  { value: "ticket", label: "Bilet" },
  { value: "megaphone", label: "Duyuru" },
  { value: "star", label: "Yıldız" },
  { value: "percent", label: "Bonus" },
] as const;

export type PublicSponsor = Sponsor & { url: string; logo: string };

export type DesignTask = {
  id: string;
  icon: string;
  title: string;
  detail: string;
  reward: number;
  href: string;
  description: string;
  steps: string[];
  rules: string[];
  verification: string;
};

export type DesignFaq = { id: string; group: string; question: string; answer: string };

export type DesignHero = {
  id: string;
  path: string;
  image: string;
  eyebrow: string;
  title: string;
  description: string;
};

export type DesignTeam = { name: string; logo: string };

export type DesignWin = { id: string; game: string; user: string; time: string; reward: string };

export type DesignLeader = { rank: number; name: string; points: number; streak: number };

export type DesignContent = {
  slides: Slide[];
  tiles: QuickTile[];
  ticker: TickerEvent[];
  sponsors: PublicSponsor[];
  bonuses: Bonus[];
  campaigns: Campaign[];
  odds: SpecialOdd[];
  tasks: DesignTask[];
  market: MarketItem[];
  events: EventItem[];
  predictions: Prediction[];
  leaderboard: DesignLeader[];
  wins: DesignWin[];
  faqs: DesignFaq[];
  heroes: DesignHero[];
  teams: DesignTeam[];
};

const HERO_SEED: DesignHero[] = [
  {
    id: "sponsorlar",
    path: "/sponsorlar",
    image: "/images/heroes/sponsorlar.png",
    eyebrow: "Sponsorlar",
    title: "Güvenilir sponsorlar",
    description:
      "Lisans, ödeme hızı ve destek kalitesi her gün kontrol edilir. Sadece AL KANKA linkiyle gelenlere özel bonuslar.",
  },
  {
    id: "bonuslar",
    path: "/bonuslar",
    image: "/images/heroes/bonuslar.png",
    eyebrow: "Bonuslar",
    title: "Bonus kodları",
    description: "Kodu kopyala, kayıt olurken yapıştır. Bonuslar sadece AL KANKA linkiyle gelenlere tanımlanır.",
  },
  {
    id: "kampanyalar",
    path: "/kampanyalar",
    image: "/images/heroes/kampanyalar.png",
    eyebrow: "Kampanyalar",
    title: "Kampanyalar",
    description: "Turnuvalar, iadeler, freespin yağmurları ve çekilişler.",
  },
  {
    id: "ozel-oranlar",
    path: "/ozel-oranlar",
    image: "/images/heroes/ozel-oranlar.png",
    eyebrow: "Özel oranlar",
    title: "Artırılmış oranlar",
    description: "Sponsorların sadece AL KANKA üyelerine açtığı yükseltilmiş oranlar.",
  },
  {
    id: "biletler",
    path: "/biletler",
    image: "/images/heroes/biletler.png",
    eyebrow: "Biletler",
    title: "Bilet çekilişleri",
    description: "Haftalık bilet çekilişi ve günlük turnuvalar.",
  },
  {
    id: "market",
    path: "/market",
    image: "/images/heroes/market.png",
    eyebrow: "Market",
    title: "Puan marketi",
    description: "Rozet, ekstra hak ve hediyelik. Nakit yok. Topladığın Kanka Coin ile dilediğini al.",
  },
  {
    id: "gorevler",
    path: "/gorevler",
    image: "/images/heroes/gorevler.png",
    eyebrow: "Görevler",
    title: "Günlük görevler",
    description: "Her gün giriş yap, seriyi koru. Görevler ekstra Kanka Coin kazandırır.",
  },
  {
    id: "tahminler",
    path: "/tahminler",
    image: "/images/heroes/tahminler.png",
    eyebrow: "Tahminler",
    title: "Maç tahminleri",
    description: "Skoru bil, Kanka Coin kazan. Tahminler maç başlamadan kapanır.",
  },
  {
    id: "siralama",
    path: "/siralama",
    image: "/images/heroes/siralama.png",
    eyebrow: "Sıralama",
    title: "Haftalık liderler",
    description: "Her pazartesi sıfırlanır. İlk 3 VIP sandık kazanır.",
  },
  {
    id: "sss",
    path: "/sss",
    image: "/images/heroes/sss.png",
    eyebrow: "Yardım",
    title: "Sıkça sorulan sorular",
    description: "Kanka Coin, market, Telegram ve hesap güvenliği hakkında en çok sorulanlar.",
  },
  {
    id: "oyunlar",
    path: "/oyunlar",
    image: "/images/heroes/oyunlar.png",
    eyebrow: "Oyunlar",
    title: "Çark · Zar · Sandık",
    description: "Tamamen ücretsiz mini oyunlar. Kazandığın puan bakiyene eklenir ve markette harcanır.",
  },
  {
    id: "turnuvalar",
    path: "/turnuvalar",
    image: "/images/heroes/turnuvalar.png",
    eyebrow: "Turnuvalar",
    title: "Kanka turnuvaları",
    description: "Tavla, okey ve bilardo turnuvalarına kaydol. Eşleşmeler canlı güncellenir, şampiyon ödül havuzunu alır.",
  },
];

function str(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function num(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function lines(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => str(item)).filter(Boolean);
  if (typeof value === "string") return value.split("\n").map((item) => item.trim()).filter(Boolean);
  return [];
}

function slug(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function tier(value: unknown): SponsorTier {
  return value === "ana" || value === "vip" || value === "guvenilir" ? value : "guvenilir";
}

const BONUS_TYPES = ["Hoş geldin", "Yatırım", "Kayıp", "Freespin", "Deneme"] as const;
const MARKET_TYPES = ["ROZET", "EKSTRA HAK", "HEDİYE", "VIP"] as const;
const EVENT_KINDS = ["Haftalık", "Günlük", "Aylık"] as const;
const TICKER_KINDS = ["telegram", "claim", "drop"] as const;

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function defaultDesignContent(): DesignContent {
  return {
    slides: SLIDES.map((item) => ({ ...item })),
    tiles: QUICK_TILES.map((item) => ({ ...item })),
    ticker: TICKER_EVENTS.map((item) => ({ ...item })),
    sponsors: SPONSORS.map((item) => ({ ...item, perks: [...item.perks], url: "", logo: "" })),
    bonuses: BONUSES.map((item) => ({ ...item })),
    campaigns: CAMPAIGNS.map((item) => ({ ...item })),
    odds: SPECIAL_ODDS.map((item) => ({ ...item })),
    tasks: TASKS.map((item) => ({
      id: item.id,
      icon: TASK_ICONS[item.id] ?? "gift",
      title: item.title,
      detail: item.detail,
      reward: item.reward,
      href: item.href ?? "",
      description: item.description,
      steps: [...item.steps],
      rules: [...item.rules],
      verification: item.verification,
    })),
    market: MARKET_ITEMS.map((item) => ({ ...item, rules: [...item.rules] })),
    events: EVENTS.map((item) => ({
      ...item,
      steps: [...item.steps],
      rules: [...item.rules],
      prizes: item.prizes.map((prize) => ({ ...prize })),
    })),
    predictions: PREDICTIONS.map((item) => ({
      ...item,
      options: item.options.map((option) => ({ ...option })),
    })),
    leaderboard: LEADERBOARD.map((item) => ({ ...item })),
    wins: LIVE_WINS.map((item) => ({ ...item })),
    faqs: FAQ.flatMap((group) =>
      group.items.map((item, index) => ({
        id: `${group.id}-${index + 1}`,
        group: group.label,
        question: item.q,
        answer: item.a,
      })),
    ),
    heroes: HERO_SEED.map((item) => ({ ...item })),
    teams: [],
  };
}

function takeList<T>(raw: unknown, fallback: T[], map: (item: unknown, index: number) => T | null): T[] {
  if (!Array.isArray(raw)) return fallback;
  return raw.map(map).filter((item): item is T => item !== null);
}

export function parseDesignContent(raw: string | undefined | null): DesignContent {
  const base = defaultDesignContent();
  if (!raw) return base;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return base;
  }
  const root = asRecord(parsed);
  if (!root) return base;

  return {
    slides: takeList(root.slides, base.slides, (item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      const title = str(row.title);
      if (!title) return null;
      return {
        id: str(row.id) || `slide-${index + 1}`,
        eyebrow: str(row.eyebrow),
        title,
        description: str(row.description),
        cta: str(row.cta) || "İncele",
        href: str(row.href) || "/",
        image: str(row.image) || "/images/banner-wheel.png",
      };
    }),
    tiles: takeList(root.tiles, base.tiles, (item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      const label = str(row.label);
      if (!label) return null;
      return {
        id: str(row.id) || `tile-${index + 1}`,
        label,
        cta: str(row.cta) || "Aç",
        href: str(row.href) || "/",
        image: str(row.image) || "/images/tile-wheel.png",
      };
    }),
    ticker: takeList(root.ticker, base.ticker, (item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      const text = str(row.text);
      if (!text) return null;
      const kind = TICKER_KINDS.includes(row.kind as (typeof TICKER_KINDS)[number])
        ? (row.kind as TickerEvent["kind"])
        : "claim";
      return { id: str(row.id) || `tick-${index + 1}`, kind, text, time: str(row.time) || "az önce" };
    }),
    sponsors: takeList(root.sponsors, base.sponsors, (item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      const name = str(row.name);
      if (!name) return null;
      return {
        id: str(row.id) || slug(name) || `sponsor-${index + 1}`,
        name,
        initials: str(row.initials) || name.slice(0, 2).toUpperCase(),
        tier: tier(row.tier),
        tagline: str(row.tagline),
        welcome: str(row.welcome),
        perks: lines(row.perks),
        rating: Math.min(5, Math.max(0, num(row.rating, 4.5))),
        payout: str(row.payout) || "—",
        url: str(row.url),
        logo: str(row.logo),
      };
    }),
    bonuses: takeList(root.bonuses, base.bonuses, (item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      const title = str(row.title);
      if (!title) return null;
      const type = BONUS_TYPES.includes(row.type as (typeof BONUS_TYPES)[number])
        ? (row.type as Bonus["type"])
        : "Yatırım";
      const code = str(row.code);
      return {
        id: str(row.id) || `bonus-${index + 1}`,
        sponsorId: str(row.sponsorId),
        type,
        title,
        amount: str(row.amount),
        wager: str(row.wager),
        ...(code ? { code } : {}),
      };
    }),
    campaigns: takeList(root.campaigns, base.campaigns, (item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      const title = str(row.title);
      if (!title) return null;
      return {
        id: str(row.id) || `campaign-${index + 1}`,
        sponsorId: str(row.sponsorId),
        title,
        description: str(row.description),
        ends: str(row.ends) || "Süreli",
        image: str(row.image) || "/images/banner-events.png",
        tag: str(row.tag) || "Genel",
        hoursLeft: Math.max(0, num(row.hoursLeft, 24)),
      };
    }),
    odds: takeList(root.odds, base.odds, (item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      const match = str(row.match);
      if (!match) return null;
      return {
        id: str(row.id) || `odd-${index + 1}`,
        sponsorId: str(row.sponsorId),
        league: str(row.league) || "Lig",
        match,
        market: str(row.market) || "Maç sonucu",
        oldOdd: num(row.oldOdd, 1.5),
        newOdd: num(row.newOdd, 2),
        kickoff: str(row.kickoff),
        limit: str(row.limit),
      };
    }),
    tasks: takeList(root.tasks, base.tasks, (item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      const title = str(row.title);
      if (!title) return null;
      const icon = str(row.icon) || "gift";
      return {
        id: str(row.id) || `task-${index + 1}`,
        icon,
        title,
        detail: str(row.detail),
        reward: Math.max(0, Math.round(num(row.reward))),
        href: str(row.href),
        description: str(row.description),
        steps: lines(row.steps),
        rules: lines(row.rules),
        verification: str(row.verification),
      };
    }),
    market: takeList(root.market, base.market, (item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      const name = str(row.name);
      if (!name) return null;
      const type = MARKET_TYPES.includes(row.type as (typeof MARKET_TYPES)[number])
        ? (row.type as MarketItem["type"])
        : "HEDİYE";
      return {
        id: str(row.id) || slug(name) || `market-${index + 1}`,
        name,
        type,
        price: Math.max(0, Math.round(num(row.price))),
        stock: Math.max(0, Math.round(num(row.stock))),
        total: Math.max(0, Math.round(num(row.total))),
        image: str(row.image) || "/images/tile-market.png",
        refOnly: bool(row.refOnly),
        limit: Math.max(1, Math.round(num(row.limit, 1))),
        description: str(row.description),
        delivery: str(row.delivery),
        rules: lines(row.rules),
      };
    }),
    events: takeList(root.events, base.events, (item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      const title = str(row.title);
      if (!title) return null;
      const kind = EVENT_KINDS.includes(row.kind as (typeof EVENT_KINDS)[number])
        ? (row.kind as EventItem["kind"])
        : "Haftalık";
      const prizes = Array.isArray(row.prizes)
        ? row.prizes
            .map((prize) => {
              const prizeRow = asRecord(prize);
              if (!prizeRow) return null;
              const place = str(prizeRow.place);
              const reward = str(prizeRow.prize);
              if (!place && !reward) return null;
              return { place: place || "—", prize: reward };
            })
            .filter((prize): prize is { place: string; prize: string } => prize !== null)
        : [];
      return {
        id: str(row.id) || `event-${index + 1}`,
        kind,
        title,
        subtitle: str(row.subtitle),
        hoursLeft: Math.max(0, num(row.hoursLeft, 24)),
        participants: Math.max(0, Math.round(num(row.participants))),
        entry: Math.max(0, Math.round(num(row.entry))),
        prize: str(row.prize),
        image: str(row.image) || "/images/banner-events.png",
        description: str(row.description),
        steps: lines(row.steps),
        rules: lines(row.rules),
        prizes,
      };
    }),
    predictions: takeList(root.predictions, base.predictions, (item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      const home = str(row.home);
      const away = str(row.away);
      if (!home || !away) return null;
      const options = Array.isArray(row.options)
        ? row.options
            .map((option, optionIndex) => {
              const optionRow = asRecord(option);
              if (!optionRow) return null;
              const label = str(optionRow.label);
              if (!label) return null;
              return {
                id: str(optionRow.id) || String(optionIndex + 1),
                label,
                votes: Math.max(0, Math.round(num(optionRow.votes))),
              };
            })
            .filter((option): option is Prediction["options"][number] => option !== null)
        : [];
      return {
        id: str(row.id) || `prediction-${index + 1}`,
        league: str(row.league) || "Lig",
        home,
        away,
        kickoff: str(row.kickoff),
        reward: Math.max(0, Math.round(num(row.reward))),
        options: options.length ? options : [{ id: "1", label: "Ev", votes: 0 }, { id: "x", label: "Beraberlik", votes: 0 }, { id: "2", label: "Deplasman", votes: 0 }],
      };
    }),
    leaderboard: takeList(root.leaderboard, base.leaderboard, (item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      const name = str(row.name);
      if (!name) return null;
      return {
        rank: index + 1,
        name,
        points: Math.max(0, Math.round(num(row.points))),
        streak: Math.max(0, Math.round(num(row.streak))),
      };
    }),
    wins: takeList(root.wins, base.wins, (item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      const user = str(row.user);
      if (!user) return null;
      return {
        id: str(row.id) || `win-${index + 1}`,
        game: str(row.game) || "Çark",
        user,
        time: str(row.time),
        reward: str(row.reward),
      };
    }),
    faqs: takeList(root.faqs, base.faqs, (item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      const question = str(row.question);
      if (!question) return null;
      const answer = str(row.answer);
      return {
        id: str(row.id) || `faq-${index + 1}`,
        group: str(row.group) || "Genel",
        question,
        answer,
      };
    }),
    heroes: HERO_SEED.map((seed) => {
      const saved = Array.isArray(root.heroes)
        ? root.heroes.map(asRecord).find((row) => row && str(row.id) === seed.id)
        : null;
      if (!saved) return { ...seed };
      return {
        id: seed.id,
        path: seed.path,
        image: str(saved.image) || seed.image,
        eyebrow: str(saved.eyebrow) || seed.eyebrow,
        title: str(saved.title) || seed.title,
        description: str(saved.description) || seed.description,
      };
    }),
    teams: takeList(root.teams, base.teams, (item) => {
      const row = asRecord(item);
      if (!row) return null;
      const name = str(row.name);
      if (!name) return null;
      return { name, logo: str(row.logo) };
    }),
  };
}

export function heroById(content: DesignContent, id: string) {
  return content.heroes.find((hero) => hero.id === id) ?? HERO_SEED.find((hero) => hero.id === id) ?? HERO_SEED[0];
}

export function logoMaps(content: DesignContent) {
  return {
    sponsors: Object.fromEntries(content.sponsors.filter((item) => item.logo).map((item) => [item.id, item.logo])),
    teams: Object.fromEntries(content.teams.map((item) => [item.name, item.logo])),
  };
}
