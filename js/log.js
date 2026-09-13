// Daily log entries, and the weekly/monthly rollups built from them.
import { db } from "./db.js";

function todayStr(date = new Date()) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function addLogEntry({ date, label, kcal, sourceId }) {
  const entry = {
    id: crypto.randomUUID(),
    date: date || todayStr(),
    label,
    kcal: Math.round(kcal),
    sourceId: sourceId || null,
    timestamp: Date.now(),
  };
  await db.put("logEntries", entry);
  return entry;
}

export async function deleteLogEntry(id) {
  await db.delete("logEntries", id);
}

export async function getEntriesForDate(date) {
  return db.getAllByIndex("logEntries", "by_date", date);
}

export async function getAllEntries() {
  return db.getAll("logEntries");
}

export async function getDailyTotal(date) {
  const entries = await getEntriesForDate(date);
  return entries.reduce((sum, e) => sum + e.kcal, 0);
}

// Returns the last `days` days (including today), oldest first, each with
// its date and total kcal — used for the weekly/monthly views.
export async function getDailyTotals(days) {
  const all = await getAllEntries();
  const totalsByDate = new Map();
  for (const e of all) {
    totalsByDate.set(e.date, (totalsByDate.get(e.date) || 0) + e.kcal);
  }

  const result = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = todayStr(d);
    result.push({ date: key, kcal: totalsByDate.get(key) || 0 });
  }
  return result;
}

export { todayStr };
