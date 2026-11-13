import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { createHash } from "node:crypto";

export async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + "\n");
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const hash = (s) => createHash("sha1").update(s).digest("hex").slice(0, 12);

// Jamaica is UTC-5 all year (no daylight saving).
const JA_OFFSET_MS = -5 * 3600 * 1000;

export function jamaicaDate(d = new Date()) {
  return new Date(d.getTime() + JA_OFFSET_MS);
}

// ISO week id in Jamaica time, e.g. "2026-W46".
export function weekId(d = new Date()) {
  const t = jamaicaDate(d);
  const day = (t.getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - day + 3));
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((thursday - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// Monday 00:00 to Sunday 23:59 Jamaica time for a week id, as UTC Dates.
export function weekRange(id) {
  const [y, w] = id.split("-W").map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const monday = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86400000 + (w - 1) * 7 * 86400000);
  const start = new Date(monday.getTime() - JA_OFFSET_MS);
  const end = new Date(start.getTime() + 7 * 86400000 - 1);
  return { start, end };
}

export function weekLabel(id) {
  const { start, end } = weekRange(id);
  const s = jamaicaDate(start), e = jamaicaDate(end);
  const m = (d) => d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  return s.getUTCMonth() === e.getUTCMonth()
    ? `${s.getUTCDate()} – ${e.getUTCDate()} ${m(e)} ${e.getUTCFullYear()}`
    : `${s.getUTCDate()} ${m(s)} – ${e.getUTCDate()} ${m(e)} ${e.getUTCFullYear()}`;
}

export function decodeEntities(s = "") {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export const stripTags = (s = "") => decodeEntities(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
