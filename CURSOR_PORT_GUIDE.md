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

---

## 8. Round 2 changes (October 2026): done vs. remaining

Everything in this section lives in this file. **Do not create a separate notes file.** Update this section as you finish items.

### 8.1 Already done in the source repo (port 1:1)
| Feature | Files |
|---|---|
| SMTP mail helper (any provider, Alibaba DirectMail ready) | `lib/mail.ts` (dependency: `nodemailer`) |
| Mandatory email verification after signup (turns on automatically when SMTP env vars exist) | `lib/auth.ts` (`requireEmailVerification: mailEnabled`, `sendVerificationEmail`, `autoSignInAfterVerification`) |
| Forgot password + reset page | `lib/auth.ts` (`sendResetPassword`), `app/(site)/sifre-sifirla/page.tsx`, `components/alkanka/reset-password-form.tsx` |
| Signup modal: referral field replaced by optional phone, parrot image fits (`object-contain`), "Şifremi unuttum" link, verification notice | `components/alkanka/auth-modal.tsx` |
| DB: optional `phone` column on `"user"` | `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS phone text;` |
| Existing users marked verified so they are not locked out | `UPDATE "user" SET "emailVerified" = true WHERE "emailVerified" = false;` (run **once**, before setting SMTP env vars) |
| "Profilim" removed from the left menu (still in the profile dropdown) | `components/alkanka/data.ts` |
| KankaTV group renamed to "TV & Mizah & Haber" | `lib/kankatv.ts` |
| ✅ A1 Site search works (pages, sponsors, games; Ctrl K, arrow keys, Enter) | `components/alkanka/site-search.tsx`, used in `topbar.tsx` |
| ✅ H36 (part) Security headers: nosniff, Referrer-Policy, HSTS, Permissions-Policy, X-Frame-Options SAMEORIGIN on `/panel` | `next.config.mjs` |

### 8.2 Remaining work (do in this order, one PR per group)
Rules for every item: keep the current dark/gold theme and Turkish copy style. Hide "AL KANKA" / "alkanka.com" subtly in game tables (felt center, card backs, dealer tray, wheel hub). Test at 390x844 and 1440x900 with no page scroll during play.

**A. Quick site fixes: ✅ ALL DONE**
1. ✅ Site search (`components/alkanka/site-search.tsx`).
2. ✅ Filters can be deselected: clicking an active chip returns to "Tümü" (sponsor tier, bonus type, campaign tag) in `components/alkanka/partner-sites.tsx`.
3. ✅ Animated tier badges: VIP glows, Ana sponsor has a gold shine sweep (`.tier-shine` in `app/globals.css`), both respect `prefers-reduced-motion`.
4. ✅ Main sponsor shown on home, `/sponsorlar` and `/kampanyalar` (`MainSponsorRotator`).
5. ✅ "Detay / Kurallar" buttons higher contrast (`components/alkanka/detail-modal.tsx`).
6. ✅ Main sponsor rotator: one at a time, auto-rotates every 6 s, pauses on hover/focus, dot navigation. Rotation = main sponsor + other "ana"/featured sites (`pickFeatured().mains` in `lib/sites.ts`).
7. ✅ KankaTV offline state with Jako and "Şu anda yayın yapılmıyor" text (`components/alkanka/kankatv/board.tsx`).
8. ✅ KankaTV channels extended, group renamed "TV & Mizah & Haber" (`lib/kankatv.ts`).

**B. Top bar (badge, coin, radio): ✅ ALL DONE**
1. ✅ Username is separate: the account button shows only an avatar initial + name + chevron (`components/alkanka/topbar.tsx` `AccountMenu`).
2. ✅ Active badge (rank emblem) moved next to the Kanka Coin balance, slightly bigger, with pulse + shine animation; links to `/profil?sekme=rozetler` (`BadgeButton`, `.animate-badge-pulse` in `app/globals.css`).
3. ✅ Kanka Coin box made smaller (single line, `h-9`, "KC" suffix).
4. ✅ Animated radio button + "Kanka Radyo" panel: live Turkish stations (~200) from the free Radio Browser API via `app/api/radyo/route.ts` (6 h cache, 3 mirrors, HTTPS + non-HLS MP3/AAC only), search by name/genre, play/pause, mute, close; keeps playing across page navigation because it lives in the persistent top bar (`components/alkanka/radio-player.tsx`).

**C. Home & ranking design: ✅ DONE**
11. ✅ Podium with Jako, gold/silver/bronze, animated entrance on home and `/siralama` (`components/alkanka/top-three.tsx`).

**Round 3 fixes: ✅ DONE**
- ✅ Mode choice moved into the stake menu as a required step ("Oyun modunu seç *"); play button stays disabled until a mode is picked (`stake-gate.tsx`, `arena-stage.tsx`).
- ✅ Table chat emoji picker + one-tap emoji send (`table-chat.tsx`).
- ✅ Tournament bracket redesigned (`bracket-view.tsx`).

**D. Games (biggest group): items 12-16 and 18 ✅ DONE**
12. ✅ Smaller game cards on `/oyunlar`: 2/3/4/5-column grid, square cards, compact badges (`components/alkanka/games/games-hub.tsx`).
13. ✅ Mode choice ("Bota karşı / Oyuncuya karşı / Aynı cihaz") is required: nothing renders until one is picked (`arena-stage.tsx`, `mode` starts `null`).
14. ✅ Spectator view scales the board to fit the viewport, never upscales, no scrolling (`components/alkanka/arena/fit-to-screen.tsx`, used in `TableRoom`).
15. ✅ Table chat shared by players and spectators (`table_messages`, `app/api/tables/[id]/chat/route.ts`, `components/alkanka/arena/table-chat.tsx`): 300 chars max, rate-limited, server-side session check.
16. ✅ Server-enforced turn timer with auto random legal move on timeout (`lib/pvp/rules.ts`, `lib/pvp/tables.ts`, `app/api/tables/[id]/route.ts`).
18. ✅ Okey selection: drag-drop clears the selection, double-click no longer discards (only flips the okey tile), discard only via the "Taşı at" button or the "Buraya at" drop zone (`okey-rack.tsx`, `okey.tsx`).
17. ✅ Tavla: wood-grain frame, felt surface, 3D checkers, glowing selected checker, pulsing legal destination points, "Sıra sende / Rakipte" indicator (`components/alkanka/arena/tavla.tsx`, `.tavla-*` styles in `app/globals.css`). Verified by type check only; the board requires login so it was not screenshotted.
18. ✅ Okey selection behavior (see line above). Visual felt/tile realism can be polished further later.
19. ✅ Billiards: wood-grain rails with shading, felt noise texture, cushion shadows, deep pocket gradients with gold rims, centered "AL KANKA" logo (`components/alkanka/arena/bilardo.tsx`).
20. ✅ Roulette: live shared table + Jako croupier already existed; added "Son tur kazananları" panel (top 8 winners, username + amount) computed in `liveState().lastRound` (`lib/roulette-live.ts`, `WinnersPanel` in `roulette-live.tsx`). Original spec: one global live table. Server-driven rounds (betting window, then Jako croupier spins). Everyone sees the same result. Winners list (username + amount) beside the wheel after each round. Extend the existing `lib/roulette-live.ts`.
21. ✅ DONE — Blackjack: multiplayer tables with up to 6 seats side by side, shared dealer, server-driven rounds. (`lib/blackjack-live.ts`, `app/api/blackjack/route.ts`, `components/alkanka/arena/blackjack-live.tsx`; "Canlı masa / Tek başına" tabs on the game page.)
22. ✅ House games done: Çark, Zar and Sandık outcomes are now decided server-side with `crypto.randomInt` in `playMini()` (`app/actions/wallet.ts`). The client can no longer send its own reward amount. "Büyük ödül oranı" (default 40%) is editable in Panel → Oyunlar and stored as `arena:house`. PvP part: already 1/N with no bot bias. Original spec: PvP games use no house edge or bot bias, so each seat has equal odds (1/N). House games (zar, çark, gizemli kutu) target a 40% player / 60% house win rate. Make the rate configurable in the panel. All RNG goes through `crypto.randomInt`, server side only.
23. ✅ Touch pads already existed (pointer-capture buttons for left/right/jump/kick); enlarged to `size-20` on phones (`TouchPad` in `head-game.tsx`). Original spec: Mobile controls for Kafa Topu / Kafa Basketbolu: large touch zones (left/right swipe areas + jump tap) instead of small buttons.

**E. Tasks after day 7: ✅ DONE**
24. ✅ Real server-side 7-day streak check-in that repeats after day 7 (`daily_checkins` table, `lib/checkin.ts`, `checkInAction`), Turkey-time days, a missed day resets the streak. Tasks have `period` (once/daily/weekly/monthly) plus optional `starts_at`/`ends_at`; completions reset per period (`lib/task-period.ts`, `lib/tasks.ts`). Panel → Görevler form has Tekrar, Başlangıç and Bitiş fields, and the list shows the period and an expired badge (`components/panel/tasks-manager.tsx`). Original spec: Recurring tasks: daily, weekly and monthly pools that rotate after the 7-day starter track, plus streak rewards. Add a panel module to create, schedule and disable tasks manually.

**F. Panel**
25. Panel redesign: clear left nav grouped by area (Site, Üyeler, Oyunlar, Sponsorlar, Telegram, Ayarlar), consistent forms, search per table.
26. Header logo/text editor in the panel (logo upload + text fields, stored in DB, read by the topbar).
27. Mobile app icon upload in the panel (generates `icon-192/512` and the manifest icons).
28. Staff accounts: admins create staff users with per-module permissions (`staff(user_id, permissions jsonb)`). Every panel API checks the permission server-side.
29. TOTP 2FA (Google Authenticator) for all panel accounts. Admins can enable or disable it per account. Use `otplib`, store an encrypted secret, and provide backup codes.
30. Badges "Moderatör" and "Sponsor Destek", assignable only by admins or delegated staff. Holders earn no auto points, are excluded from rankings, cannot level up and cannot buy from the market. Enforce this server-side in KP, rank and market code.
31. Hidden member restrictions: daily win limit, daily game limit, market ban and market spend limit (`member_limits` table). Members never see them, and the server enforces them in game settle and market purchase.

**G. Telegram bots** (extend `lib/telegram-*`)
32. Post sharing bot: picks up a post from the sponsor support group, appends the alkanka link/text, posts it to the target channels and replies in the source group with the post link.
33. Special odds bot: mirrors special odds posts with our links and notes. When the result is marked won, it auto-posts "Özel oran kazandı".
34. Approval notifier: market purchases, completed tasks and complaints needing admin/mod approval are sent to a Telegram group with a template text.

**H. Security & audit**
35. Compare every panel setting with its site consumer and fix mismatches and dead fields.
36. Security pass: every write API checks the session and role. Zod-validate all inputs. Parameterized SQL only. Rate-limit auth, chat and game endpoints. Use the security headers in `next.config` (nosniff, Referrer-Policy, HSTS, X-Frame-Options SAMEORIGIN on the panel). Use `httpOnly` cookies and keep secrets server-only.

### 8.3 What the owner (user) must do: step by step
**MAIL KURULUMU (Türkçe, adım adım, hiç bilmeyen biri için)**

Bu kurulum bitince iki şey çalışır: (1) yeni üye kayıt olunca mailine "Hesabımı onayla" linki gider, onaylamadan giriş yapamaz. (2) "Şifremi unuttum" linkine basan üyeye şifre sıfırlama maili gider. Kod hazır. Mail ayarlarını girmediğin sürece site eskisi gibi mailsiz çalışır, hiçbir şey bozulmaz. Mevcut 10 üye zaten "onaylı" işaretlendi, onlar kilitlenmez.

Önce hangi yolu seçeceğine karar ver:
- **YOL A: Alibaba DirectMail.** Hesabın ve kredin var. Ucuz, ama Alibaba bazen kimlik ya da şirket doğrulaması istiyor ve bu birkaç gün sürebiliyor.
- **YOL B: Resend.** Ayda 3.000 mail ücretsiz. Kurulumu 15 dakika sürer, mailler spam'e düşmez. **Takılırsan bunu kullan.**

---

**YOL A: ALIBABA DIRECTMAIL**

*A1. Hizmeti aç*
1. Tarayıcıda `https://www.alibabacloud.com` adresine git. Sağ üstten **Log In**'e bas ve hesabınla gir.
2. Üstteki arama kutusuna `DirectMail` yaz, çıkan **DirectMail** sonucuna tıkla.
3. Açılan sayfada **Activate Now**, **Buy Now** ya da **Console** butonu görürsen ona bas. "Pay-As-You-Go" seçeneği çıkarsa onu seç, şartları onayla (kutucuğa tik), **Activate**'e bas.
4. Konsol açılınca sol üstte bir bölge (region) seçici var, genelde "Singapore", "Hangzhou" gibi yazar. **Singapore**'u seç. Bundan sonra hep bu bölgede kal.

*A2. Alan adını ekle*
5. Sol menüden **Email Settings**, sonra **Email Domains**'e tıkla. (Menü İngilizce değilse sağ üstten dili English yap.)
6. **New Domain** butonuna bas. Kutuya **sadece** `mail.alkanka.com` yaz (www yok, https yok). **OK**'e bas.
7. Listede `mail.alkanka.com` satırı belirir, durumu kırmızı ya da "To be verified" yazar. Satırın sağındaki **Configure** linkine bas.
8. Bir tablo açılır, 4 civarı satır olur. Her satırda üç bilgi var: **Type** (TXT, MX ya da CNAME), **Host Record / Name** (ör. `aliyundm.mail`, `mail`, `aliyun-ap-southeast-1._domainkey.mail`) ve **Record Value** (uzun bir yazı). **Bu sekmeyi kapatma.**

*A3. DNS kayıtlarını Vercel'e gir (alkanka.com Vercel'de olduğu için)*
9. Yeni bir sekmede `https://vercel.com` adresine gir ve hesabına giriş yap.
10. Üst menüden **Domains**'e tıkla. Görmüyorsan takım adının yanındaki menüden **Settings**, sonra **Domains**'e gir. Listede **alkanka.com**'a tıkla.
11. Sayfada **DNS Records** bölümünü bul. Bölümün altında boş bir satır olur: **Name**, **Type**, **Value**, **TTL**.
12. Alibaba'daki **her satır için** şunları yap:
    - **Type**: Alibaba'da ne yazıyorsa onu seç (TXT, MX ya da CNAME).
    - **Name**: Alibaba'daki **Host Record**'u yaz, ama **sonunda `.alkanka.com` varsa onu sil**. Örneğin `aliyundm.mail.alkanka.com` yazıyorsa sadece `aliyundm.mail` yaz.
    - **Value**: Alibaba'daki **Record Value**'yu kopyala-yapıştır yap. Başta ya da sonda boşluk kalmasın, tırnak işaretlerini de silme.
    - MX kaydında **Priority** diye bir kutu çıkarsa Alibaba'daki sayıyı yaz (genelde `10`).
    - **TTL**'ye dokunma. **Add**'e bas.
13. Bütün satırları ekleyince Alibaba sekmesine dön ve **Verify** butonuna bas. Hemen yeşile dönmezse panik yapma, 10-60 dakika bekle ve tekrar **Verify**'a bas. Satırların hepsi yeşil tik olunca devam et.
    - Bir satır uzun süre kırmızı kalırsa Name'e fazladan `.alkanka.com` ekleyip eklemediğine bak. En sık yapılan hata bu.

*A4. Gönderici adresini oluştur*
14. Alibaba sol menüden **Email Settings**, sonra **Sender Addresses**'e gir. **Create Sender Address**'e bas.
15. Formu şöyle doldur: **Email Domain**: `mail.alkanka.com`. **Account**: `noreply`. **Reply-To**: boş bırak ya da kendi mailini yaz. **Mail Type**: **Triggered Emails** (işlem maili). **OK**'e bas.
16. Listede `noreply@mail.alkanka.com` satırı çıkar. Sağındaki **SMTP Password**'e bas. En az 10 karakterli, büyük-küçük harf ve rakam içeren bir şifre yaz (ör. `AlKanka2026Mail`). **Bu şifreyi bir yere not et**, bir daha gösterilmez.
17. Alibaba yeni hesaplarda günlük gönderim limitini düşük tutabilir (ör. günde 200). Yeterli değilse aynı sayfada **Quota** ya da **Upgrade**'den arttırırsın.

*A5. Ayarları siteye gir*
18. v0'da sağ üstteki **ayarlar (dişli)** simgesine tıkla, sonra **Vars**'a gir.
19. **Add** / **New Variable** ile aşağıdaki 5 değişkeni tek tek ekle. Sol kutu = **Key**, sağ kutu = **Value**. Büyük-küçük harf aynı olmalı:

| Key | Value |
|---|---|
| `SMTP_HOST` | `smtpdm-ap-southeast-1.aliyun.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `noreply@mail.alkanka.com` |
| `SMTP_PASS` | 16. adımda not ettiğin şifre |
| `MAIL_FROM` | `AL KANKA <noreply@mail.alkanka.com>` |

   - Singapore dışında bir bölge seçtiysen SMTP_HOST farklıdır. Alibaba'da **Sender Addresses** sayfasında "SMTP address" diye yazar, oradakini kullan.
20. Kaydet. Sonra **Publish**'e basıp yeniden yayınla. Vercel'den yapıyorsan **Project**, **Settings**, **Environment Variables**'a aynı 5 satırı ekle, **Production** tikini işaretle, sonra **Deployments** sekmesinde en üstteki satırın **...** menüsünden **Redeploy**'a bas.

---

**YOL B: RESEND (takılırsan bunu kullan)**
1. `https://resend.com` adresine gir, **Sign Up** ile Google hesabınla kayıt ol.
2. Soldan **Domains**'e gir, **Add Domain**'e bas. `mail.alkanka.com` yaz, Region'da **EU (Ireland)**'ı seç, **Add**'e bas.
3. Ekranda 3-4 DNS kaydı çıkar (MX, TXT, TXT). Yukarıdaki **A3** adımlarının aynısını yap: Vercel'de alkanka.com'un **DNS Records** bölümüne her birini Type / Name / Value olarak gir. Name'de sonda `.alkanka.com` varsa sil.
4. Resend'de **Verify DNS Records**'a bas. Birkaç dakika içinde **Verified** olur.
5. Soldan **API Keys**'e gir, **Create API Key**'e bas. Name: `alkanka`, Permission: **Sending access**, Domain: `mail.alkanka.com`. **Add**'e bas. Çıkan `re_...` ile başlayan anahtarı kopyala, bir daha gösterilmez.
6. v0'da **Ayarlar**, sonra **Vars**'a gir ve şunları ekle:

| Key | Value |
|---|---|
| `SMTP_HOST` | `smtp.resend.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `resend` |
| `SMTP_PASS` | 5. adımdaki `re_...` anahtarı |
| `MAIL_FROM` | `AL KANKA <noreply@mail.alkanka.com>` |

7. **Publish** ile yeniden yayınla.

---

**TEST (iki yolda da aynı)**
1. Gizli sekme aç (Ctrl+Shift+N), `alkanka.com`'a gir.
2. **Kayıt ol**'a bas ve daha önce kullanmadığın bir mail adresiyle kayıt ol. Ekranda "mailini kontrol et" uyarısı çıkmalı.
3. Mail kutuna bak, gelmediyse **Spam / Gereksiz** klasörüne de bak. "Hesabımı onayla" butonuna bas, site açılıp seni içeri almalı.
4. Çıkış yap. **Giriş yap**'a, sonra **Şifremi unuttum**'a bas. Aynı maili yaz, gelen maildeki linke tıkla, yeni şifreni belirle ve yeni şifreyle giriş yap.
5. Mail hiç gelmiyorsa: Vars'taki 5 değişkeni harf harf kontrol et (başta/sonda boşluk olmasın), Publish yaptığından emin ol, Alibaba'da domain satırlarının hepsinin yeşil olduğuna bak. Yine olmuyorsa YOL B'ye geç.

**Telegram bots:** create each bot with @BotFather (`/newbot`), add it as **admin** to every source/target channel and group, and paste the token into the panel's Telegram tab.

**2FA (after item 29 is built):** install Google Authenticator on your phone. In the panel open Profile, then 2FA, then **Etkinleştir**, scan the QR code and enter the 6-digit code. Store the backup codes somewhere safe.

### 8.4 Prompt for Cursor (round 2)
> Read `CURSOR_PORT_GUIDE.md`, especially section 8. First port everything in 8.1 1:1 (copy files with shell commands, run the two SQL statements once, `pnpm add nodemailer`). Then implement 8.2 groups A to H in order, one commit per item, keeping the existing theme, Turkish copy and file locations. Enforce all game, limit, badge and permission rules on the server. After each group run `pnpm exec tsc --noEmit` and `pnpm build`, and test at 390x844 and 1440x900. Mark each finished item in section 8.2 of this same file with ✅ and never create a separate notes file. Ask me for any missing env var instead of inventing it. Never delete existing data.
