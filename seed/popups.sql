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
