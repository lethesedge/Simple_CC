#!/usr/bin/env python3
"""
Processes the raw USDA FoodData Central JSON dumps in raw-data/ into the
compact data/foods.json bundle the app actually loads.

Run this whenever the raw-data/ files are updated:
    python3 scripts/build_food_data.py
"""
import json
import re
import zipfile
from pathlib import Path

RAW_DIR = Path(__file__).parent.parent / "raw-data"
OUT_PATH = Path(__file__).parent.parent / "data" / "foods.json"

SOURCES = [
    ("FoodData_Central_foundation_food_json_2026-04-30.zip", "FoundationFoods", "usda-foundation"),
    ("FoodData_Central_sr_legacy_food_json_2018-04.zip", "SRLegacyFoods", "usda-sr-legacy"),
]

# Most foods report energy as nutrient 1008 ("Energy", kcal). Foundation
# Foods largely omit that and report only the derived Atwater factors
# instead (2047 general, 2048 specific) — without this fallback ~62% of
# Foundation Foods (includes many fresh vegetables, fruits, and cuts of
# meat) get silently dropped for "missing" energy data that's really just
# under a different nutrient id.
ENERGY_NUTRIENT_IDS = (1008, 2047, 2048)

# This bundle is meant to be whole/generic foods only — branded and
# restaurant items are handled by the live Open Food Facts search instead.
# SR Legacy (an older USDA file) mixes in a lot of both, so filter them out.
EXCLUDED_CATEGORIES = {"Fast Foods", "Restaurant Foods", "Baby Foods"}
BRAND_NAME_PATTERN = re.compile(r"^[A-Z0-9&'\-. ]{2,},")


def is_branded(food, name):
    category = (food.get("foodCategory") or {}).get("description")
    if category in EXCLUDED_CATEGORIES:
        return True
    return bool(BRAND_NAME_PATTERN.match(name))


def load_source(zip_name, top_level_key):
    zip_path = RAW_DIR / zip_name
    with zipfile.ZipFile(zip_path) as zf:
        json_name = zf.namelist()[0]
        with zf.open(json_name) as f:
            data = json.load(f)
    return data[top_level_key]


def extract_kcal(food_nutrients):
    by_id = {}
    for n in food_nutrients:
        nid = n.get("nutrient", {}).get("id")
        amount = n.get("amount")
        if nid in ENERGY_NUTRIENT_IDS and amount is not None:
            by_id[nid] = amount
    for nid in ENERGY_NUTRIENT_IDS:
        if nid in by_id:
            return round(by_id[nid])
    return None


def extract_portions(food_portions):
    portions = []
    for p in food_portions or []:
        unit = p.get("measureUnit", {}).get("name")
        grams = p.get("gramWeight")
        if unit and grams:
            label = p.get("modifier") or unit
            portions.append({"label": label, "grams": round(grams, 1)})
    return portions


def build():
    foods = []
    seen_names = set()

    for zip_name, top_level_key, source_id in SOURCES:
        raw_foods = load_source(zip_name, top_level_key)
        for food in raw_foods:
            if food is None:
                continue
            kcal = extract_kcal(food.get("foodNutrients", []))
            if kcal is None:
                continue

            name = food["description"]
            if is_branded(food, name):
                continue

            dedup_key = (source_id, name)
            if dedup_key in seen_names:
                continue
            seen_names.add(dedup_key)

            foods.append({
                "id": f"{source_id}:{food['fdcId']}",
                "name": name,
                "kcalPer100g": kcal,
                "category": (food.get("foodCategory") or {}).get("description"),
                "portions": extract_portions(food.get("foodPortions")),
            })

    foods.sort(key=lambda f: f["name"])

    OUT_PATH.parent.mkdir(exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(foods, f, separators=(",", ":"))

    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"Wrote {len(foods)} foods to {OUT_PATH} ({size_kb:.0f} KB)")


if __name__ == "__main__":
    build()
