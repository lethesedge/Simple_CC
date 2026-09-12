// Recipe combiner: build a recipe from components, save it, then log
// however much of it was actually eaten (weight / servings / percentage).
import { db } from "./db.js";
import { getFoodById } from "./foods.js";

// component: { foodId, name, grams }
export function computeRecipeTotals(components) {
  let totalGrams = 0;
  let totalKcal = 0;
  for (const c of components) {
    totalGrams += c.grams;
    totalKcal += (c.kcalPer100g / 100) * c.grams;
  }
  return { totalGrams, totalKcal: Math.round(totalKcal) };
}

export async function buildComponent(foodId, grams) {
  const food = await getFoodById(foodId);
  if (!food) throw new Error(`Unknown food: ${foodId}`);
  return { foodId, name: food.name, kcalPer100g: food.kcalPer100g, grams };
}

export async function saveRecipe({ name, components, servings }) {
  const { totalGrams, totalKcal } = computeRecipeTotals(components);
  const recipe = {
    id: `recipe:${crypto.randomUUID()}`,
    name,
    components,
    totalGrams,
    totalKcal,
    servings: servings || null,
  };
  await db.put("recipes", recipe);
  return recipe;
}

export async function getRecipe(id) {
  return db.get("recipes", id);
}

export async function listRecipes() {
  return db.getAll("recipes");
}

// portion: { mode: "weight" | "servings" | "percentage", value: number }
export function kcalForPortion(recipe, portion) {
  switch (portion.mode) {
    case "weight": {
      const fraction = portion.value / recipe.totalGrams;
      return Math.round(recipe.totalKcal * fraction);
    }
    case "servings": {
      if (!recipe.servings) {
        throw new Error("This recipe has no declared serving count");
      }
      const fraction = portion.value / recipe.servings;
      return Math.round(recipe.totalKcal * fraction);
    }
    case "percentage": {
      const fraction = portion.value / 100;
      return Math.round(recipe.totalKcal * fraction);
    }
    default:
      throw new Error(`Unknown portion mode: ${portion.mode}`);
  }
}
