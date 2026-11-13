// Builds the static site in site/ from data/weeks/*.json.
//   site/index.html          the current week
//   site/weeks/<week>.html   every week, kept forever: the memory
//   site/archive.html        list of all weeks
import { readdir, writeFile, mkdir, copyFile } from "node:fs/promises";
import { readJson } from "./util.js";

const SHOW_IMAGES = (process.env.SHOW_PUBLISHER_IMAGES ?? "true") !== "false";
const esc = (t = "") => String(t).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=JetBrains+Mono:wght@400;600&display=swap">`;

function shell({ title, root, body, description }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
${FONTS}<link rel="stylesheet" href="${root}assets/style.css"></head>
${body}</html>`;
}

function masthead(w, root, issueNo) {
  return `<header class="mast"><div class="mastrow"><h1 class="brand"><a href="${root}index.html" style="text-decoration:none">Yard<span>.</span>Memory</a></h1>
<div class="issue">${esc(w.week.replace("-", " · "))} · <b>${esc(w.label)}</b><br>Issue ${String(issueNo).padStart(3, "0")} · ${w.outlets.length} outlets · ${w.articlesRead} stories read${w.xPostsRead ? ` · ${w.xPostsRead} X posts` : ""}</div></div>
<p class="tagline">What Jamaica talked about this week, gathered from across the island's newsrooms${w.xPostsRead ? " and X" : ""}, ranked by how much it matters and how widely it travelled.</p>
<nav class="topnav"><a href="${root}index.html">This week</a><a href="${root}archive.html">The memory</a></nav></header>`;
}

function pulse(w) {
  const top = w.stories[0];
  const cells = [
    top && [`${top.reach} of ${w.outlets.length}`, `outlets carried the week's top story: ${top.headline}`],
    [String(w.articlesRead), "articles read from Jamaican newsrooms this week"],
    [String(w.stories.filter((s) => s.reach > 1).length), "stories covered by more than one outlet"],
    w.xPostsRead ? [String(w.xPostsRead), "recent posts read from X"] : null,
  ].filter(Boolean);
  return `<h3 class="sec">The pulse</h3><div class="pulse">${cells.map(([n, l]) => `<div><div class="n">${esc(n)}</div><div class="l">${esc(l)}</div></div>`).join("")}</div>`;
}

function xSection(w) {
  if (!w.xTop?.length) return "";
  return `<h3 class="sec">What X is saying</h3><div class="xgrid">${w.xTop
    .map((p) => `<a class="xpost" href="${esc(p.url)}" target="_blank" rel="noopener"><div class="who">${esc(p.author || "")} @${esc(p.username || "")}</div>${esc(p.text)}<div class="eng">${p.engagement.toLocaleString()} engagements</div></a>`)
    .join("")}</div>`;
}

function timeline(weeks, current, root) {
  return `<h3 class="sec">The memory</h3><div class="timeline">${weeks
    .slice(-8)
    .reverse()
    .map((w) => `<a class="week ${w.week === current ? "now" : ""}" href="${root}weeks/${w.week}.html" style="text-decoration:none;color:inherit"><div class="wk">${esc(w.week)} · ${esc(w.label)}</div><div class="wt">${esc(w.stories.slice(0, 3).map((s) => s.stamp).join(", "))}</div></a>`)
    .join("")}</div>`;
}

const HOW = `<h3 class="sec">How a story makes the front</h3><div class="how">
<div><h5>Reach</h5><p>How many separate newsrooms carried it. A story on five outlets outranks a scoop on one.</p></div>
<div><h5>Weight</h5><p>National consequence: money, safety, governance, the recovery.</p></div>
<div><h5>Heart</h5><p>Human stakes: a missing son, a child in hospital, schoolboys meeting a hero.</p></div>
<div><h5>Talk</h5><p>How much Jamaicans on X are engaging with it.</p></div></div>`;

const FOOTER = `<footer>Stories are short retellings of reporting by Jamaican outlets, with links to every original. Read the originals for full detail.
${SHOW_IMAGES ? "Photos belong to the outlets credited on each image and link back to their reporting." : "Cover art is generated."} Retellings are written by Claude from the outlets' headlines and summaries.</footer>`;

function weekPage(w, weeks, root, issueNo) {
  const body = `<body data-images="${SHOW_IMAGES}"><div class="wrap">${masthead(w, root, issueNo)}
<nav class="filters" id="filters" aria-label="Filter by section"></nav><section id="leadSlot"></section>
${pulse(w)}<div id="sections"></div>${xSection(w)}${timeline(weeks, w.week, root)}${HOW}${FOOTER}</div>
<dialog id="reader" aria-label="Story"></dialog>
<script type="application/json" id="week-data">${JSON.stringify(w).replace(/</g, "\\u003c")}</script>
<script src="${root}assets/client.js"></script></body>`;
  const top = w.stories[0];
  return shell({ title: `Yard Memory · ${w.label}`, root, body, description: top ? `${top.headline}. ${top.dek}` : "A weekly memory of Jamaica." });
}

function archivePage(weeks) {
  const body = `<body><div class="wrap"><header class="mast"><div class="mastrow"><h1 class="brand"><a href="index.html" style="text-decoration:none">Yard<span>.</span>Memory</a></h1></div>
<p class="tagline">Every week Jamaica talked about, kept.</p><nav class="topnav"><a href="index.html">This week</a><a href="archive.html">The memory</a></nav></header>
<h3 class="sec">All weeks</h3><div class="weeks">${weeks
    .slice()
    .reverse()
    .map((w) => `<div class="week"><a href="weeks/${w.week}.html"><div class="wk">${esc(w.week)} · ${esc(w.label)}</div><div class="wt">${esc(w.stories[0]?.headline || "")}</div></a><p class="src" style="margin:8px 0 0">${w.stories.length} stories</p></div>`)
    .join("")}</div>${FOOTER}</div></body>`;
  return shell({ title: "Yard Memory · The memory", root: "", body, description: "Every week of Yard Memory." });
}

async function main() {
  const files = (await readdir("data/weeks").catch(() => [])).filter((f) => f.endsWith(".json")).sort();
  const weeks = [];
  for (const f of files) weeks.push(await readJson(`data/weeks/${f}`));
  await mkdir("site/weeks", { recursive: true });
  await mkdir("site/assets", { recursive: true });
  await copyFile("src/style.css", "site/assets/style.css");
  await copyFile("src/client.js", "site/assets/client.js");
  if (!weeks.length) {
    await writeFile("site/index.html", shell({ title: "Yard Memory", root: "", description: "A weekly memory of Jamaica.", body: `<body><div class="wrap"><p class="empty">The first issue is being collected.</p></div></body>` }));
    return console.log("No weeks yet; wrote placeholder.");
  }
  for (const [i, w] of weeks.entries()) await writeFile(`site/weeks/${w.week}.html`, weekPage(w, weeks, "../", i + 1));
  await writeFile("site/index.html", weekPage(weeks.at(-1), weeks, "", weeks.length));
  await writeFile("site/archive.html", archivePage(weeks));
  await writeFile("site/.nojekyll", "");
  console.log(`Built ${weeks.length} week(s) into site/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
