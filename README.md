# PocketPet

A tiny pixel-dot virtual pet that lives in your browser — feed it, play with it, watch it grow through six genuinely different life stages, and pick up the same pet from any device.

**Live:** https://junjing02.github.io/pocketpet/ · **Play:** https://junjing02.github.io/pocketpet/app.html

## What it is

Hatch an egg and raise it through `hatchling → young → teen → juvenile → adult` — every stage is a distinct hand-drawn pixel silhouette, not just a bigger copy of the last. Along the way:

- **Surprise egg**: every egg looks the same — which of three species (Bird, Bunny, Turtle, each a genuinely different size/shape/features) you get is a surprise revealed only once it hatches.
- **Care**: keep Hunger, Happy, Energy, and Clean up via Feed (Snack or Meal), Play, Clean, and Sleep. Health drops from neglect and recovers on its own once you're back on top of things — unless it bottoms out into sick, which needs Medicine.
- **Economy**: earn coins by playing one of four mini-games (Tap the Target, Stop the Marker, Odd One Out, Count the Dots), then spend them on food or a cosmetic Bow.
- **Achievements**: Fully Grown, Coin Collector, Never Sick, Pristine Care — computed live from how you've actually played.
- **Care-quality reward**: raise your pet well and the adult form gets a small sparkle no neglected pet will ever show.
- **Daily streak**: log in on consecutive days for a growing coin bonus.
- **Cross-device**: sign in anywhere and it's the same pet — real auth, not a local save file.

## Stack

Plain HTML, CSS, and JavaScript — no framework, no bundler, no build step, no image assets. The pet itself is a 25×25 grid of on/off dots generated from small shape descriptions in code. Supabase (Postgres + Auth) is the only backend, and it's the one piece that can't be "just static files," since cross-device sync needs a real account system.

See [`tamagotchi-app-design.md`](tamagotchi-app-design.md) for the full design rationale, data model, decay mechanics, and security notes.

## Running it locally

No install step — it's static files.

```bash
python3 -m http.server 8934
# landing page:  http://localhost:8934/
# the actual app: http://localhost:8934/app.html
```

To point it at your own backend, create a free project at [supabase.com](https://supabase.com), run the SQL in `tamagotchi-app-design.md` §5 to create the `pets` table, and drop your project URL + anon key into `supabase.js`.

## Deploying

Push to `main` — GitHub Pages serves the repo root directly, no CI build required. `index.html` is the landing page; `app.html` is the game.
