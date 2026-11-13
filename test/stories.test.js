import { test } from "node:test";
import assert from "node:assert/strict";
import { cluster, guessSection, score } from "../src/stories.js";
import { parseRss } from "../src/fetch-news.js";
import { weekId, weekRange } from "../src/util.js";

test("same story from different outlets is grouped", () => {
  const items = [
    { outlet: "obs", title: "SpaceX launch to trigger temporary flight restrictions in Jamaica", url: "1" },
    { outlet: "nw", title: "Flights across Jamaica to be delayed on Friday to facilitate SpaceX launch", url: "2" },
    { outlet: "gl", title: "Ronaldinho dream for Manning, daCosta Cup players", url: "3" },
  ];
  const c = cluster(items);
  assert.equal(c.length, 2);
  assert.equal(c.find((s) => s.articles.length === 2).articles.length, 2);
});

test("sections are guessed without matching inside words", () => {
  assert.equal(guessSection("Government warns Jamaicans not to take part in Russia-Ukraine war"), "world");
  assert.equal(guessSection("Police scrutiny intensifies in Sligoville"), "justice");
});

test("cut-off RSS still yields complete items", () => {
  const xml = `<rss><channel><item><title>One</title><link>https://x.com/1</link><media:content url="https://img/1.jpg"/></item><item><title>Two</title><link>https://x.co`;
  const items = parseRss(xml, { id: "obs" });
  assert.equal(items.length, 1);
  assert.equal(items[0].image, "https://img/1.jpg");
});

test("weeks run Monday to Sunday in Jamaica time", () => {
  assert.equal(weekId(new Date("2026-11-13T05:49:00Z")), "2026-W46");
  assert.equal(weekId(new Date("2026-11-16T04:59:00Z")), "2026-W46"); // Sunday 11:59pm in Kingston
  assert.equal(weekId(new Date("2026-11-16T05:00:00Z")), "2026-W47");
  assert.equal(weekRange("2026-W46").start.toISOString(), "2026-11-09T05:00:00.000Z");
});

test("reach counts most", () => {
  assert.ok(score({ reach: 5, weight: 0, heart: 0, talk: 0, fresh: 0 }) > score({ reach: 1, weight: 3, heart: 0, talk: 0, fresh: 0 }));
});
