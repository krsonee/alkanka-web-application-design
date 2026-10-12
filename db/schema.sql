-- Tüm tablolar. Tekrar tekrar çalıştırılabilir: var olan tabloya ve veriye
-- dokunmaz, yalnızca eksik tablo/sütun/indeksleri ekler.

CREATE TABLE IF NOT EXISTS sites (
  id serial PRIMARY KEY,
  name text NOT NULL,
  logo_url text NOT NULL DEFAULT '',
  bonus_text text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '#',
  entry_url text NOT NULL DEFAULT '',
  domain text NOT NULL DEFAULT '',
  badge text NOT NULL DEFAULT '',
  featured boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS tagline text NOT NULL DEFAULT '';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS perks text NOT NULL DEFAULT '';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS rating real NOT NULL DEFAULT 0;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS payout text NOT NULL DEFAULT '';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS bonus_type text NOT NULL DEFAULT '';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS wager_text text NOT NULL DEFAULT '';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS bonus_code text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS announcements (
  id serial PRIMARY KEY,
  text text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS popups (
  id serial PRIMARY KEY,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  buttons text NOT NULL DEFAULT '[]',
  delay_seconds integer NOT NULL DEFAULT 0,
  once_per_visitor boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS email_templates (
  id serial PRIMARY KEY,
  name text NOT NULL,
  subject text NOT NULL DEFAULT '',
  preheader text NOT NULL DEFAULT '',
  layout text NOT NULL DEFAULT 'promo',
  headline text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  cta_text text NOT NULL DEFAULT '',
  cta_url text NOT NULL DEFAULT '',
  footer_note text NOT NULL DEFAULT '',
  body_style text NOT NULL DEFAULT 'paragraphs',
  html text NOT NULL DEFAULT '',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS body_style text NOT NULL DEFAULT 'paragraphs';

CREATE TABLE IF NOT EXISTS faqs (
  id serial PRIMARY KEY,
  question text NOT NULL,
  answer text NOT NULL,
  category text NOT NULL DEFAULT 'Genel',
  slug text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);
ALTER TABLE faqs ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Genel';
ALTER TABLE faqs ADD COLUMN IF NOT EXISTS slug text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS telegram_config (
  id serial PRIMARY KEY,
  api_id text NOT NULL DEFAULT '',
  api_hash_encrypted text NOT NULL DEFAULT '',
  session_encrypted text NOT NULL DEFAULT '',
  account_label text NOT NULL DEFAULT '',
  connected boolean NOT NULL DEFAULT false,
  bot_token_encrypted text NOT NULL DEFAULT '',
  bot_username text NOT NULL DEFAULT '',
  updated_at timestamp NOT NULL DEFAULT now()
);
ALTER TABLE telegram_config
  ADD COLUMN IF NOT EXISTS bot_token_encrypted text NOT NULL DEFAULT '';
ALTER TABLE telegram_config
  ADD COLUMN IF NOT EXISTS bot_username text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS telegram_forward_rules (
  id serial PRIMARY KEY,
  source_channel text NOT NULL,
  target_channel text NOT NULL,
  footer_text text NOT NULL DEFAULT '',
  footer_buttons text NOT NULL DEFAULT '[]',
  footer_entities text NOT NULL DEFAULT '[]',
  footer_button_layout text NOT NULL DEFAULT 'stack',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
ALTER TABLE telegram_forward_rules
  ADD COLUMN IF NOT EXISTS footer_buttons text NOT NULL DEFAULT '[]';
ALTER TABLE telegram_forward_rules
  ADD COLUMN IF NOT EXISTS footer_entities text NOT NULL DEFAULT '[]';
ALTER TABLE telegram_forward_rules
  ADD COLUMN IF NOT EXISTS footer_button_layout text NOT NULL DEFAULT 'stack';

CREATE TABLE IF NOT EXISTS telegram_forward_log (
  id serial PRIMARY KEY,
  rule_id integer,
  source_channel text NOT NULL DEFAULT '',
  target_channel text NOT NULL DEFAULT '',
  status text NOT NULL,
  detail text NOT NULL DEFAULT '',
  preview text NOT NULL DEFAULT '',
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS telegram_forward_log_created_at_idx
  ON telegram_forward_log (created_at DESC);

CREATE TABLE IF NOT EXISTS analytics_events (
  id serial PRIMARY KEY,
  kind text NOT NULL,
  target text NOT NULL,
  target_id integer,
  label text NOT NULL DEFAULT '',
  visitor_id text NOT NULL DEFAULT '',
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx
  ON analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_kind_created_idx
  ON analytics_events (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_target_created_idx
  ON analytics_events (target, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_visitor_idx
  ON analytics_events (visitor_id, created_at DESC);

-- Üyelik ve puan defteri. Bakiye ayrı sütun değildir; her değişikliğin
-- point_ledger satırı vardır ve bakiye bu satırların toplamıdır. Puanı
-- yalnızca sunucu yazar. Kayıt bonusu üye başına bir kez, günlük puan ise
-- Europe/Istanbul günü başına bir kez yazılır (kısmi benzersiz indeksler).

CREATE TABLE IF NOT EXISTS members (
  id serial PRIMARY KEY,
  username text NOT NULL,
  password_hash text NOT NULL,
  age_confirmed boolean NOT NULL DEFAULT false,
  telegram_id text,
  telegram_username text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT members_username_unique UNIQUE (username),
  CONSTRAINT members_telegram_unique UNIQUE (telegram_id)
);

ALTER TABLE members ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE members ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS members_email_unique
  ON members (lower(email))
  WHERE email <> '';

CREATE TABLE IF NOT EXISTS point_ledger (
  id serial PRIMARY KEY,
  member_id integer NOT NULL REFERENCES members (id),
  amount integer NOT NULL,
  reason text NOT NULL,
  claim_day date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT point_ledger_amount_nonzero CHECK (amount <> 0),
  CONSTRAINT point_ledger_reason_len CHECK (char_length(reason) BETWEEN 1 AND 160),
  CONSTRAINT point_ledger_daily_day CHECK (
    (reason = 'daily_claim' AND claim_day IS NOT NULL)
    OR reason <> 'daily_claim'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS point_ledger_signup_once
  ON point_ledger (member_id)
  WHERE reason = 'signup_bonus';

CREATE UNIQUE INDEX IF NOT EXISTS point_ledger_daily_once
  ON point_ledger (member_id, claim_day)
  WHERE reason = 'daily_claim';

CREATE INDEX IF NOT EXISTS point_ledger_member_created_idx
  ON point_ledger (member_id, created_at DESC, id DESC);

-- Görevler. Günlük türler claim_day dolu, tek seferlikler claim_day boş.
CREATE TABLE IF NOT EXISTS point_tasks (
  id serial PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  reward integer NOT NULL DEFAULT 0 CHECK (reward >= 0 AND reward <= 1000000),
  task_type text NOT NULL,
  code text NOT NULL DEFAULT '',
  site_id integer,
  repeat_daily boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS point_task_claims (
  id serial PRIMARY KEY,
  task_id integer NOT NULL REFERENCES point_tasks (id) ON DELETE CASCADE,
  member_id integer NOT NULL REFERENCES members (id),
  claim_day date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS point_task_claims_once
  ON point_task_claims (task_id, member_id)
  WHERE claim_day IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS point_task_claims_daily
  ON point_task_claims (task_id, member_id, claim_day)
  WHERE claim_day IS NOT NULL;

CREATE TABLE IF NOT EXISTS member_site_visits (
  id serial PRIMARY KEY,
  member_id integer NOT NULL REFERENCES members (id),
  site_id integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS member_site_visits_member_idx
  ON member_site_visits (member_id, site_id, created_at DESC);

-- Market. Stok -1 sınırsız demektir. Nakit, TL veya kripto alanı yok.
CREATE TABLE IF NOT EXISTS market_rewards (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  price integer NOT NULL CHECK (price > 0 AND price <= 1000000),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= -1),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_orders (
  id serial PRIMARY KEY,
  member_id integer NOT NULL REFERENCES members (id),
  reward_id integer NOT NULL REFERENCES market_rewards (id),
  reward_name text NOT NULL,
  price integer NOT NULL CHECK (price > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
CREATE INDEX IF NOT EXISTS market_orders_status_idx
  ON market_orders (status, created_at DESC);

-- Numaralı bilet. Ödül yalnızca puandır.
CREATE TABLE IF NOT EXISTS ticket_events (
  id serial PRIMARY KEY,
  title text NOT NULL,
  ticket_price integer NOT NULL CHECK (ticket_price > 0 AND ticket_price <= 1000000),
  per_user_cap integer NOT NULL CHECK (per_user_cap > 0 AND per_user_cap <= 1000),
  ends_at timestamptz NOT NULL,
  prize_points integer NOT NULL CHECK (prize_points > 0 AND prize_points <= 1000000),
  active boolean NOT NULL DEFAULT true,
  winner_ticket_id integer,
  winner_member_id integer,
  winning_number integer,
  drawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tickets (
  id serial PRIMARY KEY,
  event_id integer NOT NULL REFERENCES ticket_events (id),
  member_id integer NOT NULL REFERENCES members (id),
  number integer NOT NULL CHECK (number > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tickets_event_number_unique UNIQUE (event_id, number)
);
CREATE INDEX IF NOT EXISTS tickets_member_event_idx
  ON tickets (event_id, member_id);

-- Çark. 0 puanlık dilim deftere yazılmaz; çevirme kaydı yine durur.
CREATE TABLE IF NOT EXISTS wheel_slices (
  id serial PRIMARY KEY,
  label text NOT NULL,
  points integer NOT NULL CHECK (points >= 0 AND points <= 1000000),
  weight integer NOT NULL CHECK (weight > 0 AND weight <= 1000000),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS wheel_spins (
  id serial PRIMARY KEY,
  member_id integer NOT NULL REFERENCES members (id),
  slice_id integer,
  label text NOT NULL,
  points integer NOT NULL CHECK (points >= 0),
  claim_day date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Gizem sandığı. Günlük adet panelden gelir. Puan deftere yazılır.
CREATE TABLE IF NOT EXISTS chest_opens (
  id serial PRIMARY KEY,
  member_id integer NOT NULL REFERENCES members (id),
  chest text NOT NULL CHECK (chest IN ('bronze', 'silver', 'gold')),
  label text NOT NULL,
  points integer NOT NULL CHECK (points > 0 AND points <= 1000000),
  claim_day date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Eski kurulumlar günde tek satıra kilitliydi. Adet artık sayılarak tutulur.
ALTER TABLE wheel_spins DROP CONSTRAINT IF EXISTS wheel_spins_once;
ALTER TABLE chest_opens DROP CONSTRAINT IF EXISTS chest_opens_once;
CREATE INDEX IF NOT EXISTS wheel_spins_member_day_idx ON wheel_spins (member_id, claim_day);
CREATE INDEX IF NOT EXISTS chest_opens_member_day_idx ON chest_opens (member_id, claim_day);

-- Zar bahsi. Üst/alt, gelen sayı ve sonuç burada durur. Eski bahisler
-- yalnızca point_ledger satırından okunur.
CREATE TABLE IF NOT EXISTS dice_bets (
  id serial PRIMARY KEY,
  member_id integer NOT NULL REFERENCES members (id),
  stake integer NOT NULL CHECK (stake > 0 AND stake <= 1000000),
  side text NOT NULL CHECK (side IN ('over', 'under')),
  roll integer NOT NULL CHECK (roll BETWEEN 1 AND 100),
  outcome text NOT NULL CHECK (outcome IN ('win', 'loss', 'push')),
  payout integer NOT NULL CHECK (payout >= 0 AND payout <= 1000000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dice_bets_member_created_idx
  ON dice_bets (member_id, created_at DESC, id DESC);

-- Ücretsiz zar atışı. Çark ve sandık kendi tablolarında sayılır.
CREATE TABLE IF NOT EXISTS mini_plays (
  id serial PRIMARY KEY,
  member_id integer NOT NULL REFERENCES members (id),
  game text NOT NULL CHECK (game IN ('zar')),
  label text NOT NULL,
  points integer NOT NULL CHECK (points >= 0 AND points <= 1000000),
  detail text NOT NULL DEFAULT '',
  claim_day date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mini_plays_member_day_idx
  ON mini_plays (member_id, game, claim_day);

CREATE TABLE IF NOT EXISTS sponsor_campaigns (
  id serial PRIMARY KEY,
  site_id integer NOT NULL REFERENCES sites (id),
  title text NOT NULL,
  bonus_summary text NOT NULL DEFAULT '',
  steps text NOT NULL DEFAULT '',
  button_label text NOT NULL DEFAULT 'Siteye git',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Maç tahmini. Kazanç yalnızca puan.
CREATE TABLE IF NOT EXISTS matches (
  id serial PRIMARY KEY,
  home_team text NOT NULL,
  away_team text NOT NULL,
  lock_at timestamptz NOT NULL,
  option_a text NOT NULL DEFAULT 'Ev sahibi',
  option_b text NOT NULL DEFAULT 'Beraberlik',
  option_c text NOT NULL DEFAULT 'Deplasman',
  stake integer NOT NULL DEFAULT 10 CHECK (stake >= 0 AND stake <= 1000000),
  payout_multiplier integer NOT NULL DEFAULT 2 CHECK (payout_multiplier >= 1 AND payout_multiplier <= 20),
  winning text,
  active boolean NOT NULL DEFAULT true,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT matches_winning_check CHECK (winning IS NULL OR winning IN ('a', 'b', 'c'))
);

CREATE TABLE IF NOT EXISTS match_picks (
  id serial PRIMARY KEY,
  match_id integer NOT NULL REFERENCES matches (id),
  member_id integer NOT NULL REFERENCES members (id),
  option text NOT NULL CHECK (option IN ('a', 'b', 'c')),
  stake integer NOT NULL CHECK (stake >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_picks_once UNIQUE (match_id, member_id)
);

-- Elle girilen özel oran kartı. source = telegram ileride aktarıcı içindir.
CREATE TABLE IF NOT EXISTS odds_cards (
  id serial PRIMARY KEY,
  site_id integer,
  site_label text NOT NULL DEFAULT '',
  body text NOT NULL,
  event_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'manual',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS odds_cards_active_idx
  ON odds_cards (active, sort_order, id);

-- Ana sayfa slaytı. Görsel boşsa tam genişlik koyu slayt kalır.
CREATE TABLE IF NOT EXISTS home_slides (
  id serial PRIMARY KEY,
  image_url text NOT NULL DEFAULT '',
  title text NOT NULL,
  line text NOT NULL DEFAULT '',
  button_label text NOT NULL DEFAULT '',
  href text NOT NULL DEFAULT '/',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  art text NOT NULL DEFAULT 'wheel'
);

INSERT INTO home_slides (title, line, button_label, href, sort_order, active, art)
SELECT v.title, v.line, v.button_label, v.href, v.sort_order, v.active, v.art
FROM (VALUES
  ('Çark', 'Günde bir ücretsiz çevirme. Sonuç sunucuda yazılır.', 'Çarkı aç', '/cark', 1, true, 'wheel'),
  ('Puan marketi', 'Rozet, ekstra hak ve hediyelik. Nakit yok.', 'Marketi aç', '/market', 2, true, 'bag'),
  ('Görevler', 'Giriş, site ve kod. Puanı sunucu yazar.', 'Görevlere git', '/gorevler', 3, true, 'check'),
  ('Biletler', 'Numaralı çekiliş. Ödül yine puan.', 'Bilet al', '/biletler', 4, true, 'ticket'),
  ('Tahminler', 'Maç kilidi, küçük bahis. Kazanan puan alır.', 'Tahmin et', '/tahminler', 5, true, 'flag')
) AS v(title, line, button_label, href, sort_order, active, art)
WHERE NOT EXISTS (SELECT 1 FROM home_slides);

-- Slaytın altındaki altı özellik kartı.
CREATE TABLE IF NOT EXISTS home_cards (
  id serial PRIMARY KEY,
  slot text NOT NULL,
  image_url text NOT NULL DEFAULT '',
  title text NOT NULL,
  button_label text NOT NULL DEFAULT '',
  href text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  art text NOT NULL DEFAULT 'wheel',
  CONSTRAINT home_cards_slot_unique UNIQUE (slot)
);

INSERT INTO home_cards (slot, title, button_label, href, sort_order, art)
SELECT v.slot, v.title, v.button_label, v.href, v.sort_order, v.art
FROM (VALUES
  ('cark', 'Çark', 'Çarkı aç', '/cark', 1, 'wheel'),
  ('market', 'Market', 'Marketi aç', '/market', 2, 'bag'),
  ('gorevler', 'Görevler', 'Görevlere git', '/gorevler', 3, 'check'),
  ('zar', 'Zar', 'Zar at', '/zar', 4, 'dice'),
  ('biletler', 'Biletler', 'Bilet al', '/biletler', 5, 'ticket'),
  ('tahminler', 'Tahminler', 'Tahmin et', '/tahminler', 6, 'flag')
) AS v(slot, title, button_label, href, sort_order, art)
WHERE NOT EXISTS (SELECT 1 FROM home_cards c WHERE c.slot = v.slot);

-- Panelden açılan kısa link. Kök adreste /slug olarak 302 döner.
CREATE TABLE IF NOT EXISTS short_links (
  id serial PRIMARY KEY,
  slug text NOT NULL,
  url text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  clicks integer NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT short_links_slug_unique UNIQUE (slug)
);

-- Masa oyunları, canlı rulet ve turnuvalar. Tasarım reposundaki şema.
CREATE TABLE IF NOT EXISTS solo_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  game text NOT NULL,
  stake integer NOT NULL CHECK (stake >= 0),
  status text NOT NULL CHECK (status IN ('acik', 'terk', 'bitti')),
  state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS solo_sessions_user_game_idx ON solo_sessions (user_id, game, status);

CREATE TABLE IF NOT EXISTS game_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game text NOT NULL,
  stake integer NOT NULL DEFAULT 0,
  seats integer NOT NULL DEFAULT 2,
  status text NOT NULL CHECK (status IN ('bekliyor', 'oynaniyor', 'bitti', 'iptal')),
  players jsonb NOT NULL DEFAULT '[]'::jsonb,
  state jsonb,
  version integer NOT NULL DEFAULT 1,
  winner_id text,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL DEFAULT '',
  mode text NOT NULL DEFAULT 'pvp',
  tournament_id integer,
  round_no integer,
  match_no integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS game_tables_status_idx ON game_tables (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS tournaments (
  id serial PRIMARY KEY,
  game text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  rules text NOT NULL DEFAULT '',
  entry_fee integer NOT NULL DEFAULT 0 CHECK (entry_fee >= 0),
  prize_pool integer NOT NULL DEFAULT 0 CHECK (prize_pool >= 0),
  prize_note text NOT NULL DEFAULT '',
  max_players integer NOT NULL DEFAULT 16 CHECK (max_players >= 2),
  starts_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'kayit' CHECK (status IN ('kayit', 'basladi', 'bitti', 'iptal')),
  winner text,
  bracket jsonb,
  format text NOT NULL DEFAULT 'eleme',
  table_size integer NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tournament_entries (
  id serial PRIMARY KEY,
  tournament_id integer NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
  nickname text NOT NULL,
  telegram text NOT NULL DEFAULT '',
  user_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tournament_entries_tournament_idx ON tournament_entries (tournament_id, created_at);

CREATE TABLE IF NOT EXISTS roulette_bets (
  id serial PRIMARY KEY,
  round_id integer NOT NULL,
  user_id text NOT NULL,
  user_name text NOT NULL DEFAULT '',
  bets jsonb NOT NULL DEFAULT '[]'::jsonb,
  total integer NOT NULL DEFAULT 0 CHECK (total >= 0),
  settled boolean NOT NULL DEFAULT false,
  returned integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT roulette_bets_round_user UNIQUE (round_id, user_id)
);

CREATE TABLE IF NOT EXISTS game_history (
  id serial PRIMARY KEY,
  user_id text NOT NULL,
  user_name text NOT NULL DEFAULT '',
  game text NOT NULL,
  mode text NOT NULL DEFAULT '',
  opponent text NOT NULL DEFAULT '',
  stake integer NOT NULL DEFAULT 0,
  result text NOT NULL,
  delta integer NOT NULL DEFAULT 0,
  score integer,
  table_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS game_history_user_idx ON game_history (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app_installs (
  user_id text PRIMARY KEY,
  platform text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_config (
  id int PRIMARY KEY DEFAULT 1,
  public_key text NOT NULL,
  private_key text NOT NULL,
  CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint text PRIMARY KEY,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_log (
  id serial PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL,
  url text NOT NULL,
  sent int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deals (
  id serial PRIMARY KEY,
  source_id int,
  post_id int,
  brand text NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  photo text,
  link text NOT NULL,
  odds jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, post_id)
);

ALTER TABLE deals ADD COLUMN IF NOT EXISTS odds jsonb;

CREATE TABLE IF NOT EXISTS seo_settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id serial PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  cover text NOT NULL DEFAULT '',
  keywords text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tg_bots (
  id serial PRIMARY KEY,
  name text NOT NULL,
  username text NOT NULL UNIQUE,
  token_enc text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tg_targets (
  id serial PRIMARY KEY,
  bot_id int NOT NULL REFERENCES tg_bots(id) ON DELETE CASCADE,
  chat_id text NOT NULL,
  title text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bot_id, chat_id)
);

CREATE TABLE IF NOT EXISTS tg_settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS tg_sources (
  id serial PRIMARY KEY,
  channel text NOT NULL UNIQUE,
  brand text NOT NULL,
  link text NOT NULL,
  keywords text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  target_id int REFERENCES tg_targets(id) ON DELETE SET NULL,
  last_post_id int,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tg_log (
  id serial PRIMARY KEY,
  source_id int NOT NULL REFERENCES tg_sources(id) ON DELETE CASCADE,
  post_id int NOT NULL,
  status text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, post_id)
);

CREATE TABLE IF NOT EXISTS tg_chat_messages (
  id serial PRIMARY KEY,
  chat_id text NOT NULL,
  tg_message_id bigint,
  from_tg_id bigint,
  user_id text,
  author text NOT NULL,
  text text NOT NULL,
  origin text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tg_chat_messages_chat_idx ON tg_chat_messages (chat_id, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS tg_chat_messages_tg_uniq ON tg_chat_messages (chat_id, tg_message_id) WHERE tg_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS tg_links (
  user_id text PRIMARY KEY,
  tg_id bigint NOT NULL UNIQUE,
  tg_username text,
  tg_name text NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tg_link_codes (
  code text PRIMARY KEY,
  user_id text NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS studio_brands (
  id serial PRIMARY KEY,
  name text NOT NULL,
  domain text NOT NULL DEFAULT '',
  logo text NOT NULL DEFAULT '',
  colors text NOT NULL DEFAULT '[]',
  font text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  mascot text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE studio_brands ADD COLUMN IF NOT EXISTS mascot text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS ref_codes (
  user_id text PRIMARY KEY,
  code text UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS referrals (
  referred_id text PRIMARY KEY,
  referrer_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  rewarded_at timestamptz
);

CREATE TABLE IF NOT EXISTS site_reviews (
  id serial PRIMARY KEY,
  site_id text NOT NULL,
  user_id text NOT NULL,
  user_name text NOT NULL,
  rating int NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, user_id)
);

CREATE TABLE IF NOT EXISTS complaints (
  id serial PRIMARY KEY,
  site_id text NOT NULL,
  user_id text NOT NULL,
  user_name text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  reply text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS odds_alerts (
  user_id text NOT NULL,
  keyword text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, keyword)
);

CREATE TABLE IF NOT EXISTS league_matches (
  id serial PRIMARY KEY,
  league text NOT NULL,
  home text NOT NULL,
  away text NOT NULL,
  kickoff timestamptz NOT NULL,
  home_goals int,
  away_goals int,
  settled boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS league_picks (
  match_id int NOT NULL REFERENCES league_matches(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  user_name text NOT NULL,
  home int NOT NULL,
  away int NOT NULL,
  points int,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, user_id)
);

CREATE TABLE IF NOT EXISTS studio_assets (
  id serial PRIMARY KEY,
  provider text NOT NULL,
  game text NOT NULL DEFAULT '',
  pathname text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS studio_jobs (
  id serial PRIMARY KEY,
  brand_id int,
  kind text NOT NULL,
  format text NOT NULL,
  prompt text NOT NULL,
  pathname text NOT NULL,
  parent_id int,
  cost numeric NOT NULL DEFAULT 0,
  clean text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS studio_files (
  pathname text PRIMARY KEY,
  content_type text NOT NULL,
  data bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Better Auth. Giriş penceresi bu tablolara yazar; boşsa oluşturulur,
-- var olan satırlara dokunulmaz.
CREATE TABLE IF NOT EXISTS "user" (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  "emailVerified" boolean NOT NULL DEFAULT false,
  image text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_email_key ON "user" (email);

CREATE TABLE IF NOT EXISTS session (
  id text PRIMARY KEY,
  "expiresAt" timestamptz NOT NULL,
  token text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES "user" (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS session_token_key ON session (token);

CREATE TABLE IF NOT EXISTS account (
  id text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallets (
  user_id text PRIMARY KEY,
  balance integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
