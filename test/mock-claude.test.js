// Runs grouping and retelling against a local stand-in for the Claude API, to
// check the requests the app sends and how it reads the replies.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

const seen = [];
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const j = JSON.parse(body);
    seen.push({ url: req.url, headers: req.headers, body: j });
    const isGroup = j.system.startsWith("You group");
    const text = isGroup
      ? JSON.stringify({ groups: [[0, 1], [2]] })
      : JSON.stringify({ headline: "IMF says keep spending tight", dek: "The Fund wants debt falling faster.", paragraphs: ["One.", "Two."], stamp: "Spend tight", section: "recovery", weight: 3, heart: 1 });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: "msg_1", type: "message", role: "assistant", model: j.model, content: [{ type: "text", text }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }));
  });
});

test("grouping and retelling talk to the Claude API correctly", async () => {
  await new Promise((r) => server.listen(0, r));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.ANTHROPIC_API_KEY = "test-key";
  const { groupHeadlines } = await import("../src/group.js");
  const { retell } = await import("../src/retell.js");
  const items = [
    { outlet: "obs", title: "Keep spending tight, IMF tells Jamaica", url: "a" },
    { outlet: "ot", title: "IMF urges Jamaica to cut 66% debt load faster", url: "b" },
    { outlet: "gl", title: "Ronaldinho dream for Manning players", url: "c" },
  ];
  const groups = await groupHeadlines(items, () => {});
  assert.deepEqual(groups, [[0, 1]]);
  const story = await retell({ articles: items.slice(0, 2) }, () => {});
  assert.equal(story.by, "claude");
  assert.equal(story.section, "recovery");
  const req = seen[1];
  assert.equal(req.body.model, "claude-opus-5-5");
  assert.equal(req.body.output_config.format.type, "json_schema");
  assert.equal(req.body.fallbacks, "default");
  assert.match(req.headers["anthropic-beta"], /server-side-fallback-2026-07-01/);
  server.close();
});
