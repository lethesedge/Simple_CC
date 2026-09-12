import { getSetting, setSetting } from "./db.js";
import {
  searchAllOfflineFoods,
  searchBrandedFoods,
  cacheFood,
  addCustomFood,
  getFoodById,
} from "./foods.js";
import {
  buildComponent,
  computeRecipeTotals,
  saveRecipe,
  listRecipes,
  kcalForPortion,
} from "./recipes.js";
import {
  addLogEntry,
  deleteLogEntry,
  getEntriesForDate,
  getDailyTotal,
  getDailyTotals,
  todayStr,
} from "./log.js";
import { exportAsCsv, exportAsJson } from "./export.js";

const GOAL_KEY = "dailyGoal";
const DEFAULT_GOAL = 2000;

// ---------- Tabs ----------
function initTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
      if (btn.dataset.tab === "week") renderWeek();
      if (btn.dataset.tab === "month") renderMonth();
      if (btn.dataset.tab === "recipes") renderRecipeList();
    });
  });
}

// ---------- Today ----------
async function renderToday() {
  const goal = await getSetting(GOAL_KEY, DEFAULT_GOAL);
  const date = todayStr();
  const entries = await getEntriesForDate(date);
  const consumed = entries.reduce((sum, e) => sum + e.kcal, 0);

  document.getElementById("today-goal").textContent = goal;
  document.getElementById("today-consumed").textContent = consumed;
  document.getElementById("today-remaining").textContent = goal - consumed;

  const list = document.getElementById("today-entries");
  list.innerHTML = "";
  for (const entry of entries.sort((a, b) => b.timestamp - a.timestamp)) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="name">${escapeHtml(entry.label)} — ${entry.kcal} kcal</span>`;
    const del = document.createElement("button");
    del.textContent = "Remove";
    del.addEventListener("click", async () => {
      await deleteLogEntry(entry.id);
      renderToday();
    });
    li.appendChild(del);
    list.appendChild(li);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Week / Month ----------
async function renderDayRows(containerId, days) {
  const goal = await getSetting(GOAL_KEY, DEFAULT_GOAL);
  const totals = await getDailyTotals(days);
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  for (const { date, kcal } of totals) {
    const pct = goal > 0 ? Math.min(100, (kcal / goal) * 100) : 0;
    const over = kcal > goal;
    const row = document.createElement("div");
    row.className = "day-row";
    row.innerHTML = `
      <span class="date">${date.slice(5)}</span>
      <span class="bar-track"><span class="bar-fill${over ? " over" : ""}" style="width:${pct}%"></span></span>
      <span class="kcal">${kcal}</span>
    `;
    container.appendChild(row);
  }
}

async function renderWeek() {
  await renderDayRows("week-rows", 7);
}

async function renderMonth() {
  await renderDayRows("month-rows", 30);
  const totals = await getDailyTotals(30);
  const total = totals.reduce((s, d) => s + d.kcal, 0);
  document.getElementById("month-total").textContent = total;
  document.getElementById("month-avg").textContent = Math.round(total / 30);
}

// ---------- Settings ----------
async function initSettings() {
  const goal = await getSetting(GOAL_KEY, DEFAULT_GOAL);
  document.getElementById("goal-input").value = goal;

  document.getElementById("save-goal").addEventListener("click", async () => {
    const value = Number(document.getElementById("goal-input").value) || 0;
    await setSetting(GOAL_KEY, value);
    renderToday();
  });

  document.getElementById("export-csv").addEventListener("click", exportAsCsv);
  document.getElementById("export-json").addEventListener("click", exportAsJson);
}

// ---------- Add food dialog ----------
function initAddFoodDialog() {
  const dialog = document.getElementById("add-food-dialog");
  const searchInput = document.getElementById("food-search-input");
  const results = document.getElementById("food-search-results");
  const quantityPanel = document.getElementById("food-quantity-panel");
  const selectedName = document.getElementById("selected-food-name");
  const gramsInput = document.getElementById("food-grams-input");

  let selectedFood = null;
  let searchDebounce = null;

  function renderResults(foods) {
    results.innerHTML = "";
    for (const food of foods) {
      const li = document.createElement("li");
      li.innerHTML = `<span class="name">${escapeHtml(food.name)} — ${food.kcalPer100g} kcal/100g</span>`;
      const addBtn = document.createElement("button");
      addBtn.textContent = "Select";
      addBtn.addEventListener("click", async () => {
        if (food.id.startsWith("off:")) await cacheFood(food);
        selectedFood = food;
        selectedName.textContent = food.name;
        quantityPanel.hidden = false;
      });
      li.appendChild(addBtn);
      results.appendChild(li);
    }
  }

  const status = document.getElementById("food-search-status");

  searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    const q = searchInput.value;
    searchDebounce = setTimeout(async () => {
      const foods = await searchAllOfflineFoods(q);
      status.textContent = foods.length === 0 && q.trim().length >= 2 ? "No offline matches." : "";
      renderResults(foods);
    }, 200);
  });

  document.getElementById("food-search-branded").addEventListener("click", async () => {
    const q = searchInput.value;
    if (!q || q.trim().length < 2) {
      status.textContent = "Type at least 2 characters first.";
      return;
    }
    status.textContent = "Searching Open Food Facts…";
    try {
      const foods = await searchBrandedFoods(q);
      status.textContent = foods.length === 0 ? `No branded results found for "${q}".` : "";
      renderResults(foods);
    } catch (err) {
      status.textContent = `Branded search failed: ${err.message}. Check you're online.`;
      console.error("Branded search error:", err);
    }
  });

  document.getElementById("confirm-add-food").addEventListener("click", async () => {
    const grams = Number(gramsInput.value) || 0;
    const kcal = (selectedFood.kcalPer100g / 100) * grams;
    await addLogEntry({
      label: `${selectedFood.name} (${grams}g)`,
      kcal,
      sourceId: selectedFood.id,
    });
    closeAddFoodDialog();
    renderToday();
  });

  document.getElementById("cancel-add-food").addEventListener("click", () => {
    quantityPanel.hidden = true;
    selectedFood = null;
  });

  document.getElementById("save-custom-food").addEventListener("click", async () => {
    const name = document.getElementById("custom-food-name").value.trim();
    const kcalPer100g = Number(document.getElementById("custom-food-kcal").value);
    if (!name || !kcalPer100g) return;
    const food = await addCustomFood({ name, kcalPer100g });
    document.getElementById("custom-food-name").value = "";
    document.getElementById("custom-food-kcal").value = "";
    renderResults([food]);
  });

  function closeAddFoodDialog() {
    dialog.close();
    searchInput.value = "";
    status.textContent = "";
    results.innerHTML = "";
    quantityPanel.hidden = true;
    selectedFood = null;
  }

  document.getElementById("open-add-food").addEventListener("click", () => dialog.showModal());
  document.getElementById("close-add-food-dialog").addEventListener("click", closeAddFoodDialog);
}

// ---------- Log recipe dialog ----------
function initLogRecipeDialog() {
  const dialog = document.getElementById("log-recipe-dialog");
  const picker = document.getElementById("recipe-picker");
  const valueInput = document.getElementById("portion-value-input");
  const preview = document.getElementById("portion-preview");
  let recipes = [];

  function currentMode() {
    return document.querySelector('input[name="portion-mode"]:checked').value;
  }

  function updatePreview() {
    const recipe = recipes.find((r) => r.id === picker.value);
    if (!recipe) return;
    const value = Number(valueInput.value) || 0;
    try {
      const kcal = kcalForPortion(recipe, { mode: currentMode(), value });
      preview.textContent = `≈ ${kcal} kcal`;
    } catch (err) {
      preview.textContent = err.message;
    }
  }

  document.querySelectorAll('input[name="portion-mode"]').forEach((r) =>
    r.addEventListener("change", updatePreview)
  );
  valueInput.addEventListener("input", updatePreview);
  picker.addEventListener("change", updatePreview);

  document.getElementById("open-log-recipe").addEventListener("click", async () => {
    recipes = await listRecipes();
    picker.innerHTML = recipes
      .map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`)
      .join("");
    updatePreview();
    dialog.showModal();
  });

  document.getElementById("confirm-log-recipe").addEventListener("click", async () => {
    const recipe = recipes.find((r) => r.id === picker.value);
    if (!recipe) return;
    const value = Number(valueInput.value) || 0;
    const mode = currentMode();
    let kcal;
    try {
      kcal = kcalForPortion(recipe, { mode, value });
    } catch (err) {
      alert(err.message);
      return;
    }
    await addLogEntry({
      label: `${recipe.name} (${value} ${mode})`,
      kcal,
      sourceId: recipe.id,
    });
    dialog.close();
    renderToday();
  });

  document.getElementById("cancel-log-recipe").addEventListener("click", () => dialog.close());
}

// ---------- New recipe dialog ----------
function initNewRecipeDialog() {
  const dialog = document.getElementById("new-recipe-dialog");
  const searchInput = document.getElementById("component-search-input");
  const searchResults = document.getElementById("component-search-results");
  const componentsList = document.getElementById("recipe-components");
  const totalsPreview = document.getElementById("recipe-totals-preview");

  let components = [];
  let searchDebounce = null;

  function renderComponents() {
    componentsList.innerHTML = "";
    for (const [idx, c] of components.entries()) {
      const li = document.createElement("li");
      li.innerHTML = `<span class="name">${escapeHtml(c.name)}</span>`;
      const gramsInput = document.createElement("input");
      gramsInput.type = "number";
      gramsInput.value = c.grams;
      gramsInput.style.width = "5rem";
      gramsInput.addEventListener("input", () => {
        components[idx].grams = Number(gramsInput.value) || 0;
        renderTotals();
      });
      const removeBtn = document.createElement("button");
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => {
        components.splice(idx, 1);
        renderComponents();
      });
      li.appendChild(gramsInput);
      li.appendChild(removeBtn);
      componentsList.appendChild(li);
    }
    renderTotals();
  }

  function renderTotals() {
    const { totalGrams, totalKcal } = computeRecipeTotals(components);
    totalsPreview.textContent = `Total: ${totalGrams}g, ${totalKcal} kcal`;
  }

  searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    const q = searchInput.value;
    searchDebounce = setTimeout(async () => {
      const foods = await searchAllOfflineFoods(q);
      searchResults.innerHTML = "";
      for (const food of foods) {
        const li = document.createElement("li");
        li.innerHTML = `<span class="name">${escapeHtml(food.name)} — ${food.kcalPer100g} kcal/100g</span>`;
        const addBtn = document.createElement("button");
        addBtn.textContent = "+ Add";
        addBtn.addEventListener("click", async () => {
          const component = await buildComponent(food.id, 100);
          components.push(component);
          renderComponents();
        });
        li.appendChild(addBtn);
        searchResults.appendChild(li);
      }
    }, 200);
  });

  document.getElementById("open-new-recipe").addEventListener("click", () => {
    components = [];
    document.getElementById("recipe-name-input").value = "";
    document.getElementById("recipe-servings-input").value = "";
    searchInput.value = "";
    searchResults.innerHTML = "";
    renderComponents();
    dialog.showModal();
  });

  document.getElementById("save-recipe").addEventListener("click", async () => {
    const name = document.getElementById("recipe-name-input").value.trim();
    const servings = Number(document.getElementById("recipe-servings-input").value) || null;
    if (!name || components.length === 0) {
      alert("Give the recipe a name and at least one component.");
      return;
    }
    await saveRecipe({ name, components, servings });
    dialog.close();
    renderRecipeList();
  });

  document.getElementById("cancel-new-recipe").addEventListener("click", () => dialog.close());
}

async function renderRecipeList() {
  const recipes = await listRecipes();
  const list = document.getElementById("recipe-list");
  list.innerHTML = "";
  for (const recipe of recipes) {
    const li = document.createElement("li");
    const servingsNote = recipe.servings ? `, makes ${recipe.servings} servings` : "";
    li.innerHTML = `<span class="name">${escapeHtml(recipe.name)} — ${recipe.totalKcal} kcal total${servingsNote}</span>`;
    list.appendChild(li);
  }
}

// ---------- Service worker ----------
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      // Offline install just won't be available; the app still works online.
    });
  }
}

// ---------- Init ----------
async function init() {
  initTabs();
  await initSettings();
  await renderToday();
  initAddFoodDialog();
  initLogRecipeDialog();
  initNewRecipeDialog();
  registerServiceWorker();
}

init();
