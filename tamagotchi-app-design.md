# PocketPet — Simple Design

**Stack: Plain HTML + CSS + JavaScript, hosted on GitHub Pages, backed by Supabase (Postgres + Auth).**
No build step, no framework, no bundler, no image assets. `index.html` + a handful of `.js`/`.css` files, served static.

---

## 1. Why no framework, why no art assets

This app is one screen: a pet, five stat bars, a few buttons.

- No build step — edit a file, refresh the browser.
- `fetch`/`setInterval`/DOM updates are enough; nothing here needs a reactive framework.
- Supabase ships a CDN `<script>` — no bundler needed to use it.
- **Pet visuals are procedural pixel dots, not sprite sheets.** The pet is drawn as an on/off dot grid (like the original Tamagotchi's dot-matrix LCD), computed from simple shape math (ellipse + a few feature dots for ears/arms/legs) and rendered via CSS. Zero image files to create, host, or cache — the entire pet is a few dozen lines of JS. Swapping in real sprite art later is possible but not required.

Cross-device sync (log in on a second device, continue the same pet) is the one requirement that needs a real backend — that's why Supabase stays. Everything else stays local/static.

---

## 2. Product Description

A pocket virtual pet as a simple web app: sign up/log in, name your pet, feed/play/clean/sleep it, watch it grow through life stages, and continue the same pet from any device you log into.

**Core loop:** open app → log in → read pet's needs → interact → stats change → pet evolves over time

---

## 3. Core Features

- **Stats** (0–100): Hunger, Happiness, Energy, Health, Hygiene
- **Life stages:** egg → baby → child → teen → adult (age + care based — neglect delays evolution, doesn't reverse it)
- **Actions:** Feed, Play, Clean, Sleep toggle, Medicine (when sick)
- **Economy:** limited Food stock (`food_count`) gates Feed; Coins (`coins`) buy more Food; earned by playing the mini-game
- **Mini-game:** reaction-tap — 5 rounds, a target dot appears briefly and disappears if not clicked in time; hits earn coins
- **Decay:** stats drop on a real-time schedule, computed from elapsed time on load — see §6
- **Neglect:** stats hitting 0 drag health down; health recovers on its own once every stat is back above 0 (unless sick — that needs Medicine); health hitting 0 → sickness
- **Animations:** pixel-dot chick with a 2-frame walk cycle (feet alternate) plus wandering around the screen and a bounce on successful actions
- **Settings screen:** change password, reset pet to a fresh egg, sign out
- **In-app tutorial:** a small "?" toggle explaining the rules, plus a live "evolves in Xm" progress line
- **Landing page:** static marketing page (`index.html`) with a pet preview and a Play button into the app (`app.html`)
- **Auth:** Supabase email/password login, required (so the pet isn't tied to one browser)
- **Persistence:** one row per pet in Supabase Postgres, scoped by Row Level Security
- **Pixel-dot rendering:** pet drawn as a procedural dot-matrix bitmap, no image files

Cut for MVP: social/leaderboards, push notifications, PWA/offline, sound.

---

## 4. File Structure

```
/PocketPet
  index.html        # landing/marketing page — pet preview + "Play" link into app.html
  landing.js         # renders the static preview pet on the landing page
  app.html            # the actual game: login, pet view, stats, actions, settings
  style.css          # shared retro LCD / monochrome styling for both pages
  app.js             # state machine: (stats, elapsedTime, action) -> new stats; DOM wiring
  supabase.js         # Supabase client init, auth, read/write pet row
  pet-sprites.js       # procedural pixel-dot bitmap generator (no image assets)
```

No `node_modules`, no `package.json`, no `/sprites` or `/sounds` folders. Deploy = push these files and serve via GitHub Pages (`main` branch, `/root`).

---

## 5. Data Model (Supabase `pets` table)

```sql
create table pets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null default 'Mochi',
  life_stage text not null default 'egg',
  hunger int not null default 100,
  happiness int not null default 100,
  energy int not null default 100,
  health int not null default 100,
  hygiene int not null default 100,
  is_sick boolean not null default false,
  is_sleeping boolean not null default false,
  coins int not null default 20,
  food_count int not null default 3,
  birth_timestamp timestamptz not null default now(),
  last_updated timestamptz not null default now()
);

alter table pets enable row level security;

create policy "Users can manage their own pet"
  on pets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

One row per user (enforced in app logic: create-if-missing on first login). `last_updated` drives the decay calculation on every load (§6).

---

## 6. Time/Decay Mechanic

Browsers don't run JS while a tab is closed, so time passing is simulated on load, not ticked live:

1. On login/load, fetch the pet row; read `last_updated`.
2. `elapsedHours = (now - last_updated) / 1hr`.
3. Apply decay deterministically over that elapsed time, floored at 0 (sleeping halves decay and regenerates energy instead).
4. Recompute life stage from age + current health.
5. Write recalculated stats + `last_updated = now` back to Supabase.
6. Show a "while you were away" recap of what changed.

---

## 7. Pixel-Dot Pet Rendering

- Grid: 15×15 boolean/int matrix per frame, rendered as a CSS grid of dots (0 = off, 1 = body, 2 = eye).
- Shape = an ellipse (radius grows with life stage) plus a few fixed feature dots — ears, arms, legs, antenna — toggled on per stage so egg → adult reads as a size/complexity progression.
- Mood is conveyed with CSS, not new bitmaps: sick = hue-shift filter, sleeping = dimmed + closed eyes, blink = eyes toggle off every few seconds via `setInterval`.
- This keeps 100% of the pet's visuals in code — no art pipeline, no asset loading, nothing to break offline.

---

## 8. Security Notes (public deploy on GitHub Pages)

- Repo is public → `supabase.js` with the URL + anon key is public. This is safe **only if RLS is enabled on every table** (§5) — the anon key can't bypass RLS. Never commit a `service_role` key anywhere in this repo.
- Client computes decay using the browser's clock and writes back through the anon-key client — a user can edit their own stats via devtools or fake elapsed time via their system clock. Fine for a single-player MVP (only cheats their own pet, RLS prevents touching anyone else's row). If leaderboards/social are ever added, move decay into a Postgres `security definer` RPC using the DB's `now()`, and revoke direct table `UPDATE`.
- In Supabase Auth settings, restrict the **Site URL / Redirect URLs** to the actual GitHub Pages origin (`https://<user>.github.io/<repo>/`) so auth email links can't be pointed elsewhere.
- Enable Supabase's built-in email confirmation on sign-up (default) to cut down on throwaway/bot accounts against the free tier.
- Enable Supabase's leaked-password protection and keep the default rate limits on auth endpoints (dashboard → Auth → Settings) — no extra code needed, just don't turn them off.

---

## 9. Cost / Free-Tier Notes

- GitHub Pages + Supabase free tier: $0 at hobby scale (500 MB DB, 50k MAU, 5 GB egress/mo) — one small table with tiny rows won't come close.
- Supabase free projects auto-pause after ~7 days idle. Mitigate with a scheduled ping (GitHub Actions cron) if the app isn't opened daily, or just accept the ~1st-request-after-pause delay.

---

## 10. Build Roadmap

| Phase | Scope |
|---|---|
| 1 — Scaffold | Supabase project + `pets` table + RLS policy; `index.html`/`style.css` shell |
| 2 — Pet rendering | `pet-sprites.js` procedural dot-matrix bitmaps per life stage |
| 3 — Core loop | `app.js` stats engine, feed/play/clean/sleep/medicine actions |
| 4 — Auth + sync | `supabase.js` email/password auth, read/write pet row, decay-on-load recap |
| 5 — Security pass | Confirm RLS on `pets`, restrict Auth redirect URLs, verify no service_role key anywhere in repo |
| 6 — Deploy | Push to GitHub, enable GitHub Pages on `main` |

---

## 11. Future Options (not in MVP)

- Real sprite art / animation, sound.
- PWA installability (manifest + service worker) — pure addition, doesn't change the architecture above.
- True closed-app push notifications (needs VAPID keys + a server-side scheduler, e.g. a Supabase Edge Function on cron).
- Capacitor/TWA wrap for app-store distribution if ever needed, around the same static files.
