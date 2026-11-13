// Front-end for a Yard Memory week page. Reads the week's JSON from #week-data.
const W = JSON.parse(document.getElementById("week-data").textContent);
const SECTIONS = {
  nation: { label: "The nation", hue: ["#b8322a", "#3a1410", "#e9b23a"] },
  recovery: { label: "After Melissa", hue: ["#1c5d7a", "#0d2633", "#8fc7d9"] },
  justice: { label: "Crime & justice", hue: ["#2b2f2d", "#0b0d0c", "#b8322a"] },
  life: { label: "Island life", hue: ["#1f5c45", "#0c2a1f", "#e9b23a"] },
  sport: { label: "Sport & culture", hue: ["#e9b23a", "#7a4d07", "#1f5c45"] },
  world: { label: "Jamaica & the world", hue: ["#4b4f7a", "#1b1d33", "#e9b23a"] },
};
const SHOW_IMAGES = document.body.dataset.images === "true";
const S = W.stories;
const esc = (t = "") => String(t).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "America/Jamaica" }) : "");
const outlets = (s) => [...new Set(s.sources.map((x) => x.outlet))];
const heatN = (s) => Math.max(1, Math.min(5, Math.round(s.score / 6)));
const heat = (s) => "●".repeat(heatN(s)) + "○".repeat(5 - heatN(s));

function rng(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; }; }
function paint(cv, s) {
  const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
  const w = Math.max(10, r.width), h = Math.max(10, r.height);
  cv.width = w * d; cv.height = h * d; const x = cv.getContext("2d"); x.scale(d, d);
  const [a, b, c] = (SECTIONS[s.section] || SECTIONS.life).hue, R = rng(s.key);
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, w, h);
  const mode = Math.floor(R() * 3); x.globalAlpha = 0.9;
  if (mode === 0) { x.fillStyle = c; x.beginPath(); x.arc(w * (0.25 + R() * 0.5), h * (0.3 + R() * 0.2), Math.min(w, h) * (0.18 + R() * 0.15), 0, 7); x.fill();
    for (let i = 0; i < 6; i++) { x.fillStyle = i % 2 ? a : b; x.globalAlpha = 0.35 + 0.1 * i; x.fillRect(0, h * (0.55 + i * 0.08), w, h * 0.05); } }
  else if (mode === 1) { for (let i = 0; i < 7; i++) { x.strokeStyle = i % 3 ? c : "#fff"; x.globalAlpha = 0.25 + R() * 0.5; x.lineWidth = 4 + R() * 22; x.beginPath(); x.moveTo(-20, h * R()); x.bezierCurveTo(w * 0.3, h * R(), w * 0.7, h * R(), w + 20, h * R()); x.stroke(); } }
  else { const n = 6 + Math.floor(R() * 6), sz = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < Math.ceil(h / sz); j++) if (R() < 0.35) { x.fillStyle = R() < 0.5 ? c : "#fff"; x.globalAlpha = 0.15 + R() * 0.5; x.beginPath(); x.arc(i * sz + sz / 2, j * sz + sz / 2, sz * 0.42 * R() + 2, 0, 7); x.fill(); } }
  x.globalAlpha = 1; const v = x.createLinearGradient(0, h * 0.4, 0, h); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.55)"); x.fillStyle = v; x.fillRect(0, 0, w, h);
}
const coverHTML = (s, cls = "") => {
  const img = SHOW_IMAGES && s.image;
  return `<div class="cover ${cls} ${img ? "has-img" : ""}"><canvas data-key="${s.key}" aria-hidden="true"></canvas>${img ? `<img src="${esc(s.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.remove('has-img');this.remove()"><span class="credit">Photo: ${esc(s.imageCredit)}</span>` : ""}<span class="stamp">${esc(s.stamp)}</span><span class="rank">#${s.rank}</span></div>`;
};
const kick = (s) => `<div class="kicker"><span>${(SECTIONS[s.section] || SECTIONS.life).label}</span><span class="heat" title="Score ${s.score}">${heat(s)}</span></div>`;
const meta = (s) => `${fmtDate(s.date)} · ${outlets(s).join(" · ")}`;

let filter = "all";
function render() {
  const list = S.filter((s) => filter === "all" || s.section === filter);
  const lead = list[0], rest = list.slice(1);
  document.getElementById("leadSlot").innerHTML = lead ? `<article class="lead" tabindex="0" data-open="${lead.key}">${coverHTML(lead)}<div>${kick(lead)}<h2>${esc(lead.headline)}</h2><p class="dek">${esc(lead.dek)}</p><div class="src">${meta(lead)}</div></div></article>` : `<p class="empty">No stories in this section yet this week.</p>`;
  const groups = filter === "all" ? [["Also moving the island", rest.slice(0, 8)], ["More from the week", rest.slice(8)]] : [[SECTIONS[filter].label, rest]];
  document.getElementById("sections").innerHTML = groups.filter((g) => g[1].length).map(([t, items]) => `<h3 class="sec">${t}</h3><div class="grid">${items.map((s) => `<button class="card" data-open="${s.key}">${coverHTML(s)}${kick(s)}<h4>${esc(s.headline)}</h4><p>${esc(s.dek)}</p><span class="src">${meta(s)}</span></button>`).join("")}</div>`).join("");
  requestAnimationFrame(() => document.querySelectorAll("canvas[data-key]").forEach((cv) => paint(cv, S.find((s) => s.key === cv.dataset.key))));
}
function buildFilters() {
  const f = document.getElementById("filters");
  const used = new Set(S.map((s) => s.section));
  f.innerHTML = [["all", "Everything"], ...Object.entries(SECTIONS).filter(([k]) => used.has(k)).map(([k, v]) => [k, v.label])].map(([k, l]) => `<button data-f="${k}" aria-pressed="${k === filter}">${l}</button>`).join("");
  f.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; filter = b.dataset.f; buildFilters(); render(); };
}
const dlg = document.getElementById("reader");
function openStory(key) {
  const s = S.find((x) => x.key === key); if (!s) return;
  dlg.innerHTML = `<button class="close" id="closeBtn">Close</button>${coverHTML(s, "rd-cover")}<div class="rd-body">${kick(s)}<h2>${esc(s.headline)}</h2>${(s.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join("")}
  ${s.xPosts?.length ? `<div class="rd-why">On X</div>${s.xPosts.map((p) => `<p><a href="${esc(p.url)}" target="_blank" rel="noopener">@${esc(p.username)}</a>: ${esc(p.text)}</p>`).join("")}` : ""}
  <div class="rd-why">Why it ranks #${s.rank}: carried by ${s.reach} outlet${s.reach > 1 ? "s" : ""} · weight ${s.weight}/3 · heart ${s.heart}/3 · talk ${s.talk}/3${s.by === "outlets" ? " · summary from the outlets" : " · retold by Claude from the outlets' reporting"}</div>
  <div class="rd-src">${s.sources.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.outlet)}: ${esc(x.title)} ↗</a>`).join("")}</div></div>`;
  dlg.showModal(); const cv = dlg.querySelector("canvas"); if (cv) paint(cv, s);
  document.getElementById("closeBtn").onclick = () => dlg.close();
  history.replaceState(null, "", "#" + key);
}
dlg.addEventListener("close", () => history.replaceState(null, "", location.pathname));
document.addEventListener("click", (e) => { const t = e.target.closest("[data-open]"); if (t) openStory(t.dataset.open); });
document.addEventListener("keydown", (e) => { if (e.key === "Enter") { const t = e.target.closest?.(".lead[data-open]"); if (t) openStory(t.dataset.open); } });
dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
buildFilters(); render();
if (location.hash.length > 1) openStory(location.hash.slice(1));
let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(render, 200); });
