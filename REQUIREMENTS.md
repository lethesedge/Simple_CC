# Simple_CC — Requirements (v1)

A calorie counter you run on your phone, with no server and no account —
all data lives on the device, with the option to export it.

## Platform

- Installable Progressive Web App (PWA)
- Hosted on GitHub Pages (static hosting, HTTPS, no backend/database)
- Works offline once installed (service worker caches the app + food dataset)
- All user data stored client-side (IndexedDB/localStorage) — nothing leaves
  the device

## Core tracking

1. Editable daily calorie goal
2. Log entries: food, calories, serving/quantity, timestamp
3. Daily view: consumed vs. goal, remaining
4. Weekly view: 7-day progress (table/chart)
5. Monthly view: rollup summary

## Food data

6. Seeded from open-source datasets, searchable client-side:
   - **USDA FoodData Central** — generic/whole foods
   - **Open Food Facts** — branded/packaged foods
7. Manual/custom entry for anything not found in either dataset

## Data portability

8. Export logged data (CSV/JSON) for download to PC — acts as backup/archive
   since local browser storage isn't guaranteed to persist indefinitely

## Meal/recipe combiner

9. Build a recipe from multiple components (dataset items or custom entries),
   each with its own quantity
   - App computes total calories and total weight for the recipe
   - Recipes are saved for reuse
   - When logging a portion eaten, choose one of three input modes:
     - **Weight** — grams/oz consumed (most precise)
     - **Servings** — recipe declares "makes N servings," log servings eaten
     - **Percentage** — rough estimate (e.g., "~30% of this")
   - Whichever mode is used, the app converts it to calories for that entry

## Out of scope for v1

- Barcode scanning
- Native mobile app / app store distribution
- User accounts / cloud sync / multi-device
- Nutrient tracking beyond calories (protein/carbs/fat, etc.)
- Natural-language food entry parsing
