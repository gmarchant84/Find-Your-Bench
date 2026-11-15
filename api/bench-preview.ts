export const config = { runtime: "edge" };

const CRAWLER_UA =
  /facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|Discordbot|Applebot|WhatsApp|iMessage|TelegramBot|Pinterest|Snapchat|bot|crawler|spider/i;

// Hardcoded because VITE_ env vars are not available in Vercel edge functions
const SUPABASE_URL = "https://ubgnmvplrygcszjekeqv.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViZ25tdnBscnlnY3N6amVrZXF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NDc4OTYsImV4cCI6MjA4OTAyMzg5Nn0.bhn1QPR8lgM3dmXx5nMCmfxqHCk-36XKDAnxaljCq5k";
// Canonical host. The apex 307-redirects to www, so never link to the apex.
const APP_URL = "https://www.findyourbench.app";

// The same URL returns different HTML to crawlers and to people, so neither
// response may be stored in a shared cache. A cached crawler stub served to
// browsers caused an endless reload loop on shared links.
const NO_SHARED_CACHE = {
  "cache-control": "private, no-store, max-age=0",
  vary: "User-Agent",
};

export default async function handler(req: Request) {
  const url = new URL(req.url);

  // id injected via vercel.json rewrite: /bench/:id -> /api/bench-preview?id=:id
  const id = url.searchParams.get("id");
  if (!id) {
    return new Response(null, { status: 302, headers: { Location: APP_URL, ...NO_SHARED_CACHE } });
  }

  const ua = req.headers.get("user-agent") || "";
  // ?from=og is the escape hatch linked from the crawler stub: always the app.
  const forceApp = url.searchParams.get("from") === "og";

  // Regular browsers: serve index.html so the SPA handles routing client-side
  // (Do NOT redirect to APP_URL — that causes a redirect loop via the Vercel domain redirect)
  if (forceApp || !CRAWLER_UA.test(ua)) {
    const origin = url.origin;
    const indexRes = await fetch(`${origin}/index.html`);
    const html = await indexRes.text();
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", ...NO_SHARED_CACHE },
    });
  }

  // Crawlers: proxy to Supabase edge function for OG HTML
  try {
    const ogUrl = `${SUPABASE_URL}/functions/v1/bench-og?id=${encodeURIComponent(id)}`;
    const ogRes = await fetch(ogUrl, {
      redirect: "manual",
      headers: {
        Authorization: `Bearer ${ANON_KEY}`,
        apikey: ANON_KEY,
        "user-agent": ua,
      },
    });
    if (ogRes.status >= 300 && ogRes.status < 400) throw new Error("unexpected redirect");

    const html = await ogRes.text();
    return new Response(html, {
      status: ogRes.status,
      headers: { "content-type": "text/html; charset=utf-8", ...NO_SHARED_CACHE },
    });
  } catch {
    // Fallback: hand the crawler the app shell rather than redirecting back
    // into this same handler.
    const indexRes = await fetch(`${url.origin}/index.html`);
    return new Response(await indexRes.text(), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", ...NO_SHARED_CACHE },
    });
  }
}
