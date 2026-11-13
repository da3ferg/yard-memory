// Retells a story from the headlines and summaries the outlets published.
// Uses Claude when ANTHROPIC_API_KEY is set; otherwise falls back to the
// outlets' own headline and summary so the site always builds.
import Anthropic from "@anthropic-ai/sdk";
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

let client;
const enabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

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
  if (!enabled()) return fallback(story);
  client ||= new Anthropic();
  const material = story.articles
    .map((a, i) => `[${i + 1}] ${OUTLET_BY_ID[a.outlet]?.name || a.outlet}${a.published ? `, ${a.published.slice(0, 10)}` : ""}\nHeadline: ${a.title}\nSummary: ${a.summary || "(none)"}`)
    .join("\n\n");
  try {
    const res = await client.beta.messages.create({
      model: process.env.CLAUDE_MODEL || "claude-opus-5-5",
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      // If a request is ever declined, the API retries it on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content: `Retell this story.\n\n${material}` }],
    });
    if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") {
      log(`    retell: ${res.stop_reason} for "${story.articles[0].title}", using outlet text`);
      return fallback(story);
    }
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const out = JSON.parse(text);
    if (!SECTIONS.includes(out.section)) out.section = fallback(story).section;
    return { ...out, by: "claude" };
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) log("    retell: rate limited, using outlet text");
    else if (err instanceof Anthropic.AuthenticationError) log("    retell: ANTHROPIC_API_KEY was rejected, using outlet text");
    else if (err instanceof Anthropic.APIError) log(`    retell: API error ${err.status}, using outlet text`);
    else if (err instanceof SyntaxError) log("    retell: reply was not valid JSON, using outlet text");
    else throw err;
    return fallback(story);
  }
}
