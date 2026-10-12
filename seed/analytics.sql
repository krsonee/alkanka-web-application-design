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
