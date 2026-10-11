# Cursor Port Guide: ALKANKA Site + Admin Panel

**Audience:** Cursor (AI agent) working inside the TARGET project, which is the user's live site and admin panel.
**Source of truth:** GitHub repo `https://github.com/krsonee/alkanka-web-application-design`, branch `main`.

Copy every feature from the source repo into the target project **1:1**: same behavior, UI, routes, database tables and Turkish text. Do not redesign, simplify, rename, reformat or "improve" anything unless a step below says so. If the target already has an equivalent file, merge the source logic into it. Never drop source logic silently.

> **Why this guide is strict:** earlier ports lost details because code was retyped or summarized instead of copied. Copy files with shell commands only (`cp` / `rsync`). Never retype code or paste it by hand. Prove each copy with the byte-for-byte check in section 0.3.

---

## 0. Ground rules for Cursor (read first, obey always)

### 0.1 Get the source
```bash
git clone https://github.com/krsonee/alkanka-web-application-design.git ../alkanka-source
cd ../alkanka-source && git checkout main && git pull && cd -
```
If `../alkanka-source` already exists, run `git -C ../alkanka-source pull` instead.

### 0.2 Copy with the shell, never by retyping
- Copy each file or folder with `cp -R` / `rsync -a`, for example:
  ```bash
  rsync -a ../alkanka-source/components/alkanka/ ./components/alkanka/
  cp ../alkanka-source/lib/site-texts.ts ./lib/site-texts.ts
  ```
- **Do NOT** open a source file and rewrite it from memory. **Do NOT** shorten files, remove comments, reorder code, rename variables, change quotes or run a formatter on copied files.
- Only edit a copied file when it is truly required: an import path differs in the target, or the admin auth guard must be swapped (section 5). Write each such edit down so you can list it in the final report.
- Keep the `@/` import alias (`"@/*": ["./*"]` in `tsconfig.json`). If the target uses `src/`, put files under `src/` and point the alias there. Do not change the import statements themselves.

### 0.3 Byte-for-byte verification (mandatory after every phase)
After copying, every source file must be identical to the target file, except the files you deliberately edited and listed. Run:
```bash
for f in $(cd ../alkanka-source && git ls-files app components lib public next.config.mjs package.json); do
  if [ ! -f "$f" ]; then echo "MISSING  $f";
  elif ! cmp -s "../alkanka-source/$f" "$f"; then echo "DIFFERENT $f"; fi
done
```
- Every `MISSING` line is a bug. Copy the file.
- Every `DIFFERENT` line must be a file you deliberately edited (import path or auth guard). Otherwise copy it again from source.
- Paste the final output of this script in your report.

### 0.4 Other rules
1. Work through the phases in section 4 **in order**. After each phase run `pnpm exec tsc --noEmit`, then the script in 0.3, and fix every problem before moving on.
2. Never touch, print or invent secrets. Ask the human for environment variable values (section 3).
3. Keep all user-facing text in **Turkish**, exactly as in the source, including Turkish characters (ç, ğ, ı, İ, ö, ş, ü). Files must stay UTF-8.
4. Never drop or alter existing production data. If a table already exists with different columns, stop and report it (section 2).
5. When finished, run the full checklist in section 6 and report pass/fail for each item.

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

Install dependencies with the **exact versions** from the source `package.json`. The simplest correct way is to copy the `dependencies` / `devDependencies` entries the target is missing, then run `pnpm install`:

```bash
pnpm add @base-ui/react @neondatabase/serverless @vercel/analytics @vercel/blob ai better-auth \
  class-variance-authority clsx drizzle-orm lucide-react pg sharp swr tailwind-merge tw-animate-css web-push shadcn
pnpm add -D @types/pg @types/web-push @tailwindcss/postcss tailwindcss postcss
```
Then check that every version in the target `package.json` matches the source.

If the target is on Next.js 14/15, upgrade to 16 first. The source awaits `params`, `searchParams`, `cookies()` and `headers()` everywhere.

---

## 2. Database

The source **creates its own tables at runtime** with `CREATE TABLE IF NOT EXISTS ...` inside the `lib/*` modules. An "ensure" function runs on first use, so no migration files are needed. Point `DATABASE_URL` at the target Postgres and the tables appear on the first request.

Tables created automatically (complete list in the current source):

| Area | Tables |
|---|---|
| Site content / texts / SEO / blog / share / ads | `site_content` (also stores the editable site texts, ads and share-preview settings as JSON keys), `seo_settings`, `blog_posts` |
| Deals & special odds | `deals`, `odds_alerts` |
| Mobile app / push | `app_installs`, `push_config`, `push_subscriptions`, `push_log` |
| Telegram mirror, chat, channels, invites | `tg_bots`, `tg_sources`, `tg_targets`, `tg_settings`, `tg_log`, `tg_chat_messages`, `tg_links`, `tg_link_codes`, `tg_channel_threads`, `tg_channel_comments`, `tg_table_invites` |
| Kanka Puan (KP) levels & badges | `kp_settings`, `kp_events`, `kp_awards`, `kp_badges` |
| Points market | `market_items`, `market_requests` |
| Community: prediction league, referrals, trust center | `league_matches`, `league_picks`, `ref_codes`, `referrals`, `complaints`, `site_reviews` |
| Creative studio | `studio_brands`, `studio_assets`, `studio_jobs` |
| Members / wallet / arena | better-auth tables + tables in `lib/db/index.ts`, `lib/member.ts`, `lib/arena-server.ts`, `lib/pvp/tables.ts`, `lib/tournaments.ts` |

Better Auth tables (`user`, `session`, `account`, `verification`) must exist. Run `npx @better-auth/cli migrate` against the target DB, or copy the schema from `lib/db/index.ts`.

If the target already has tables with the same names but different columns, **stop and report to the human**. Do not drop or rename anything, and do not alter columns without permission.

---

## 3. Environment variables

Ask the human to set these in the target hosting (Vercel → Project → Settings → Environment Variables). Never hardcode them.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection (Neon pooled URL) |
| `BETTER_AUTH_SECRET` | yes | Member auth secret (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | yes in prod | Public base URL of the site, e.g. `https://example.com` |
| `NEXT_PUBLIC_SITE_URL` | yes | Same public URL, used for SEO, sitemap, referral and invite links |
| `ADMIN_PASSWORD` | yes | Password for `/panel` |
| `BLOB_READ_WRITE_TOKEN` | yes | Vercel Blob (studio assets, logos, uploads, ad images) |
| `CRON_SECRET` | yes | Protects `/api/cron/telegram` |
| `AI_GATEWAY_API_KEY` | only if NOT hosted on Vercel | AI Gateway auth. On Vercel, OIDC handles it automatically |

These are **not** environment variables: Telegram bot tokens, channel IDs, invite settings, KP rules, market items, site texts, ads and share settings. The admin enters them in the panel and they are stored in the database. Web-push VAPID keys are generated automatically and stored in `push_config`.

The source uses `V0_*`, `VERCEL_URL` and `VERCEL_PROJECT_PRODUCTION_URL` only as fallbacks for detecting the site URL. Leave them in. They are harmless outside v0.

---

## 4. Port order (phases)

Copy each listed path from `../alkanka-source` into the same path in the target. A path ending in `/` means the whole folder (use `rsync -a`).

### Phase 1: Foundation
- `app/layout.tsx`: merge fonts, metadata, `<html className="bg-background">`, the providers (brand/logo/points context, PWA provider) and `@vercel/analytics`
- `app/globals.css`: copy the whole file (design tokens `:root`, `.dark`, `@theme inline`, and all custom keyframes/utilities)
- `app/error.tsx`, `app/loading.tsx`, `app/not-found.tsx`
- `components/ui/`
- `lib/utils.ts`, `lib/db/index.ts`, `lib/auth.ts`, `lib/auth-client.ts`, `lib/admin-auth.ts`
- `app/api/auth/[...all]/route.ts`, `app/api/me/route.ts`
- `next.config.mjs`: merge the `headers()` block (service worker headers), `images.unoptimized` and any `serverExternalPackages`
- `public/`: copy **everything** (`rsync -a ../alkanka-source/public/ ./public/`): logos, Jako mascot images, banners, game art, promo images, PWA icons, `sw.js`, `postlar/`

### Phase 2: Public site (route group `app/(site)/`)
- `app/(site)/`: copy the whole folder, including `layout.tsx`, `page.tsx` and every subfolder: `biletler`, `bonuslar`, `firsatlar` (+ `[slug]`), `gorevler`, `guven`, `kampanyalar`, `kankatv`, `market`, `oyunlar` (+ `[oyun]`, `canli`), `ozel-oranlar`, `profil`, `rehber` (+ `[slug]`), `rozetler`, `siralama`, `sponsorlar`, `sss`, `tahminler`, `turnuvalar`, `uygulama`
- `components/alkanka/`: copy the whole folder, including the subfolders `app/`, `arena/`, `games/`, `community/`, `kankatv/`, `kp/`, `profile/`
- `lib/content.ts`, `lib/casino.ts`, `lib/site-registry.ts`, `lib/logo-registry.ts`, `lib/blog.ts`, `lib/seo.ts`, `lib/deals.ts`, `lib/deal-types.ts`, `lib/split-match.ts`
- `app/logolar/`, `app/maskot/`, `app/postlar/`
- `app/sitemap.ts`, `app/robots.ts`, `app/manifest.ts`
- `app/api/logo/[name]/route.ts`, `app/api/logo-upload/route.ts`

### Phase 3: Members, wallet (KC), games, arena
- `lib/member.ts`, `lib/arena.ts`, `lib/arena-server.ts`, `lib/pvp/`, `lib/roulette-live.ts`, `lib/tournaments.ts`, `lib/tournaments-shared.ts`, `lib/bracket.ts`, `lib/table-invite.ts`
- `app/actions/`: copy the whole folder (`app.ts`, `arena.ts`, `chat.ts`, `community.ts`, `market.ts`, `wallet.ts`)
- `app/api/rulet/route.ts`, `app/api/tables/` (whole folder, including `[id]`, `live`, `invite`)
- `app/davet/[code]/route.ts` (referral / table invite redirect)
- Behavior to keep:
  - Real membership with a server-side KC wallet. **Guests do not see a KC balance**, and guest-only pages show the guest gate with the Jako signup prompt (`components/alkanka/guest-gate.tsx`).
  - Daily mini games (wheel, chest, dice) live **inside Tasks** (`/gorevler`, `components/alkanka/daily-games.tsx`) with cooldowns.
  - Shared live roulette table with croupier Jako, realistic blackjack, Head Ball, Okey (2/4 seats, bots, teams, discard drop zone, double-tap discard, joker flip, drag-to-finish), Tavla, Bilardo, PvP stake tables, live spectator lobby, tournaments with simultaneous rounds and a bracket view.
  - Table invite button: posts an invite to the Telegram group, with a cooldown (`invite-button.tsx`, `api/tables/invite`).
  - All games must be playable on mobile (touch controls, no horizontal overflow at 390px width).

### Phase 4: Kanka Puan (KP) levels, badges, ranks and leaderboards
- `lib/kanka-puan.ts`, `lib/kanka-puan-shared.ts`
- `app/api/kp/ping/route.ts`, `app/api/ranks/route.ts`
- `components/alkanka/kp/` (`emblem.tsx`, `heartbeat.tsx`, `member-rank.tsx`), `components/alkanka/rank-boards.tsx`, `components/alkanka/leaderboard.tsx`
- `app/(site)/rozetler/page.tsx`, `app/(site)/siralama/page.tsx`, `app/(site)/profil/page.tsx`, `components/alkanka/profile/account-settings.tsx`
- Panel: `app/panel/kp-actions.ts`, `components/panel/kp-manager.tsx`
- Behavior: KP levels with per-level emblem symbols, valuable/special badges managed in the panel, member rank shown next to names across the whole site, daily/weekly/monthly KP and prediction leaderboards with champions.

### Phase 5: Points market
- `lib/market.ts`, `app/actions/market.ts`, `components/alkanka/points-market.tsx`, `app/(site)/market/page.tsx`
- Panel: `app/panel/market-actions.ts`, `components/panel/market-manager.tsx`
- Behavior: DB-backed market items (including sponsor bonuses). Members spend KC to send a request, and the admin approves or rejects it in the panel. Market tabs must not overflow on mobile.

### Phase 6: Community (prediction league, referrals, trust center)
- `lib/community.ts`, `app/actions/community.ts`, `components/alkanka/community/` (whole folder)
- `app/(site)/tahminler/page.tsx`, `app/(site)/guven/page.tsx`
- Panel: `app/panel/community-actions.ts`, `components/panel/community.tsx`, `components/panel/community-guide.tsx`, `components/panel/fixture-picker.tsx`
- Behavior: prediction league with a fixture picker showing team logos and auto-settlement, referral codes and links (`/davet/[code]`), and a trust center with complaint/review forms and moderation in the panel.

### Phase 7: KankaTV
- `lib/kankatv.ts`, `app/api/kankatv/` (whole folder: `route.ts`, `channels/`, `game/`), `components/alkanka/kankatv/board.tsx`, `app/(site)/kankatv/page.tsx`
- Behavior: live scores for all leagues, upcoming matches, basketball and volleyball, free TV channel streams and Kick slot/sports streams.

### Phase 8: Mobile app (PWA) & push
- `lib/app-config.ts`, `lib/push.ts`
- `components/alkanka/app/` (install guide, install bonus prompts, PWA provider, site tour)
- `app/panel/push-actions.ts`, `components/panel/push-sender.tsx`
- `public/sw.js` must be served from the site root, with the headers from `next.config.mjs`.
- **Mobile app and mobile browser must stay in sync.** Both read the same server data (same DB, same API routes, same session cookie), so do not add any local-only storage for texts, balances or settings. A change in the panel must show up the same way in the installed PWA and in a mobile browser.

### Phase 9: Telegram (mirror bot, live chat, channels, invites)
- `lib/telegram-mirror.ts`, `lib/telegram-filters.ts`, `lib/telegram-chat.ts`, `lib/telegram-channels.ts`, `lib/telegram-channels-shared.ts`, `lib/table-invite.ts`
- `app/api/telegram/webhook/route.ts`, `app/api/cron/telegram/route.ts`, `app/api/chat/route.ts`, `app/api/chat/channel/route.ts`
- `components/alkanka/use-chat-feed.ts`, `components/alkanka/live-rail.tsx`
- Panel: `app/panel/telegram-actions.ts`, `components/panel/telegram-mirror.tsx`, `components/panel/telegram-guide.tsx`, `components/panel/telegram-chat-setup.tsx`, `components/panel/telegram-channels-setup.tsx`, `components/panel/telegram-invite-setup.tsx`
- Add the cron to the target `vercel.json` (create the file if it does not exist), then confirm the interval with the human:
  ```json
  { "crons": [{ "path": "/api/cron/telegram", "schedule": "*/5 * * * *" }] }
  ```
- Behavior to keep:
  - Multiple bots and source channels managed from the panel, with preset post filters per source.
  - Mirrored posts go to target channels and to the site.
  - The live chat rail is two-way with the real Telegram group and supports **multiple channels as tabs**. Channel tabs are **only for members**, and members can comment on channel posts (`tg_channel_threads`, `tg_channel_comments`).
  - Posts tagged as special odds are parsed into deals (Phase 11).

### Phase 10: Admin panel (`/panel`)
- `app/panel/`: copy the whole folder (`page.tsx`, `actions.ts`, `arena-actions.ts`, `community-actions.ts`, `kp-actions.ts`, `market-actions.ts`, `push-actions.ts`, `seo-actions.ts`, `studio-actions.ts`, `telegram-actions.ts`)
- `components/panel/`: copy the whole folder
- If the target already has an admin panel, **add these as new tabs inside it** and reuse its existing auth gate instead of `lib/admin-auth.ts`. Keep each tab's component and server actions unchanged. Only change the auth check at the top of each server action/route to call the target's admin guard.
- Panel tabs that must exist and save correctly: Content/Hero, **Site Texts (Metinler)**, Ads, Share preview, Logos, Arena settings, Tournaments, KP (levels/badges), Market, Community (league/referrals/trust), SEO (+ blog/guide pages), Push, Telegram (bots, sources, targets, filters, chat setup, channels, invites, guide), Studio.

### Phase 11: Special odds board (`/ozel-oranlar`)
- `lib/odds-parse.ts`, `lib/deals.ts`, `lib/deal-types.ts`, `components/alkanka/live-odds-board.tsx`, `app/(site)/ozel-oranlar/page.tsx`
- Behavior: nobody enters odds by hand. Telegram posts flagged as "özel oran" appear automatically. Manual deals still work alongside them, odds alerts are supported, and expired matches drop off.

### Phase 12: Creative Studio (panel → Studio tab)
- `lib/studio.ts`, `lib/studio-types.ts`, `lib/studio-generate.ts`, `lib/studio-animate.ts`, `lib/brand-extract.ts`
- `app/api/studio/` (whole folder: `generate`, `animate`, `upload`, `file/[...path]`, `brand-screenshot`)
- `components/panel/studio.tsx`, `components/panel/studio-guide.tsx`
- Features to keep: brand kits (domain extraction with fallbacks, screenshot vision, **brand mascot**), Blob asset library, AI generation with the logo composited by `sharp` after generation (clean copy kept for revisions), GIF animation via `sharp` and AI video (keep route `maxDuration`), Turkish guide tab.
- Check the AI model IDs used in `lib/studio-generate.ts`, `lib/studio-animate.ts` and `lib/brand-extract.ts` still exist: `curl -s https://ai-gateway.vercel.sh/v1/models | jq -r '.data[].id'`. If one was retired, swap in the newest model of the same family and report it.

### Phase 13: Panel-editable site texts, ads and share preview (newest feature, copy with extra care)
This feature lets the admin change texts and numbers on the site (for example "250 Kanka Coin", "Her 6 saatte bir", "14.2K üye", "Her pazar 21:00", "250.000 Kanka Coin havuz") from the panel without regenerating images.
- `lib/site-texts-shared.ts`: the list of editable keys, their Turkish default values and their groups. Client-safe.
- `lib/site-texts.ts`: server-only read/write in `site_content`.
- `components/alkanka/texts-context.tsx`: React context that provides texts to client components (`useSiteTexts()` / `t(key)`), with `{placeholder}` interpolation.
- `components/panel/texts-editor.tsx`: the panel "Metinler" tab, with grouped fields, defaults shown, a reset option and save.
- `lib/ads.ts`, `components/alkanka/ad-frame.tsx`, `components/panel/ads-editor.tsx`: ad slots managed from the panel.
- `lib/share.ts`, `components/panel/share-editor.tsx`: link share preview (OG) settings.
- Wiring (already present in the copied files, do not remove it):
  - `app/(site)/layout.tsx` loads the texts on the server and wraps the site in the texts provider.
  - `components/alkanka/events.tsx` (hero slider: wheel, Telegram, weekly raffle cards, countdown cards), `components/alkanka/auth-modal.tsx` (Jako welcome lines, "KAYIT OL, 250 KC KAP" button), `components/alkanka/app/site-tour.tsx`, the campaigns hero (`app/(site)/kampanyalar/page.tsx`, `components/alkanka/campaign-hub.tsx`) and `lib/member.ts` (signup bonus amount) read from these texts.
  - `app/panel/page.tsx` + `app/panel/actions.ts` contain the tab and the save actions. `components/panel/content-editor.tsx` links to it.
- Rule: if a number is editable in the panel (e.g. the signup bonus), the server logic must use the **same stored value**, not a hardcoded one. Do not replace any `t(...)` call with a literal string.

---

## 5. Merge rules when the target already has code

- **Same route exists:** keep the target's URL but replace the page body with the source component. Ask the human before deleting target-only content.
- **Different design system:** the source look (`globals.css` tokens, fonts in `layout.tsx`) wins for the ported pages. Scope source tokens under a wrapper class only if the human asks to keep the old theme elsewhere.
- **Different auth:** keep the target's member auth if it already has users. Map `getMember()`/session calls in `lib/member.ts` to the target's session helper. Do not create a second user system.
- **Different DB client:** keep the source `@neondatabase/serverless` client in a separate module. It can share the same `DATABASE_URL`.
- **Server-only vs client:** client-safe code lives in `*-types.ts` / `*-shared.ts` files (`deal-types.ts`, `studio-types.ts`, `kanka-puan-shared.ts`, `site-texts-shared.ts`, `telegram-channels-shared.ts`, `tournaments-shared.ts`). Never import a DB-touching `lib/*` module from a `"use client"` component.
- **Removed on purpose:** the standalone dice game page was removed (dice now lives inside Tasks). Do not re-add any feature the source removed. If a file exists in the target but was deleted in the source, ask the human before deleting it.

---

## 6. Final verification checklist

Run all of these and report pass/fail for each:

1. The byte-for-byte script (0.3) shows **no `MISSING`**, and every `DIFFERENT` file is on your list of deliberate edits.
2. `pnpm exec tsc --noEmit` returns 0 errors.
3. `pnpm build` succeeds.
4. `pnpm dev`, then open each URL and confirm it renders without console errors:
   `/`, `/oyunlar`, `/oyunlar/canli`, `/turnuvalar`, `/market`, `/gorevler`, `/siralama`, `/rozetler`, `/profil`, `/guven`, `/kankatv`, `/bonuslar`, `/kampanyalar`, `/firsatlar`, `/ozel-oranlar`, `/rehber`, `/sss`, `/tahminler`, `/sponsorlar`, `/biletler`, `/uygulama`, `/panel`, `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`
5. Mobile: set the viewport to 390x844 and recheck `/`, `/oyunlar`, one game page, `/market` and `/gorevler`. There must be no horizontal scroll, and the games must be playable by touch.
6. Members: sign up and receive the signup bonus shown on the button. Log in and confirm the KC balance shows (and is hidden for guests). A daily game in Tasks updates the balance server-side.
7. Live roulette: two browser windows see the same spin.
8. Panel: log in with `ADMIN_PASSWORD`. Every tab listed in Phase 10 opens and saves.
9. **Site texts:** in the panel's Metinler tab, change the signup bonus and the "Her 6 saatte bir" line, then save. Confirm the new values appear on the home slider, in the signup modal and on the signup button. Confirm the bonus actually credited on signup matches. Check the same pages in a mobile browser and in the installed PWA.
10. Telegram: add a bot, a source and a target. A test post mirrors and shows on the site. A test "özel oran" post appears on `/ozel-oranlar`. Channel tabs in the live rail are visible to members only.
11. KP / market / community: award KP and see the rank update, send a market request and approve it in the panel, add a league fixture, and submit and moderate a complaint.
12. Studio: create a brand, upload an asset, generate an image, revise it (the logo stays sharp), and generate one GIF.
13. Push: subscribe in the browser and send a test push from the panel.

---

## 7. Copy-paste prompt for Cursor

> Read `CURSOR_PORT_GUIDE.md` in full before doing anything. Clone or pull `https://github.com/krsonee/alkanka-web-application-design` (branch `main`) into `../alkanka-source`. Port every feature into this project 1:1, following the phases in section 4 in order, the merge rules in section 5 and the stack in section 1. Copy files only with shell commands (`cp` / `rsync`). Never retype, summarize, shorten or reformat source code. Only edit copied files to fix import paths or swap in this project's admin auth guard, and keep a list of every edited file. Keep all Turkish UI text and characters unchanged. After each phase, run `pnpm exec tsc --noEmit` and the byte-for-byte script from section 0.3, and fix every problem before continuing. List the environment variables from section 3 that are missing and ask me for them. Do not invent values. Never drop or alter existing database data. At the end, run the full checklist in section 6 and give me a pass/fail report per item, plus the final output of the byte-for-byte script and your list of edited files.
