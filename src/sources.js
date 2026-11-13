// Where Yard Memory reads from. Each outlet is read through its RSS feed when
// that feed works, and through its homepage when it doesn't. Article pages are
// then visited once to pick up the share image, summary and publish time that
// the outlet itself publishes for link previews (og:* tags).
//
// Loop News is left out on purpose: its robots.txt disallows automated access.

export const OUTLETS = [
  {
    id: "gl",
    name: "The Gleaner",
    site: "https://jamaica-gleaner.com",
    rss: "https://jamaica-gleaner.com/feed/rss.xml",
    pages: ["https://jamaica-gleaner.com/latest"],
    articleUrl: /^https:\/\/jamaica-gleaner\.com\/article\/[a-z-]+\/\d{8}\/[a-z0-9-]+$/,
  },
  {
    id: "obs",
    name: "Jamaica Observer",
    site: "https://www.jamaicaobserver.com",
    // The Observer feed is often cut off mid-item, so the reader keeps only
    // complete <item> blocks and the homepage list fills any gap.
    rss: "https://www.jamaicaobserver.com/feed/",
    pages: ["https://www.jamaicaobserver.com/category/latest-news/"],
    articleUrl: /^https:\/\/www\.jamaicaobserver\.com\/\d{4}\/\d{2}\/\d{2}\/[a-z0-9-]+\/?$/,
  },
  {
    id: "nw",
    name: "Nationwide 90FM",
    site: "https://nationwideradiojm.com",
    rss: "https://nationwideradiojm.com/feed/",
    pages: [],
    articleUrl: /^https:\/\/nationwideradiojm\.com\/[a-z0-9-]+\/?$/,
  },
  {
    id: "rjr",
    name: "RJR News",
    site: "https://radiojamaicanewsonline.com",
    rss: null,
    pages: ["https://radiojamaicanewsonline.com/"],
    articleUrl: /^https:\/\/radiojamaicanewsonline\.com\/(local|business|sports|entertainment|international)\/[a-z0-9-]+$/,
  },
  {
    id: "ot",
    name: "OUR Today",
    site: "https://our.today",
    rss: null,
    pages: ["https://our.today/"],
    articleUrl: /^https:\/\/our\.today\/[a-z0-9-]{12,}\/?$/,
  },
];

export const OUTLET_BY_ID = Object.fromEntries(OUTLETS.map((o) => [o.id, o]));

// Identify the crawler honestly. Outlets can see who is visiting and why.
export const USER_AGENT =
  "YardMemoryBot/0.1 (+https://github.com/da3ferg/yard-memory; weekly Jamaican news digest with links back)";
