export const config = { runtime: "edge" };

const CRAWLER_UA =
  /facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|Discordbot|Applebot|WhatsApp|iMessage|TelegramBot|Pinterest|Snapchat|bot|crawler|spider/i;

// Hardcoded because VITE_ env vars are not available in Vercel edge functions
const SUPABASE_URL = "https://ubgnmvplrygcszjekeqv.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViZ25tdnBscnlnY3N6amVrZXF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NDc4OTYsImV4cCI6MjA4OTAyMzg5Nn0.bhn1QPR8lgM3dmXx5nMCmfxqHCk-36XKDAnxaljCq5k";
const APP_URL = "https://findyourbench.app";

export default async function handler(req: Request) {
  const url = new URL(req.url);

  // id injected via vercel.json rewrite: /bench/:id -> /api/bench-preview?id=:id
  const id = url.searchParams.get("id");
  if (!id) {
    return new Response(null, { status: 302, headers: { Location: APP_URL } });
  }

  const ua = req.headers.get("user-agent") || "";

  // Regular browsers: serve index.html so the SPA handles routing client-side
  // (Do NOT redirect to APP_URL — that causes a redirect loop via the Vercel domain redirect)
  if (!CRAWLER_UA.test(ua)) {
    const origin = new URL(req.url).origin;
    const indexRes = await fetch(`${origin}/index.html`);
    const html = await indexRes.text();
    return new Response(html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  // Crawlers: proxy to Supabase edge function for OG HTML
  try {
    const ogUrl = `${SUPABASE_URL}/functions/v1/bench-og?id=${id}`;
    const ogRes = await fetch(ogUrl, {
      headers: {
        Authorization: `Bearer ${ANON_KEY}`,
        apikey: ANON_KEY,
        "user-agent": ua,
      },
    });

    const html = await ogRes.text();
    return new Response(html, {
      status: ogRes.status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300, stale-while-revalidate=60",
      },
    });
  } catch {
    // Fallback: redirect to bench page
    return new Response(null, {
      status: 302,
      headers: { Location: `${APP_URL}/bench/${id}` },
    });
  }
}
