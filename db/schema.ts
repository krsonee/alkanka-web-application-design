import {
  pgTable,
  serial,
  text,
  integer,
  real,
  boolean,
  timestamp,
  date,
} from "drizzle-orm/pg-core";

export const sites = pgTable("sites", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url").default("").notNull(),
  bonusText: text("bonus_text").default("").notNull(),
  url: text("url").default("#").notNull(),
  entryUrl: text("entry_url").default("").notNull(),
  domain: text("domain").default("").notNull(),
  badge: text("badge").default("").notNull(),
  tagline: text("tagline").default("").notNull(),
  perks: text("perks").default("").notNull(),
  rating: real("rating").default(0).notNull(),
  payout: text("payout").default("").notNull(),
  bonusType: text("bonus_type").default("").notNull(),
  wagerText: text("wager_text").default("").notNull(),
  bonusCode: text("bonus_code").default("").notNull(),
  featured: boolean("featured").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  clicks: integer("clicks").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  active: boolean("active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const popups = pgTable("popups", {
  id: serial("id").primaryKey(),
  title: text("title").default("").notNull(),
  body: text("body").default("").notNull(),
  imageUrl: text("image_url").default("").notNull(),
  buttons: text("buttons").default("[]").notNull(),
  delaySeconds: integer("delay_seconds").default(0).notNull(),
  oncePerVisitor: boolean("once_per_visitor").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").default("").notNull(),
});

export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").default("").notNull(),
  preheader: text("preheader").default("").notNull(),
  layout: text("layout").default("promo").notNull(),
  headline: text("headline").default("").notNull(),
  bodyText: text("body_text").default("").notNull(),
  imageUrl: text("image_url").default("").notNull(),
  ctaText: text("cta_text").default("").notNull(),
  ctaUrl: text("cta_url").default("").notNull(),
  footerNote: text("footer_note").default("").notNull(),
  bodyStyle: text("body_style").default("paragraphs").notNull(),
  html: text("html").default("").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const faqs = pgTable("faqs", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  category: text("category").default("Genel").notNull(),
  slug: text("slug").default("").notNull(),
  active: boolean("active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tek satırlık yapılandırma: hesabın api_id/api_hash ve oturum bilgisi.
// Şifreli alanlar (apiHashEncrypted, sessionEncrypted) hiçbir admin API
// yanıtında dönmez; yalnızca worker ve login route'ları okur/yazar.
export const telegramConfig = pgTable("telegram_config", {
  id: serial("id").primaryKey(),
  apiId: text("api_id").default("").notNull(),
  apiHashEncrypted: text("api_hash_encrypted").default("").notNull(),
  sessionEncrypted: text("session_encrypted").default("").notNull(),
  accountLabel: text("account_label").default("").notNull(),
  connected: boolean("connected").default(false).notNull(),
  botTokenEncrypted: text("bot_token_encrypted").default("").notNull(),
  botUsername: text("bot_username").default("").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const telegramForwardRules = pgTable("telegram_forward_rules", {
  id: serial("id").primaryKey(),
  sourceChannel: text("source_channel").notNull(),
  targetChannel: text("target_channel").notNull(),
  footerText: text("footer_text").default("").notNull(),
  footerButtons: text("footer_buttons").default("[]").notNull(),
  footerEntities: text("footer_entities").default("[]").notNull(),
  footerButtonLayout: text("footer_button_layout").default("stack").notNull(),
  active: boolean("active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),
  target: text("target").notNull(),
  targetId: integer("target_id"),
  label: text("label").default("").notNull(),
  visitorId: text("visitor_id").default("").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});

// Bakiye tutulmaz. Her satır bir değişikliktir; bakiye amount toplamıdır.
export const pointLedger = pgTable("point_ledger", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id")
    .notNull()
    .references(() => members.id),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(),
  claimDay: date("claim_day"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});

export const telegramForwardLog = pgTable("telegram_forward_log", {
  id: serial("id").primaryKey(),
  ruleId: integer("rule_id"),
  sourceChannel: text("source_channel").default("").notNull(),
  targetChannel: text("target_channel").default("").notNull(),
  status: text("status").notNull(),
  detail: text("detail").default("").notNull(),
  preview: text("preview").default("").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Site = typeof sites.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type Popup = typeof popups.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type Faq = typeof faqs.$inferSelect;
export type TelegramConfig = typeof telegramConfig.$inferSelect;
export type TelegramForwardRule = typeof telegramForwardRules.$inferSelect;
export type TelegramForwardLog = typeof telegramForwardLog.$inferSelect;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type Member = typeof members.$inferSelect;
export type PointLedgerEntry = typeof pointLedger.$inferSelect;
