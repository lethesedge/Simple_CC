# International ingredient data — resolved

## Original complaint

Real-world testing found zero offline matches for things like `bok choy`,
`gochujang`, `sesame oil`, and few matches for `cilantro`, `kimchi`, `curry`.
A prior session (network-restricted to GitHub + npm) wrote up a plan to
source a whole supplementary Asian/Mexican dataset from an external
database. With full web access, investigating the actual cause turned up
something different — most of it wasn't a data gap at all.

## What was actually wrong

1. **Build script only read one energy nutrient id.** USDA's Foundation
   Foods (the newer, higher-quality dataset — fresh produce, meats,
   specific varieties) almost never report nutrient id `1008` ("Energy")
   directly; they report only the derived Atwater factors (`2047`/`2048`).
   `scripts/build_food_data.py` only checked `1008`, so **226 of 363
   Foundation Foods (62%) were silently dropped** — including bok choy,
   dozens of fresh vegetables/fruits/mushroom varieties, fresh cuts of
   chicken/beef/pork/fish, jalapeño/poblano/serrano peppers, and more.
   Fixed by falling back to `2047` then `2048` when `1008` is absent.
2. **Search only matched contiguous substrings.** USDA names things
   "primary ingredient, modifiers" (e.g. `Oil, sesame, salad or cooking`,
   `Sauce, fish, ready-to-serve`), so a query like "sesame oil" or "fish
   sauce" never appeared as a substring even though the food existed.
   `js/foods.js`'s `matchRank` now falls back to order-independent,
   whole-word token matching when the plain substring search misses.

Together these two fixes resolved nearly every example in the original
complaint (bok choy, sesame oil, fish sauce, napa cabbage, oyster sauce,
wasabi, turmeric — cilantro/kimchi/curry already worked) using data that
was already bundled, no external source needed.

## Genuine gaps (not in USDA SR Legacy/Foundation Foods at all)

A short list of Asian/Mexican staples with no equivalent in either raw
source, confirmed by checking the raw USDA JSON directly: gochujang,
gochugaru, doubanjiang, mirin, rice vinegar, nori, star anise, Chinese
five-spice, galangal, shiso, black bean sauce, coconut aminos, panko,
daikon, lemongrass, chipotle in adobo, kaffir lime leaves, tamarind paste.

These are self-curated in `data/international-foods.json` — kcal/100g
values compiled from multiple public nutrition references (the same kind
of factual lookup as reading a label), not copied from any single
copyrighted database. Licensed under this repo's MIT license like the
rest of the app. `js/foods.js` loads and searches this file alongside
`data/foods.json`.

## Follow-up ideas (not done)

- A proper licensed regional dataset (IFCT for India is AGPL-3.0 — a
  license-compatibility conversation with the user, not a hard blocker
  for a personal project, but flagged) would still beat a hand-curated
  list for breadth/accuracy if someone wants to pursue it later.
- The `data/international-foods.json` list is intentionally short (18
  items) — it covers the specific examples raised, not exhaustive
  regional coverage.
