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
- **Life stages:** egg → hatchling → young → teen → juvenile → adult (age + care based — neglect delays evolution, doesn't reverse it). Each stage is a distinct silhouette, not a scaled-up copy of the last — e.g. the bird's teen stage is deliberately gawky/asymmetric, the adult has full spread wings and a fanned tail.
- **Egg stage:** no stats decay and no care actions (Feed/Play/Clean/Sleep) are available — an unhatched egg has no needs, it just waits out the age threshold to hatch.
- **Surprise egg species:** which creature an egg becomes (`species`: Bird, Bunny, or Turtle) is picked at random when the egg is created and kept secret — every egg renders with the same shared shape regardless of species, so there's no way to tell what's inside. The species is revealed the moment it hatches into a hatchling, both in the sprite (each species has its own hand-tuned silhouette for all 5 post-egg stages) and in a "You got a ___!" recap line. See §7 for how the sprite system implements this.
- **Actions:** Feed, Play, Clean, Sleep toggle, Medicine (when sick)
- **Economy:** two food types — Snack (`food_count`, cheap/weak) and Meal (`meal_count`, pricier/stronger); Coins (`coins`) buy either; earned by playing the mini-game
- **Mini-game:** Play opens a popup modal with a menu of four games to choose from — Tap the Target, Stop the Marker, Odd One Out, Count the Dots; hits earn coins
- **Achievements:** computed live from pet state (not separately stored) — Fully Grown, Coin Collector (100 lifetime coins via `total_coins_earned`), Never Sick (`ever_sick`), Pristine Care (`neglect_incidents === 0`)
- **Care-quality variant:** an adult raised with `neglect_incidents <= 1` renders with an extra sparkle dot — the one piece of the sprite that reflects lifetime care quality, not just current stats
- **Cosmetics:** a one-time purchasable Bow accessory (`has_bow`) — drawn as two extra dots above the head on every stage except egg
- **Daily login streak:** first login each calendar day awards bonus coins that scale with consecutive-day streak (`login_streak`, capped bonus); shown in the away-time recap
- **Decay:** stats drop on a real-time schedule, computed from elapsed time on load — see §6
- **Neglect:** stats hitting 0 drag health down; health recovers on its own once every stat is back above 0 (unless sick — that needs Medicine); health hitting 0 → sickness
- **Animations:** pixel-dot pet with a 2-frame walk cycle (feet alternate) plus wandering around the screen and a bounce on successful actions
- **Multiple pets:** up to `MAX_PETS` (3) per user, each a full independent row with its own stats/economy/achievements. A "Switch Pet" screen (thumbnail + name + stage) lets you pick which is active; the rest of the app just operates on "the active pet" and doesn't otherwise know multi-pet exists — see §12 for how this was built on top of the original one-row model
- **Settings screen:** change password, rename pet, switch/hatch pets, toggle local notifications, view achievements, reset pet to a fresh egg, sign out
- **Local notifications:** opt-in browser `Notification` nudge when a stat drops to ≤20 or the pet gets sick — client-only, only fires while the tab is open (no closed-app push; that's a bigger lift, see §11)
- **In-app tutorial:** a small "?" toggle explaining the rules, plus a live "evolves in Xm" progress line
- **Landing page:** static marketing page (`index.html`) with a pet preview and a Play button into the app (`app.html`)
- **Auth:** Supabase email/password login, required (so the pet isn't tied to one browser)
- **Persistence:** one row per pet in Supabase Postgres, scoped by Row Level Security
- **Pixel-dot rendering:** pet drawn as a procedural dot-matrix bitmap, no image files

Cut for MVP: social/leaderboards, true closed-app push notifications, PWA/offline, sound.

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
  species text not null default 'bird',
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
  meal_count int not null default 0,
  total_coins_earned int not null default 0,
  ever_sick boolean not null default false,
  neglect_incidents int not null default 0,
  last_login_date text,
  login_streak int not null default 0,
  has_bow boolean not null default false,
  created_at timestamptz not null default now(),
  is_active boolean not null default true,
  birth_timestamp timestamptz not null default now(),
  last_updated timestamptz not null default now()
);

alter table pets enable row level security;

create policy "Users can manage their own pet"
  on pets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

One to `MAX_PETS` rows per user (app-enforced, not a DB constraint — RLS already scopes correctly no matter how many rows a user has). Exactly one row per user has `is_active = true` at a time; that's the one loaded and rendered. `last_updated` drives the decay calculation on every load (§6).

`species` was added after the table already existed in production, via `alter table pets add column species text not null default 'bird';` — existing rows silently become `bird` (harmless; they already rendered with the bird sprite before species existed). Only newly-created pets get a random species going forward (§7).

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

- Grid: 25×25 int matrix per frame, rendered as a CSS grid of flat 2D dots (0 = off, 1 = fill, 2 = eye/accessory, 3 = outline) — no gradients or shading, dots touch edge-to-edge (`gap: 0`) so the sprite reads as solid blocky pixel art rather than a dotted LCD matrix.
- **Outlined pixel-art look:** `buildBitmap()` finishes every sprite with an `outlineSilhouette()` pass that dilates the shape by 1 dot in all 8 directions and marks that ring as outline (value 3, always solid black) — the classic thick-black-outline-plus-flat-fill look, done as a post-process so every hand-tuned profile gets it for free. Fill (`--dot-color`) is a light gray tint so the black outline always has contrast to read against, keeping the palette to essentially black outline + light fill + black eyes.
- Each life stage in `pet-sprites.js` is a hand-tuned profile entry (a `halfWidths` array draws a symmetric silhouette row by row) with its own shape, not a scaled copy of the previous stage — egg → hatchling → young → teen → juvenile → adult each reads as a different creature.
- **Three species, one shared egg:** `PROFILES` is now nested per species (`bird`, `bunny`, `turtle`), each with its own hand-tuned hatchling/young/teen/juvenile/adult set — genuinely different proportions, not palette swaps (bird: tall, winged, beaked; bunny: round, tall-eared, tailed, no beak; turtle: wide flat shell dome, small forward-poking head, stubby legs). The egg stage uses one shared profile for every species, so the shape gives nothing away; `buildBitmap(stage, { species, ... })` only looks up a species-specific profile once `stage !== "egg"`. `species` is picked once via `pickRandomSpecies()` when the pet/egg is created and stored on the row, not re-rolled.
- **Monochrome color-as-species-hint:** since the whole app is strict black/white/gray (no hues), each species also gets its own fixed light-gray fill tint (`SPECIES_SHADE`) applied via the existing `--dot-color` CSS variable — `app.js` only sets it once the pet is past the egg stage, so the tint can't leak the species early either. The outline stays solid black regardless of species.
- Physical size also grows per stage via a `--dot-size` CSS variable set in `app.js` (`STAGE_DOT_SIZE`), so the pet gets visibly bigger on screen, not just more detailed.
- Animation is a 2-frame walk cycle (legs/wings alternate every ~450ms) plus wandering to a random spot every few seconds — both pure JS re-renders, no CSS keyframes on the sprite itself. Sleeping stops the walk cycle and darkens the whole play area (`:has()` selector keyed off a class on the sprite); sick/mood is shown via a text status badge, not a color filter.
- A "pristine" adult variant (extra sparkle dot) is drawn when lifetime care has been consistently good — the one place the sprite reflects history, not just current stats.
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
- Deleting a pet from the roster (currently you can only Reset one's stats, not remove the row) — small addition on top of §12 if it's ever needed.
- Social features (visit friends' pets, gift items) — the biggest lift of any option here: needs public profiles, a friend graph, and RLS redesigned around "readable by friends," not just "readable by owner." A genuinely different-scale project, not an incremental add.
- Seasonal/limited-time cosmetics — cheap extension of the existing Bow mechanic once there's a reason to want more than one cosmetic.

---

## 12. Multiple Pets Per User

Nothing about the original schema or RLS *required* one row per user — `user_id` has no uniqueness constraint, and the RLS policy (`auth.uid() = user_id`) already scopes correctly no matter how many rows a user owns. So multi-pet support ended up being almost entirely an **app-logic and UI change**, not a security or schema redesign.

**Schema additions:**
```sql
alter table pets add column created_at timestamptz not null default now();
alter table pets add column is_active boolean not null default true;
```
- `created_at` gives a stable list order (separate from `birth_timestamp`, which resets on Reset Pet).
- `is_active` marks which of a user's pets is currently loaded. Exactly one `true` row per user is an app-enforced invariant, not a DB one — `createPet()` and `setActivePet()` both clear every other row's flag before setting the new one, in the same pattern as the pre-existing "one pet per user" enforcement.

**`supabase.js`:**
- `fetchPets(userId)` replaces `fetchPet` — no `.maybeSingle()`, returns the array ordered by `created_at`.
- `setActivePet(userId, petId)` — clears `is_active` on the user's other rows, sets it on the chosen one.
- `createPet(userId, name)` — same call shape as before, but now also clears other rows' `is_active` first, so it's safe to call for a 2nd or 3rd pet without a separate code path.

**`app.js` / UI:**
- `loadPetForUser` → `loadPetsForUser`: fetches all of a user's pets.
  - 0 pets → existing "name your egg" screen, unchanged.
  - 1+ pets → auto-loads whichever has `is_active = true` (falls back to the first row) straight into the normal pet screen — **no picker shown automatically**, even with multiple pets. Existing single-pet users see zero behavior change.
- New "Your Pets" screen (`data-screen="pet-picker"`), reached via the ⇄ icon on the main pet screen's topbar: lists every pet with a small live thumbnail (reuses `buildBitmap`/`petVariant`/`has_bow` — the exact same sprite code path as the main screen, just smaller dots), name, and stage. Selecting a non-active one calls `setActivePet` then re-runs the full decay/login-bonus pipeline for it, same as a normal load.
- "Hatch New Pet" button on that screen, disabled past `MAX_PETS` (3) — client-side cap only, to bound row growth, not a security control.
- Every place that already assumed a single `currentPet` (rendering, actions, achievements, the mini-game, notifications) needed **no changes** — `currentPet` just means "the active one," and switching pets goes through the same `activatePetAndRender()` helper the initial login uses.

**Deliberately not built:** deleting a pet from the roster (only Reset — zero its stats — exists today), and there's no "are you sure" confirmation before hatching a new one, since it doesn't affect any existing pet.
