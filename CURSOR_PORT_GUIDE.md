# Cursor Port Guide — ALKANKA Site + Admin Panel

**Audience:** Cursor (AI agent) working inside the TARGET project (the user's own site + admin panel).
**Source of truth:** GitHub repo `https://github.com/krsonee/alkanka-web-application-design`, branch `main`.

Your job is to copy every feature from the source repo into the target project **1:1**. Same behavior, same UI, same routes, same database tables. Do not redesign, simplify, rename, or "improve" anything unless a step below tells you to. When the target already has an equivalent file, merge the source logic into it. Never silently drop it.

---

## 0. Ground rules for Cursor

1. Clone the source next to the target and read files from it directly. Do not reconstruct code from memory:
   ```bash
   git clone https://github.com/krsonee/alkanka-web-application-design.git ../alkanka-source
   ```
2. Copy files **verbatim** first, then fix imports and paths. Do not rewrite logic.
3. Keep every import alias as `@/` (see `tsconfig.json` in the source: `"@/*": ["./*"]`). If the target uses `src/`, put everything under `src/` and update the alias. Do not change the import statements themselves.
4. Work in the phase order in section 4. After each phase, run `pnpm exec tsc --noEmit` and fix all errors before you move on.
5. Do not touch secrets. Ask the human for environment variable values (section 3).
6. Keep all user-facing text in **Turkish**, exactly as it is in the source.
7. When you finish, run the full checklist in section 6.

---

## 1. Stack requirements (target must match)

| Item | Required |
|---|---|
| Framework | Next.js **16** (App Router, Turbopack), React **19** |
| Language | TypeScript 5.7 |
| Styling | Tailwind CSS **v4** (`@import "tailwindcss"` in `app/globals.css`, no `tailwind.config.js`) + `tw-animate-css` |
| UI kit | shadcn/ui (`components.json`, `components/ui/*`) |
| Package manager | pnpm |
| Database | PostgreSQL (Neon) via `@neondatabase/serverless` + `drizzle-orm` + `pg` |
| Auth (members) | `better-auth` (email + password) |
| Auth (admin panel) | password cookie (`ADMIN_PASSWORD`), see `lib/admin-auth.ts` |
| File storage | Vercel Blob (`@vercel/blob`) |
| AI | AI SDK `ai` v7 through Vercel AI Gateway (plain `provider/model` strings, no provider packages) |
| Images | `sharp` (server-side compositing, GIF frames) |
| Push | `web-push` |
| Client data | `swr` |

Install the dependencies, using the exact versions from the source `package.json`:

```bash
pnpm add @base-ui/react @neondatabase/serverless @vercel/analytics @vercel/blob ai better-auth \
  class-variance-authority clsx drizzle-orm lucide-react pg sharp swr tailwind-merge tw-animate-css web-push shadcn
pnpm add -D @types/pg @types/web-push @tailwindcss/postcss tailwindcss postcss
```

If the target is on Next.js 14/15, upgrade to 16 first. The source awaits `params`, `searchParams`, `cookies()` and `headers()` everywhere, and it uses `proxy`/Next 16 APIs.

---

## 2. Database

The source **creates its own tables at runtime** with `CREATE TABLE IF NOT EXISTS ...` inside the `lib/*` modules (an "ensure" function runs on first use). You do not need migration files. Point `DATABASE_URL` at the target Postgres and the tables appear on first request.

Tables created automatically:

| Area | Tables |
|---|---|
| Site content / SEO / blog | `site_content`, `seo_settings`, `blog_posts` |
| Deals & special odds | `deals` |
| Mobile app / push | `app_installs`, `push_config`, `push_subscriptions`, `push_log` |
| Telegram mirror + chat | `tg_bots`, `tg_sources`, `tg_targets`, `tg_settings`, `tg_log`, `tg_chat_messages`, `tg_links`, `tg_link_codes` |
| Creative studio | `studio_brands`, `studio_assets`, `studio_jobs` |
| Members / wallet / arena | better-auth tables + tables in `lib/db/index.ts`, `lib/member.ts`, `lib/arena-server.ts`, `lib/pvp/tables.ts`, `lib/tournaments.ts` |

Better Auth tables (`user`, `session`, `account`, `verification`) must exist. Either run `npx @better-auth/cli migrate` against the target DB or copy the schema in `lib/db/index.ts` from the source.

If the target already has tables with the same names but different columns, **stop and report to the human**. Do not drop data.

---

## 3. Environment variables

Ask the human to set these in the target hosting (Vercel → Project → Settings → Environment Variables). Never hardcode them.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection (Neon pooled URL) |
| `BETTER_AUTH_SECRET` | yes | Member auth secret (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | yes in prod | Public base URL of the site, e.g. `https://example.com` |
| `NEXT_PUBLIC_SITE_URL` | yes | Same public URL, used for SEO, sitemap and links |
| `ADMIN_PASSWORD` | yes | Password for `/panel` |
| `BLOB_READ_WRITE_TOKEN` | yes | Vercel Blob (studio assets, logos, uploads) |
| `CRON_SECRET` | yes | Protects `/api/cron/telegram` |
| `AI_GATEWAY_API_KEY` | only if NOT hosted on Vercel | AI Gateway auth. On Vercel, OIDC handles it automatically |

Telegram bot tokens and channel IDs are **not** environment variables. The admin enters them in the panel (Telegram tab) and they are stored in `tg_bots`/`tg_sources`/`tg_targets`. Web-push VAPID keys are generated automatically and stored in `push_config`.

`V0_*` and `VERCEL_URL` references in the source are fallbacks for detecting the preview URL. Leave them in. They are harmless outside v0.

---

## 4. Port order (phases)

Copy each listed path from `../alkanka-source` into the same path in the target. Paths ending in `/` mean the whole folder.

### Phase 1 — Foundation
- `app/layout.tsx`: merge fonts, metadata, `<html className="bg-background">`, the providers (brand/logo/points context, PWA provider) and `@vercel/analytics`
- `app/globals.css`: copy the design tokens (`:root`, `.dark`, `@theme inline`) exactly
- `app/error.tsx`, `app/loading.tsx`, `app/not-found.tsx`
- `components/ui/` (shadcn primitives the source uses)
- `lib/utils.ts`, `lib/db/index.ts`, `lib/auth.ts`, `lib/auth-client.ts`, `lib/admin-auth.ts`
- `app/api/auth/[...all]/route.ts`, `app/api/me/route.ts`
- `next.config.mjs`: merge the `headers()` block, image settings and `serverExternalPackages` (for `sharp`)
- `public/`: copy everything (logos, mascot Jako, banners, game art, promo images, PWA icons, service worker)

### Phase 2 — Public site (route group `app/(site)/`)
- `app/(site)/layout.tsx` (sidebar, topbar, mobile nav, live chat rail)
- `app/(site)/page.tsx` plus every subfolder: `biletler`, `bonuslar`, `firsatlar` (+ `[slug]`), `gorevler`, `kampanyalar`, `market`, `oyunlar` (+ `[oyun]`, `canli`), `ozel-oranlar`, `rehber` (+ `[slug]`), `siralama`, `sponsorlar`, `sss`, `tahminler`, `turnuvalar`, `uygulama`
- `components/alkanka/`: whole folder, including `app/`, `arena/`, `games/`
- `lib/content.ts`, `lib/casino.ts`, `lib/site-registry.ts`, `lib/logo-registry.ts`, `lib/blog.ts`, `lib/seo.ts`, `lib/deals.ts`, `lib/deal-types.ts`, `lib/split-match.ts`
- `app/logolar/`, `app/maskot/`, `app/postlar/`
- `app/sitemap.ts`, `app/robots.ts`, `app/manifest.ts`
- `app/api/logo/[name]/route.ts`, `app/api/logo-upload/route.ts`

### Phase 3 — Members, wallet (KC points), games, arena
- `lib/member.ts`, `lib/arena.ts`, `lib/arena-server.ts`, `lib/pvp/`, `lib/roulette-live.ts`, `lib/tournaments.ts`, `lib/tournaments-shared.ts`, `lib/bracket.ts`
- `app/actions/` (`app.ts`, `arena.ts`, `chat.ts`, `wallet.ts`)
- `app/api/rulet/route.ts`, `app/api/tables/route.ts`, `app/api/tables/[id]/route.ts`, `app/api/tables/live/route.ts`
- Features to confirm: real membership with a server-side KC wallet, mini games with cooldowns (lucky wheel, mystery chests), the shared live roulette table with croupier Jako, realistic blackjack, Head Ball, Okey 2/4-seat with bots and teams, Tavla, Bilardo, PvP stake tables, live spectator lobby, tournaments with simultaneous rounds and a bracket view. The dice game was **removed** on purpose. Do not re-add it.

### Phase 4 — Mobile app (PWA) & push
- `lib/app-config.ts`, `lib/push.ts`
- `components/alkanka/app/` (install guide, install bonus prompts, PWA provider, site tour)
- `app/panel/push-actions.ts`, `components/panel/push-sender.tsx`
- Make sure the service worker file in `public/` is served from the site root

### Phase 5 — Telegram (mirror bot + live chat)
- `lib/telegram-mirror.ts`, `lib/telegram-filters.ts`, `lib/telegram-chat.ts`
- `app/api/telegram/webhook/route.ts`, `app/api/cron/telegram/route.ts`, `app/api/chat/route.ts`
- `components/alkanka/use-chat-feed.ts`, `components/alkanka/live-rail.tsx`
- `app/panel/telegram-actions.ts`, `components/panel/telegram-mirror.tsx`, `components/panel/telegram-guide.tsx`, `components/panel/telegram-chat-setup.tsx`
- Add the cron to the target `vercel.json`, then confirm the interval with the human:
  ```json
  { "crons": [{ "path": "/api/cron/telegram", "schedule": "*/5 * * * *" }] }
  ```
- Behavior to keep:
  - Multiple bots and source channels are managed from the panel.
  - Preset post filters apply per source.
  - Mirrored posts go to target channels and to the site.
  - The live chat rail is two-way with the real Telegram group (site users post and see group messages).
  - Posts tagged as special odds are parsed into deals (see Phase 7).

### Phase 6 — Admin panel (`/panel`)
- `app/panel/page.tsx`, `app/panel/actions.ts`, `app/panel/arena-actions.ts`, `app/panel/seo-actions.ts`, `app/panel/studio-actions.ts`, `app/panel/telegram-actions.ts`, `app/panel/push-actions.ts`
- `components/panel/`: whole folder (`login-form`, `content-editor`, `logo-editor`, `arena-settings-editor`, `tournament-manager`, `seo-manager`, `push-sender`, `telegram-*`, `studio`, `studio-guide`)
- If the target already has an admin panel, **add these as new tabs/sections inside it** and reuse its existing auth gate instead of `lib/admin-auth.ts`. Keep each tab's component and server actions unchanged. Only change the auth check at the top of each server action and route to call the target's admin guard.
- Panel tabs that must exist: Content/Hero, Logos, Arena settings, Tournaments, SEO (+ blog/guide pages), Push notifications, Telegram (bots, sources, targets, filters, chat setup, step-by-step guide), Studio.

### Phase 7 — Special odds board (`/ozel-oranlar`)
- `lib/odds-parse.ts`: parses Telegram special-odds posts into structured matches (teams, league, kickoff time, market, old odds → boosted odds, partner site)
- `lib/deals.ts` + `lib/deal-types.ts`: deals store, including the parsed odds fields
- `components/alkanka/live-odds-board.tsx`: modern live board (SWR polling, auto-refresh, filters, countdown, partner logo, CTA)
- `app/(site)/ozel-oranlar/page.tsx`
- Behavior: nobody enters odds by hand. Posts from Telegram sources flagged as "özel oran" appear automatically on the board. Manual deals still work alongside them. Expired matches drop off.

### Phase 8 — Creative Studio (panel → Studio tab)
- `lib/studio.ts`, `lib/studio-types.ts`, `lib/studio-generate.ts`, `lib/studio-animate.ts`, `lib/brand-extract.ts`
- `app/api/studio/generate/route.ts`, `app/api/studio/animate/route.ts`, `app/api/studio/upload/route.ts`, `app/api/studio/file/[...path]/route.ts`, `app/api/studio/brand-screenshot/route.ts`
- `components/panel/studio.tsx`, `components/panel/studio-guide.tsx`
- Features to keep:
  - **Brand kits:** extract logo and colors from a domain. When a site blocks bots, it tries alternate addresses and falls back to public favicon/logo services. Admins can also upload a screenshot, which a vision model reads for brand colors and name.
  - **Asset library:** upload files or import from a link, stored in Blob.
  - **AI generation:** AI Gateway image model. The logo is composited by `sharp` **after** generation, and a clean logo-free copy is kept so revisions don't distort the logo. Supports formats/sizes and revision prompts.
  - **Animation:** a GIF built from frames with `sharp` (no ffmpeg needed) and AI video (Veo through AI Gateway; about 40 s per 4 s clip, so give the route `maxDuration` as in the source).
  - **Guide tab:** a step-by-step Turkish tutorial (`studio-guide.tsx`).
- Before you use them, check that the AI model IDs in `lib/studio-generate.ts` / `lib/studio-animate.ts` / `lib/brand-extract.ts` still exist: `curl -s https://ai-gateway.vercel.sh/v1/models | jq -r '.data[].id'`. If one was retired, swap in the newest model of the same family.

---

## 5. Merge rules when the target already has code

- **Same route exists:** keep the target's URL but replace its page body with the source component. Ask the human before you delete any target-only content.
- **Different design system:** the source's look (tokens in `globals.css`, fonts in `layout.tsx`) wins for the ported pages. Scope the source tokens under a wrapper class only if the human asks you to keep the old theme elsewhere.
- **Different auth:** keep the target's member auth if it already has users. Map `getMember()`/session calls in `lib/member.ts` to the target's session helper. Do not create a second user system.
- **Different DB client:** keep the source's `@neondatabase/serverless` client in a separate module. It can share the same `DATABASE_URL`.
- **Server-only vs client:** the source keeps client-safe types in `*-types.ts` files (`deal-types.ts`, `studio-types.ts`). Never import `lib/deals.ts`, `lib/studio.ts` or any module that touches the DB from a `"use client"` component.

---

## 6. Final verification checklist

Run all of these and report the results to the human:

1. `pnpm exec tsc --noEmit` returns 0 errors.
2. `pnpm build` succeeds.
3. `pnpm dev`, then open each URL and confirm it renders without console errors:
   `/`, `/oyunlar`, `/oyunlar/canli`, `/turnuvalar`, `/market`, `/gorevler`, `/siralama`, `/bonuslar`, `/kampanyalar`, `/firsatlar`, `/ozel-oranlar`, `/rehber`, `/sss`, `/tahminler`, `/sponsorlar`, `/biletler`, `/uygulama`, `/panel`, `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`
4. Members: sign up, log in, KC balance shows, and a mini game updates the balance server-side.
5. Live roulette: two browser windows see the same spin.
6. Panel: log in with `ADMIN_PASSWORD`, and every tab in Phase 6 opens and saves.
7. Telegram: add a bot in the panel, add a source and a target, and have the human send a test post. It mirrors to the target and appears on the site. A test "özel oran" post appears on `/ozel-oranlar`.
8. Studio: create a brand from a domain, upload an asset, generate one image, revise it (the logo stays sharp), and generate one GIF.
9. Push: subscribe in the browser and send a test push from the panel.

---

## 7. Copy-paste prompt for Cursor

> Read `CURSOR_PORT_GUIDE.md` in full. Clone `https://github.com/krsonee/alkanka-web-application-design` (branch `main`) into `../alkanka-source`. Port every feature into this project 1:1, following the phases in section 4 in order, the merge rules in section 5, and the stack in section 1. Copy files verbatim and only adjust imports, paths and the admin auth guard. Keep all Turkish UI text unchanged. After each phase run `pnpm exec tsc --noEmit` and fix every error. List the environment variables from section 3 that are missing and ask me for them. Do not invent values. At the end, run the full checklist in section 6 and give me a pass/fail report per item.
