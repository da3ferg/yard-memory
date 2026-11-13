// One update run: read the outlets (and X), group and rank this week's
// stories, retell the ones that are new or have grown, and save the week.
//
//   node src/run.js                      live run
//   node src/run.js --offline file.json  use saved articles instead of the web
import { readFile } from "node:fs/promises";
import { fetchAllNews } from "./fetch-news.js";
import { fetchX } from "./fetch-x.js";
import { cluster, talkFor, freshness, score } from "./stories.js";
import { retell } from "./retell.js";
import { groupHeadlines } from "./group.js";
import { claudeEnabled } from "./claude.js";
import { OUTLET_BY_ID } from "./sources.js";
import { readJson, writeJson, weekId, weekRange, weekLabel } from "./util.js";

const ITEMS = "data/items.json";
const CACHE = "data/retell-cache.json";
const MAX_STORIES = Number(process.env.MAX_STORIES || 30);
const KEEP_DAYS = 21;

const log = (...a) => console.log(...a);

async function main() {
  const offline = process.argv.indexOf("--offline");
  const now = new Date();
  const known = await readJson(ITEMS, {});

  log("Reading outlets…");
  const fresh = offline > -1 ? JSON.parse(await readFile(process.argv[offline + 1], "utf8")) : await fetchAllNews(known, log);
  for (const it of fresh) {
    const prev = known[it.url];
    known[it.url] = { ...prev, ...Object.fromEntries(Object.entries(it).filter(([, v]) => v != null)), firstSeen: prev?.firstSeen || now.toISOString() };
  }
  // Forget articles older than the archive window; finished weeks keep their stories.
  const cutoff = now.getTime() - KEEP_DAYS * 86400000;
  for (const [url, it] of Object.entries(known)) if (Date.parse(it.published || it.firstSeen) < cutoff) delete known[url];
  await writeJson(ITEMS, known);

  const week = process.env.WEEK || weekId(now);
  const { start, end } = weekRange(week);
  const inWeek = Object.values(known).filter((it) => {
    const t = Date.parse(it.published || it.firstSeen);
    return t >= start.getTime() && t <= end.getTime();
  });
  log(`${inWeek.length} articles in ${week}`);

  log("Reading X…");
  const posts = offline > -1 ? [] : await fetchX({ log });

  const cache = await readJson(CACHE, {});
  log("Grouping headlines…");
  inWeek.sort((a, b) => a.url.localeCompare(b.url));
  const groups = await groupHeadlines(inWeek, log);
  let stories = cluster(inWeek, groups).map((s) => {
    const { talk, posts: xPosts } = talkFor(s, posts);
    return { ...s, reach: new Set(s.articles.map((a) => a.outlet)).size, talk, xPosts, fresh: freshness(s, now.getTime()) };
  });
  // Rank first on what we can measure without Claude, then retell the top ones.
  stories.forEach((s) => (s.prelim = s.reach * 3 + s.talk * 1.5 + s.fresh + Math.min(2, s.articles.length - 1)));
  stories.sort((a, b) => b.prelim - a.prelim);
  stories = stories.slice(0, MAX_STORIES);

  log(`Retelling ${stories.length} stories…`);
  let calls = 0;
  for (const s of stories) {
    if (!cache[s.key] || (cache[s.key].by !== "claude" && claudeEnabled())) {
      cache[s.key] = await retell(s, log);
      if (cache[s.key].by === "claude") calls++;
    }
    Object.assign(s, { story: cache[s.key] });
    s.weight = s.story.weight;
    s.heart = s.story.heart;
    s.score = score(s);
  }
  log(`  ${calls} new retellings from Claude`);
  // Drop cache entries no longer used by any story in the archive window.
  const live = new Set(stories.map((s) => s.key));
  const prevWeek = await readJson(`data/weeks/${week}.json`, null);
  for (const s of prevWeek?.stories || []) live.add(s.key);
  for (const k of Object.keys(cache)) if (!live.has(k) && !cache[k].keep) delete cache[k];
  await writeJson(CACHE, cache);

  stories.sort((a, b) => b.score - a.score);
  const out = {
    week,
    label: weekLabel(week),
    updated: now.toISOString(),
    outlets: [...new Set(inWeek.map((i) => i.outlet))].map((id) => OUTLET_BY_ID[id]?.name || id),
    articlesRead: inWeek.length,
    xPostsRead: posts.length,
    stories: stories.map((s, i) => ({
      rank: i + 1,
      key: s.key,
      ...s.story,
      score: +s.score.toFixed(1),
      reach: s.reach,
      talk: s.talk,
      fresh: s.fresh,
      date: s.articles.map((a) => a.published || a.firstSeen).filter(Boolean).sort().at(-1) || null,
      image: s.articles.find((a) => a.image)?.image || null,
      imageCredit: OUTLET_BY_ID[s.articles.find((a) => a.image)?.outlet]?.name || null,
      sources: s.articles.map((a) => ({ outlet: OUTLET_BY_ID[a.outlet]?.name || a.outlet, title: a.title, url: a.url })),
      xPosts: s.xPosts,
    })),
    xTop: posts.sort((a, b) => b.engagement - a.engagement).slice(0, 8),
  };
  await writeJson(`data/weeks/${week}.json`, out);
  log(`Saved data/weeks/${week}.json with ${out.stories.length} stories`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
