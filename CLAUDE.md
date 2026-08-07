# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PocketPet: a virtual pet web app (Tamagotchi-style). Plain HTML/CSS/JS — **no build step, no bundler, no framework, no `package.json`, no image assets**. This is a deliberate constraint (see `tamagotchi-app-design.md` §1), not an oversight; don't introduce npm/build tooling.

## Commands

There is no build, lint, or test tooling. Development loop:

```bash
python3 -m http.server 8934          # serve the repo root
# landing page: http://localhost:8934/
# the actual game: http://localhost:8934/app.html
node --check <file>.js                # only available correctness check pre-commit
```

Deploy is `git push` to `main` — GitHub Pages serves the branch directly (no CI build). Pushing is safe to do proactively once changes work locally.

## Architecture

**Files** (all at repo root, no subfolders):
- `index.html` / `landing.js` — static marketing page with a preview pet; links to `app.html`.
- `app.html` — the actual app: auth, pet screen, settings, achievements (all as `<section class="screen" data-screen="...">` blocks).
- `app.js` — everything: stats engine, Supabase-backed persistence, DOM rendering, all event wiring. No router — `screen(name)` just toggles which `.screen[data-screen]` is visible.
- `pet-sprites.js` — procedural pixel-art generator (see below).
- `supabase.js` — thin wrapper around the Supabase JS client (loaded via CDN `<script>` in `app.html`, which must load before the `type="module"` scripts).
- `style.css` — shared by both pages.
- `tamagotchi-app-design.md` — the design doc; source of truth for schema, security rationale, and product scope. Keep it in sync when changing data model or core mechanics.

**Pet rendering** (`pet-sprites.js` + `app.js`): the pet is a chick, drawn as a 25×25 grid of `0`/`1`/`2` values (off / body / eye), generated from small per-stage `PROFILES` objects (a `halfWidths` array draws a row of dots symmetric around center — no hand-drawn bitmaps, no image files). `app.js` turns that grid into one `<i class="dot">` per cell. Flat 2D coloring only (no gradients/shadows on the dots) — this was explicitly reverted from a "3D voxel" look once before; don't reintroduce shading on `.dot--body`/`.dot--eye`. An adult pet raised with low `neglect_incidents` gets an extra "pristine" sparkle dot — that's the one place lifetime care history (not current stats) affects the sprite.

**Decay-on-load, not live-ticked**: stats don't decay in a `setInterval` while the tab is open. `applyDecay()` in `app.js` computes elapsed time since `last_updated` once per load/login, applies decay deterministically for that whole gap, and writes the result back. This is why actions during an active session don't need to re-run decay — only login/reload does.

**Pacing**: `TIME_SCALE = 1` in `app.js` — decay runs at normal (real-time) speed. `AGE_THRESHOLD_MS` is tuned to a 2-hour full growth cycle (egg → adult), not the multi-day pacing a "real" long-lived pet would use.

**Health has two directions**: it only drops from neglect (any of hunger/happiness/hygiene hitting 0) and recovers passively once care resumes — Medicine is only needed once it's fully bottomed out into "sick." Evolution requires age *and* `health >= 50`; don't gate evolution on health alone without the passive-regen branch or pets get permanently stuck.

**Achievements are derived, not stored**: the `ACHIEVEMENTS` array in `app.js` computes earned/locked live from pet fields (`total_coins_earned`, `ever_sick`, `neglect_incidents`, `life_stage`) — there's no separate achievements table or "earned" flags.

**Backend**: Supabase Postgres, single `pets` table, one row per user, protected entirely by Row Level Security (`auth.uid() = user_id`) — the anon key in `supabase.js` is intentionally public and safe *only because* RLS is on. Never add a `service_role` key to this repo. Schema changes need a manual `alter table` run in the Supabase SQL editor — there's no migration tooling, so when adding a pet field, update: the `create table` block in `tamagotchi-app-design.md` §5, `createInitialPet()` in `app.js`, and the `.update({...})` payload in `supabase.js`'s `savePet()`.

**A recurring CSS trap**: `hidden` attribute defaults to `display: none` via the UA stylesheet, but any class rule that sets `display` unconditionally (e.g. `.stack { display: flex }`) overrides it. Several bugs in this codebase came from adding `hidden` to an element that also had such a class. Fix pattern used throughout `style.css`: add an explicit `.foo[hidden] { display: none; }`.

## Codex config detected

This machine has a `~/.codex/config.toml`. If you want to bring over its MCP servers, instructions, or other settings, reply `/import` to scan what's importable, then `/import --yes=<digest>` to apply it.
