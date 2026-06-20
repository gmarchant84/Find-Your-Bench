import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const APP_URL = "https://findyourbench.app";
const DEFAULT_OG_IMAGE = `${APP_URL}/ChatGPT_Image_May_26,_2026,_09_16_01_PM.png`;
const SITE_NAME = "Find Your Bench";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildHtml(opts: {
  url: string;
  title: string;
  description: string;
  image: string;
}): string {
  const { url, title, description, image } = opts;
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const u = escapeHtml(url);
  const img = escapeHtml(image);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${t}</title>
  <meta name="description" content="${d}" />

  <meta property="og:type" content="website" />
  <meta property="og:url" content="${u}" />
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:image" content="${img}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${img}" />

  <meta http-equiv="refresh" content="0; url=${u}" />
  <link rel="canonical" href="${u}" />
</head>
<body>
  <p>Redirecting to <a href="${u}">${t}</a>…</p>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return new Response(
        buildHtml({
          url: APP_URL,
          title: SITE_NAME,
          description: "Discover, rate, and share your favorite benches in the wild. The community-powered bench map.",
          image: DEFAULT_OG_IMAGE,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: bench } = await supabase
      .from("benches")
      .select("id, name, description, photos, latitude, longitude")
      .eq("id", id)
      .maybeSingle();

    if (!bench) {
      return new Response(
        buildHtml({
          url: APP_URL,
          title: SITE_NAME,
          description: "Discover, rate, and share your favorite benches in the wild.",
          image: DEFAULT_OG_IMAGE,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    const benchUrl = `${APP_URL}/bench/${bench.id}`;
    const title = `${bench.name} | ${SITE_NAME}`;

    const description = bench.description
      ? bench.description.length > 120
        ? bench.description.slice(0, 117) + "…"
        : bench.description
      : `Discover this bench on ${SITE_NAME}.`;

    const image =
      Array.isArray(bench.photos) && bench.photos.length > 0
        ? bench.photos[0]
        : DEFAULT_OG_IMAGE;

    const html = buildHtml({ url: benchUrl, title, description, image });

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error(err);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
