// Food search: bundled USDA dataset (offline) + Open Food Facts live API
// (branded/packaged foods, requires network) + user's custom entries.
import { db } from "./db.js";

let bundledFoods = null;

async function loadBundledFoods() {
  if (bundledFoods) return bundledFoods;
  const res = await fetch("data/foods.json");
  bundledFoods = await res.json();
  return bundledFoods;
}

// Ranks a plain "Chicken, breast, raw" above "Bologna, chicken, pork" for a
// search of "chicken" — lower is better, or null for no match at all.
function matchRank(name, query) {
  const lower = name.toLowerCase();
  const idx = lower.indexOf(query);
  if (idx === -1) return null;
  if (idx === 0) return 0; // name starts with the query
  if (lower[idx - 1] === "," || lower[idx - 1] === " ") return 1; // starts a word
  return 2; // buried mid-word
}

// Search the offline USDA dataset. Always available, no network needed.
export async function searchLocalFoods(query, limit = 25) {
  if (!query || query.trim().length < 2) return [];
  const foods = await loadBundledFoods();
  const q = query.trim().toLowerCase();

  const ranked = [];
  for (const food of foods) {
    const rank = matchRank(food.name, q);
    if (rank !== null) ranked.push({ food, rank });
  }
  ranked.sort((a, b) => a.rank - b.rank || a.food.name.length - b.food.name.length);
  return ranked.slice(0, limit).map((r) => r.food);
}

export async function searchCustomFoods(query) {
  const custom = await db.getAll("customFoods");
  const q = query.trim().toLowerCase();
  return custom.filter((f) => f.name.toLowerCase().includes(q));
}

// Search Open Food Facts' public API for branded/packaged foods.
// Requires the device to be online; results are cached locally on selection
// so re-using the same food later works offline.
export async function searchBrandedFoods(query, limit = 15) {
  if (!query || query.trim().length < 2) return [];
  const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  url.searchParams.set("search_terms", query);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", String(limit));

  // Note: browsers refuse to let JS set a custom User-Agent header on
  // fetch() (it's a forbidden header), so we don't try — Open Food Facts
  // still serves the request fine with whatever the browser sends.
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open Food Facts search failed: ${res.status}`);
  const data = await res.json();

  return (data.products || [])
    .map((p) => {
      // Most products report kcal directly; a few only have kJ on file.
      let kcal = p.nutriments?.["energy-kcal_100g"];
      if (kcal == null && p.nutriments?.["energy_100g"] != null) {
        kcal = p.nutriments["energy_100g"] / 4.184; // kJ -> kcal
      }
      if (kcal == null || !p.product_name) return null;
      return {
        id: `off:${p.code}`,
        name: p.brands ? `${p.product_name} (${p.brands})` : p.product_name,
        kcalPer100g: Math.round(kcal),
        category: "Branded (Open Food Facts)",
        portions: p.serving_size ? [{ label: "serving", grams: null, note: p.serving_size }] : [],
      };
    })
    .filter(Boolean);
}

// Cache a food (typically from the OFF API) locally so it works offline
// next time it's searched or logged.
export async function cacheFood(food) {
  await db.put("cachedFoods", food);
}

export async function searchCachedFoods(query) {
  const cached = await db.getAll("cachedFoods");
  const q = query.trim().toLowerCase();
  return cached.filter((f) => f.name.toLowerCase().includes(q));
}

// Combined search across offline USDA data, cached OFF results, and
// custom foods. Does not hit the network — call searchBrandedFoods
// separately for a live branded-food lookup.
export async function searchAllOfflineFoods(query, limit = 25) {
  const [local, cached, custom] = await Promise.all([
    searchLocalFoods(query, limit),
    searchCachedFoods(query),
    searchCustomFoods(query),
  ]);
  return [...custom, ...cached, ...local].slice(0, limit);
}

export async function getFoodById(id) {
  if (id.startsWith("custom:")) {
    return db.get("customFoods", id);
  }
  if (id.startsWith("off:")) {
    return db.get("cachedFoods", id);
  }
  const foods = await loadBundledFoods();
  return foods.find((f) => f.id === id) || null;
}

export async function addCustomFood({ name, kcalPer100g }) {
  const food = {
    id: `custom:${crypto.randomUUID()}`,
    name,
    kcalPer100g: Math.round(kcalPer100g),
    category: "Custom",
    portions: [],
  };
  await db.put("customFoods", food);
  return food;
}
