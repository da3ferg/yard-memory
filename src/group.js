// Asks Claude which of this week's headlines report the same story, so that
// related coverage (a row in Parliament reported from five angles, say) is
// remembered as one story. Falls back to word matching without Bedrock.
import { claudeEnabled, askJson } from "./claude.js";
import { OUTLET_BY_ID } from "./sources.js";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["groups"],
  properties: {
    groups: {
      type: "array",
      description: "Each group lists the numbers of headlines about the same story or the same ongoing controversy. Headlines that stand alone may be left out.",
      items: { type: "array", items: { type: "integer" } },
    },
  },
};

const SYSTEM =
  "You group Jamaican news headlines that report the same story. Put headlines together when they cover the same event, or the same ongoing dispute or programme this week (for example several angles on one parliamentary row, or several reports on the same hurricane recovery spending). Keep separate stories that only share a topic area, such as two unrelated crimes.";

export async function groupHeadlines(items, log = console.log) {
  if (!claudeEnabled() || items.length < 2) return null;
  const list = items.map((it, i) => `${i}. [${OUTLET_BY_ID[it.outlet]?.name || it.outlet}] ${it.title}`).join("\n");
  const out = await askJson({ system: SYSTEM, user: `Headlines this week:\n${list}`, schema: SCHEMA, maxTokens: 8000, log, what: "grouping" });
  if (!out) return null;
  const used = new Set();
  const clean = out.groups
    .map((g) => [...new Set(g)].filter((i) => Number.isInteger(i) && i >= 0 && i < items.length && !used.has(i)))
    .filter((g) => g.length > 1)
    .map((g) => (g.forEach((i) => used.add(i)), g));
  log(`  grouping: Claude found ${clean.length} multi-headline stories`);
  return clean;
}
