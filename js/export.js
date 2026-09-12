// Export logged data so it can be downloaded to a PC as a backup/archive.
import { getAllEntries } from "./log.js";

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportAsJson() {
  const entries = await getAllEntries();
  downloadBlob(
    JSON.stringify(entries, null, 2),
    `simple_cc-export-${Date.now()}.json`,
    "application/json"
  );
}

export async function exportAsCsv() {
  const entries = await getAllEntries();
  const header = "date,label,kcal,timestamp\n";
  const rows = entries
    .map((e) => {
      const label = `"${e.label.replace(/"/g, '""')}"`;
      return [e.date, label, e.kcal, new Date(e.timestamp).toISOString()].join(",");
    })
    .join("\n");
  downloadBlob(header + rows, `simple_cc-export-${Date.now()}.csv`, "text/csv");
}
