// Retells a story from the headlines and summaries the outlets published.
// Uses Claude on Amazon Bedrock when AWS is configured; otherwise falls back
// to the outlets' own headline and summary so the site always builds.
import { claudeEnabled, askJson } from "./claude.js";
import { OUTLET_BY_ID } from "./sources.js";
import { guessSection, guessWeight, guessHeart } from "./stories.js";

export const SECTIONS = ["nation", "recovery", "justice", "life", "sport", "world"];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "dek", "paragraphs", "stamp", "section", "weight", "heart"],
  properties: {
    headline: { type: "string", description: "Clear, specific headline, at most 12 words, no clickbait." },
    dek: { type: "string", description: "One or two sentences that say why this matters." },
    paragraphs: { type: "array", items: { type: "string" }, description: "Two to four short paragraphs telling the story." },
    stamp: { type: "string", description: "Two to four words to print on the cover image, e.g. 'Gordon House' or '$13 billion'." },
    section: { type: "string", enum: SECTIONS },
    weight: { type: "integer", enum: [0, 1, 2, 3], description: "National consequence: money, safety, governance, the recovery." },
    heart: { type: "integer", enum: [0, 1, 2, 3], description: "Human stakes." },
  },
};

const SYSTEM = `You are the editor of Yard Memory, a weekly digest that remembers what Jamaica talked about.
You retell one news story using only the headlines and summaries provided by Jamaican outlets.

Rules:
- Use only facts present in the provided material. Never add names, numbers, quotes or causes that are not there. If the material is thin, write less.
- Write in plain, warm, direct English for a Jamaican reader. Short sentences. No hype, no puns, no em-dashes.
- Attribute contested claims ("police say", "the Opposition says").
- Do not copy sentences from the sources; retell in your own words.
- section: nation (politics, governance), recovery (Hurricane Melissa and rebuilding, economy), justice (crime, courts, prisons), life (everyday island life, prices, travel, social buzz), sport (sport, arts, culture), world (Jamaica and the world, or global stories).`;

export function fallback(story) {
  const lead = story.articles[0];
  const text = story.articles.map((a) => `${a.title} ${a.summary || ""}`).join(" ");
  return {
    headline: lead.title,
    dek: lead.summary || "",
    paragraphs: lead.summary ? [lead.summary] : [],
    stamp: lead.title.split(/\s+/).slice(0, 3).join(" "),
    section: guessSection(text),
    weight: guessWeight(text),
    heart: guessHeart(text),
    by: "outlets",
  };
}

export async function retell(story, log = console.log) {
  if (!claudeEnabled()) return fallback(story);
  const material = story.articles
    .map((a, i) => `[${i + 1}] ${OUTLET_BY_ID[a.outlet]?.name || a.outlet}${a.published ? `, ${a.published.slice(0, 10)}` : ""}\nHeadline: ${a.title}\nSummary: ${a.summary || "(none)"}`)
    .join("\n\n");
  const out = await askJson({ system: SYSTEM, user: `Retell this story.\n\n${material}`, schema: SCHEMA, log, what: "retell" });
  if (!out) return fallback(story);
  if (!SECTIONS.includes(out.section)) out.section = fallback(story).section;
  return { ...out, by: "claude" };
}
