// Reads recent public posts about Jamaica from the X API (v2 recent search).
// Runs only when X_BEARER_TOKEN is set; the X API is a paid product, so the
// rest of Yard Memory works without it.

const SEARCH_URL = "https://api.x.com/2/tweets/search/recent";

// Keep the query broad but Jamaican. Edit X_QUERY in the workflow to tune it.
export const DEFAULT_QUERY =
  '(Jamaica OR Jamaican OR #Jamaica OR #JamaicaNews OR "Gordon House" OR Kingston OR MoBay OR "Reggae Boyz") lang:en -is:retweet -is:reply';

export async function fetchX({ token = process.env.X_BEARER_TOKEN, query = process.env.X_QUERY || DEFAULT_QUERY, log = console.log } = {}) {
  if (!token) {
    log("  X: skipped (no X_BEARER_TOKEN)");
    return [];
  }
  const params = new URLSearchParams({
    query,
    max_results: "100",
    "tweet.fields": "created_at,public_metrics,author_id,lang",
    expansions: "author_id",
    "user.fields": "username,name,verified",
  });
  const res = await fetch(`${SEARCH_URL}?${params}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 429) {
    log("  X: rate limited, skipping this run");
    return [];
  }
  if (!res.ok) {
    log(`  X: failed (${res.status} ${await res.text().catch(() => "")})`);
    return [];
  }
  const body = await res.json();
  const users = Object.fromEntries((body.includes?.users || []).map((u) => [u.id, u]));
  const posts = (body.data || []).map((t) => {
    const m = t.public_metrics || {};
    const u = users[t.author_id] || {};
    return {
      id: t.id,
      text: t.text,
      created: t.created_at,
      author: u.name || null,
      username: u.username || null,
      url: u.username ? `https://x.com/${u.username}/status/${t.id}` : `https://x.com/i/web/status/${t.id}`,
      engagement: (m.like_count || 0) + 2 * (m.retweet_count || 0) + (m.reply_count || 0) + (m.quote_count || 0),
    };
  });
  log(`  X: ${posts.length} posts`);
  return posts;
}
