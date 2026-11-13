// Asks Claude which of this week's headlines report the same story, so that
// related coverage (a row in Parliament reported from five angles, say) is
// remembered as one story. Falls back to word matching without an API key.
import Anthropic from "@anthropic-ai/sdk";
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

export async function groupHeadlines(items, log = console.log) {
  if (!process.env.ANTHROPIC_API_KEY || items.length < 2) return null;
  const client = new Anthropic();
  const list = items.map((it, i) => `${i}. [${OUTLET_BY_ID[it.outlet]?.name || it.outlet}] ${it.title}`).join("\n");
  try {
    const res = await client.beta.messages.create({
      model: process.env.CLAUDE_MODEL || "claude-opus-5-5",
      max_tokens: 8000,
      system:
        "You group Jamaican news headlines that report the same story. Put headlines together when they cover the same event, or the same ongoing dispute or programme this week (for example several angles on one parliamentary row, or several reports on the same hurricane recovery spending). Keep separate stories that only share a topic area, such as two unrelated crimes.",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content: `Headlines this week:\n${list}` }],
    });
    if (res.stop_reason !== "end_turn") {
      log(`  grouping: stopped (${res.stop_reason}), using word matching`);
      return null;
    }
    const { groups } = JSON.parse(res.content.filter((b) => b.type === "text").map((b) => b.text).join(""));
    const used = new Set();
    const clean = groups
      .map((g) => [...new Set(g)].filter((i) => Number.isInteger(i) && i >= 0 && i < items.length && !used.has(i)))
      .filter((g) => g.length > 1)
      .map((g) => (g.forEach((i) => used.add(i)), g));
    log(`  grouping: Claude found ${clean.length} multi-headline stories`);
    return clean;
  } catch (err) {
    if (err instanceof Anthropic.APIError) log(`  grouping: API error ${err.status}, using word matching`);
    else if (err instanceof SyntaxError) log("  grouping: reply was not valid JSON, using word matching");
    else throw err;
    return null;
  }
}
