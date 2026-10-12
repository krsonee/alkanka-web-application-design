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
