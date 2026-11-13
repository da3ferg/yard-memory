import * as cheerio from "cheerio";
import { OUTLETS, USER_AGENT } from "./sources.js";
import { decodeEntities, stripTags, sleep } from "./util.js";

const TIMEOUT_MS = 20000;
const PAUSE_MS = 800; // be polite between requests to the same outlet
const MAX_ENRICH_PER_OUTLET = 25;

async function get(url) {
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,application/rss+xml,application/xml;q=0.9,*/*;q=0.8" },
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : "";
};

// Tolerant RSS reader: keeps only complete <item> blocks, so a feed that is cut
// off half way (the Observer's often is) still yields its first stories.
export function parseRss(xml, outlet) {
  const items = [];
  for (const [, block] of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const url = decodeEntities(tag(block, "link")).trim();
    const title = stripTags(tag(block, "title"));
    if (!url || !title) continue;
    const media =
      block.match(/<media:content[^>]+url="([^"]+)"/i)?.[1] ||
      block.match(/<media:thumbnail[^>]+url="([^"]+)"/i)?.[1] ||
      block.match(/<enclosure[^>]+url="([^"]+\.(?:jpe?g|png|webp|avif)[^"]*)"/i)?.[1] ||
      tag(block, "content:encoded").match(/<img[^>]+src="([^"]+)"/i)?.[1] ||
      null;
    const pub = tag(block, "pubDate") || tag(block, "dc:date");
    items.push({
      url,
      outlet: outlet.id,
      title,
      summary: stripTags(tag(block, "description")).slice(0, 600) || null,
      image: media ? decodeEntities(media) : null,
      published: pub ? new Date(stripTags(pub)).toISOString() : null,
    });
  }
  return items;
}

// Homepage reader: every link that looks like one of the outlet's articles,
// with its link text as a provisional headline.
export function parseListing(html, outlet, base) {
  const $ = cheerio.load(html);
  const seen = new Map();
  $("a[href]").each((_, a) => {
    let href;
    try {
      href = new URL($(a).attr("href"), base).href.split("#")[0].split("?")[0];
    } catch {
      return;
    }
    href = href.replace("/index%2Ephp/", "/").replace("/index%2ephp/", "/");
    if (!outlet.articleUrl.test(href)) return;
    const text = $(a).text().replace(/\s+/g, " ").trim();
    const prev = seen.get(href);
    if (!prev || text.length > prev.title.length) seen.set(href, { url: href, outlet: outlet.id, title: text, summary: null, image: null, published: null });
  });
  return [...seen.values()].filter((i) => i.title.split(" ").length >= 4);
}

// Reads the preview metadata an outlet publishes for each article.
export function parseArticleMeta(html) {
  const $ = cheerio.load(html);
  const meta = (k) => $(`meta[property="${k}"]`).attr("content") || $(`meta[name="${k}"]`).attr("content") || null;
  return {
    title: meta("og:title"),
    summary: meta("og:description") || meta("description"),
    image: meta("og:image") || meta("twitter:image"),
    published: meta("article:published_time") || $("time[datetime]").first().attr("datetime") || null,
  };
}

export async function fetchOutlet(outlet, known, log = console.log) {
  const found = new Map();
  if (outlet.rss) {
    try {
      for (const it of parseRss(await get(outlet.rss), outlet)) found.set(it.url, it);
      log(`  ${outlet.name}: ${found.size} from RSS`);
    } catch (e) {
      log(`  ${outlet.name}: RSS failed (${e.message})`);
    }
  }
  for (const page of outlet.pages) {
    try {
      await sleep(PAUSE_MS);
      let n = 0;
      for (const it of parseListing(await get(page), outlet, page)) {
        if (!found.has(it.url)) { found.set(it.url, it); n++; }
      }
      log(`  ${outlet.name}: ${n} more from ${page}`);
    } catch (e) {
      log(`  ${outlet.name}: page failed ${page} (${e.message})`);
    }
  }

  // Visit new articles once for their image, summary and time.
  let enriched = 0;
  for (const it of found.values()) {
    const old = known[it.url];
    if (old) { Object.assign(it, { ...it, ...pickDefined(old) }); continue; }
    if (it.image && it.summary && it.published) continue;
    if (enriched >= MAX_ENRICH_PER_OUTLET) continue;
    try {
      await sleep(PAUSE_MS);
      const m = parseArticleMeta(await get(it.url));
      it.title = it.title || m.title;
      if (m.title && m.title.length > it.title.length && !/\|/.test(m.title)) it.title = m.title;
      it.summary = it.summary || (m.summary ? stripTags(m.summary).slice(0, 600) : null);
      it.image = it.image || m.image;
      it.published = it.published || (m.published ? new Date(m.published).toISOString() : null);
      enriched++;
    } catch (e) {
      log(`    could not read ${it.url} (${e.message})`);
    }
  }
  return [...found.values()];
}

const pickDefined = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null));

export async function fetchAllNews(known = {}, log = console.log) {
  const all = [];
  for (const outlet of OUTLETS) all.push(...(await fetchOutlet(outlet, known, log)));
  return all;
}
