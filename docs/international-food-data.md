# Task: source international pantry ingredient data

## Context

Simple_CC is a local-first calorie-counter PWA (see `../REQUIREMENTS.md` for
full scope). Food data comes from two sources today:

1. **Bundled offline dataset** (`data/foods.json`) — built by
   `scripts/build_food_data.py` from raw USDA FoodData Central files in
   `raw-data/` (Foundation Foods + SR Legacy). ~7,000 whole/generic foods.
   Branded, restaurant, and baby-food entries are deliberately filtered out
   (see the `EXCLUDED_CATEGORIES` / `BRAND_NAME_PATTERN` logic in that
   script) — this bundle is meant to be raw/generic ingredients only.
2. **Live Open Food Facts search** (`js/foods.js`, `searchBrandedFoods`) —
   for branded/packaged products, queried at runtime when online.

## The gap

USDA's data is heavily US/Western-pantry-centric. Real-world testing found
zero matches for things like `bok choy`, `gochujang`, `sesame oil`, and
very few for `cilantro`, `kimchi`, `curry`. The user wants better coverage
of Asian and Mexican cuisine ingredients specifically.

## What's already been ruled out (searched from a network-restricted
sandbox limited to GitHub + npm — this is the part that needs a session
with real internet access to redo properly)

- **IFCT 2017** (`nodef/ifct2017` on GitHub) — real, official Indian Food
  Composition Tables data, 542 foods, well-structured. Licensed
  **AGPL-3.0-or-later**, which conflicts with this repo's MIT license if
  bundled directly — worth a license-compatibility gut check before using
  it, not a hard blocker for a personal project, but flag it.
- **Mexican cuisine (SMAE or similar)**: nothing found as open, structured
  data via GitHub/npm search.
- **Broader Asian (China, Japan, Southeast Asia)**: nothing found either.
  Packages that came up (e.g. `@formosa-mcp/taiwan-food-nutrition`) are
  thin API-wrapper shims (a few KB, call some live government API) rather
  than bundleable datasets — and likely hit the same "official government
  nutrition site" network blocks this sandbox has.

## What to actually do in a session with full internet access

1. Search more broadly than GitHub/npm — general web search, data
   repositories (e.g. Zenodo, data.gov equivalents for other countries),
   and INFOODS (FAO/WHO's International Network of Food Data Systems,
   which catalogs national food composition databases) for structured,
   licensable Asian and Mexican ingredient data.
2. For each candidate source, check explicitly:
   - Is it actually structured data (JSON/CSV), not just a PDF/book?
   - What's the license? Needs to be compatible with distributing inside
     an MIT-licensed personal project (public domain, CC-BY, CC0, MIT,
     etc. are fine; AGPL/GPL need a judgment call with the user; "all
     rights reserved" / no explicit license is a no).
3. If a good source is found: write a processing script (follow the
   pattern in `scripts/build_food_data.py`) that outputs a file matching
   the same schema as `data/foods.json`:
   ```json
   { "id": "<source-prefix>:<unique-id>", "name": "...", "kcalPer100g": 123,
     "category": "...", "portions": [{ "label": "...", "grams": 12.3 }] }
   ```
   Save it as a separate bundle (e.g. `data/international-foods.json`)
   rather than merging into `data/foods.json`, so provenance/licensing
   per-source stays traceable. `js/foods.js` would need a small update to
   load and search the additional file alongside the USDA one.
4. If nothing suitable turns up even with full access: fall back to a
   self-curated supplementary list (common Asian/Mexican staples with
   well-established nutrition values, authored directly, MIT-licensed,
   no external dependency) — this was the fallback plan discussed with
   the user before deciding to try for a better source first.

## Where things stand

Everything through the current app (tracking, recipes, USDA search, OFF
live search, export, PWA/offline support) is built and working — this is
purely a data-quality follow-up, not a blocker for using the app. Branch:
`claude/calorie-counter-requirements-y564hw`.
