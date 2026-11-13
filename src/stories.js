// Turns a pile of articles into ranked stories:
// 1. group articles from different outlets that report the same event,
// 2. score each group on reach, weight, heart, talk and freshness.
import { hash } from "./util.js";

const STOP = new Set(`a an the of to in on for and or but at by with from as is are was were be been being it its this that these those
into over after before about against amid says say said new more than not no up out down off his her their our your
he she they we you i who what when where why how will would can could should may might has have had do does did
gov't govt jamaica jamaican jamaicans ja island man woman two three four five one six seven eight nine ten`.split(/\s+/));

export function tokens(title) {
  return new Set(
    title
      .toLowerCase()
      .replace(/[‘’']/g, "")
      .replace(/[^a-z0-9$ ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w))
  );
}

// Two headlines are about the same story when they share enough words, or
// share two words that are rare this week (names, places, figures).
function similar(a, b, df) {
  let shared = 0, rare = 0;
  for (const t of a) if (b.has(t)) { shared++; if ((df.get(t) || 0) <= 4) rare++; }
  const jaccard = shared / (a.size + b.size - shared || 1);
  return jaccard >= 0.34 || shared >= 3 || rare >= 2;
}

// groups: optional array of arrays of item indexes (from Claude); otherwise
// headlines are grouped by shared words.
export function cluster(items, groups = null) {
  const toks = items.map((i) => tokens(i.title));
  const df = new Map();
  for (const t of toks) for (const w of t) df.set(w, (df.get(w) || 0) + 1);
  const parent = items.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  if (groups) {
    for (const g of groups) for (const i of g.slice(1)) if (items[i] && items[g[0]]) parent[find(i)] = find(g[0]);
  } else {
    for (let i = 0; i < items.length; i++)
      for (let j = i + 1; j < items.length; j++)
        if (similar(toks[i], toks[j], df)) parent[find(i)] = find(j);
  }
  const byRoot = new Map();
  items.forEach((it, i) => {
    const r = find(i);
    if (!byRoot.has(r)) byRoot.set(r, []);
    byRoot.get(r).push(it);
  });
  return [...byRoot.values()].map((articles) => {
    articles.sort((a, b) => (b.summary?.length || 0) - (a.summary?.length || 0));
    return {
      key: hash(articles.map((a) => a.url).sort().join("|")),
      articles,
      tokens: [...new Set(articles.flatMap((a) => [...tokens(a.title)]))],
    };
  });
}

// --- heuristics, used when Claude is not available and to sanity-check it ---
const SECTION_WORDS = {
  life: /viral|cardi b|bzr|tiktok|influencer|spacex|flights?\b|gas prices|at the pump|taxi/i,
  recovery: /melissa|hurricane|recovery|rebuild|reconstruction|narra|resilien|nht|breakaway|imf|debt|idb/i,
  justice: /police|jcf|shot|kill|murder|court|bail|charged|arrest|robbery|prison|correctional|inmate|missing|gunmen|fraud|crime|larcen/i,
  world: /\bus\b|u\.s\.|trump|china|venezuela|ukraine|russia|united nations|\bun\b|privy council|guyana|trinidad|haiti|cuba|caricom|nvidia|climate talks/i,
  nation: /parliament|gordon house|speaker|opposition|pnp|jlp|minister|holness|golding|censure|senate|senator|contract|audit|\bgovernment\b|\bmp\b/i,
  sport: /boyz|reggae girlz|football|cricket|windies|netball|sunshine girls|athlet|olympic|\bissa\b|dacosta|manning cup|basketball|fiba|racing|caymanas|festival|\bart\b|\barts\b|culture|music|dancehall|reggae|\bfilm/i,
};
const WEIGHT = /billion|million|\$\d|imf|debt|budget|parliament|speaker|prime minister|holness|policy|law|tax|price|recovery|hurricane|murder|shot|kill|prison|court|election|nation|government/i;
const HEART = /child|girl|boy|family|mother|father|missing|dies|dead|death|killed|hospital|icu|students?|schoolboy|celebrat|hero|dream|love|grieving|struck|survivor/i;

export function guessSection(text) {
  for (const [sec, re] of Object.entries(SECTION_WORDS)) if (re.test(text)) return sec;
  return "life";
}
export const guessWeight = (t) => Math.min(3, (t.match(new RegExp(WEIGHT, "gi")) || []).length);
export const guessHeart = (t) => Math.min(3, (t.match(new RegExp(HEART, "gi")) || []).length);

// How much X is talking about a story: engagement on posts that share at
// least two meaningful words with the story's headlines.
export function talkFor(story, posts) {
  const st = new Set(story.tokens);
  const matched = posts.filter((p) => {
    let n = 0;
    for (const t of tokens(p.text)) if (st.has(t) && ++n >= 2) return true;
    return false;
  });
  const engagement = matched.reduce((s, p) => s + p.engagement, 0);
  const talk = engagement > 5000 ? 3 : engagement > 1000 ? 2 : engagement > 100 ? 1 : 0;
  return { talk, posts: matched.sort((a, b) => b.engagement - a.engagement).slice(0, 3) };
}

export function freshness(story, now = Date.now()) {
  const times = story.articles.map((a) => Date.parse(a.published || a.firstSeen)).filter(Number.isFinite);
  if (!times.length) return 0;
  const hours = (now - Math.max(...times)) / 3600000;
  return hours < 24 ? 2 : hours < 72 ? 1 : 0;
}

export function score(s) {
  return s.reach * 3 + s.weight * 2.5 + s.heart * 2 + s.talk * 1.5 + s.fresh;
}
