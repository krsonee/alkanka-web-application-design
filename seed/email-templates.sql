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
