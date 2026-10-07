import { HttpError } from "./httpError.js";

export function buildDateFilter({ dateFrom, dateTo }) {
  const dates = {};
  for (const [value, operator] of [[dateFrom, "gte"], [dateTo, "lt"]]) {
    if (!value) continue;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError(400, "Report dates must use YYYY-MM-DD.");
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new HttpError(400, "Report date is invalid.");
    if (operator === "lt") date.setUTCDate(date.getUTCDate() + 1);
    dates[operator] = date;
  }
  if (dates.gte && dates.lt && dates.gte >= dates.lt) throw new HttpError(400, "Start date must not follow end date.");
  return Object.keys(dates).length ? dates : null;
}

export function csvCell(value) {
  let text = String(value ?? "");
  if (typeof value === "string" && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}
