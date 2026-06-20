import type { NextRequest } from "next/server";

export const config = { runtime: "edge" };

const CRAWLER_UA =
  /facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|Discordbot|Applebot|WhatsApp|iMessage|TelegramBot|Pinterest|Snapchat|bot|crawler|spider/i;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

export default async function handler(req: NextRequest) {
  // Extract bench id from the path /bench/:id
  const match = req.nextUrl.pathname.match(/^\/bench\/([0-9a-f-]{36})$/i);
  if (!match) {
    return new Response(null, { status: 302, headers: { Location: "/" } });
  }

  const id = match[1];
  const ua = req.headers.get("user-agent") || "";

  // Regular browsers: let the SPA handle it (serve index.html)
  if (!CRAWLER_UA.test(ua)) {
    const spaResponse = await fetch(new URL("/index.html", req.nextUrl.origin));
    return new Response(spaResponse.body, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  // Crawlers: proxy to Supabase edge function for OG HTML
  const ogUrl = `${SUPABASE_URL}/functions/v1/bench-og?id=${id}`;
  const ogRes = await fetch(ogUrl, {
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
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
}
