import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Canonical host (the apex 307-redirects to www).
const APP_URL = "https://www.findyourbench.app";
const DEFAULT_OG_IMAGE = `${APP_URL}/api/og-image`;
const BUCKET = "bench-photos";
const PUBLIC_URL_MARKER = `/storage/v1/object/public/${BUCKET}/`;

// The crawler stub must never be stored by a shared cache: the same /bench/:id
// URL serves the SPA to people (see api/bench-preview.ts).
const NO_SHARED_CACHE = { "Cache-Control": "private, no-store, max-age=0", Vary: "User-Agent" };

/**
 * Stored photo values are a bare storage path ("uid/file.jpg"), a legacy public
 * URL containing PUBLIC_URL_MARKER, or an external URL (seed photos).
 * Returns the storage path for bucket photos, or null for external URLs.
 */
function storagePath(raw: string): string | null {
  const i = raw.indexOf(PUBLIC_URL_MARKER);
  if (i >= 0) return raw.slice(i + PUBLIC_URL_MARKER.length);
  if (/^https?:\/\//i.test(raw)) return null;
  return raw.replace(/^\/+/, "");
}
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
  const appLink = url.includes("?") ? `${url}&from=og` : `${url}?from=og`;
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

  <link rel="canonical" href="${u}" />
</head>
<body>
  <!-- No meta refresh: this stub is for link-preview crawlers only. The
       ?from=og link always serves the app, so it can never loop. -->
  <p><a href="${escapeHtml(appLink)}">${t}</a></p>
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
        { status: 200, headers: { ...corsHeaders, ...NO_SHARED_CACHE, "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
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
        { status: 404, headers: { ...corsHeaders, ...NO_SHARED_CACHE, "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    const benchUrl = `${APP_URL}/bench/${bench.id}`;
    const raw: string | null = Array.isArray(bench.photos) && bench.photos.length > 0
      ? bench.photos[0]
      : null;
    const path = raw ? storagePath(raw) : null;

    // ?image=1: used by api/og-image.ts (the stable og:image URL) to get a
    // freshly signed URL for the bench's first photo.
    if (url.searchParams.get("image") === "1") {
      let signedUrl: string | null = null;
      if (path) {
        const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, 600);
        signedUrl = signed?.signedUrl ?? null;
      } else if (raw) {
        signedUrl = raw;
      }
      return new Response(JSON.stringify({ url: signedUrl }), {
        status: signedUrl ? 200 : 404,
        headers: { ...corsHeaders, ...NO_SHARED_CACHE, "Content-Type": "application/json" },
      });
    }

    // There is deliberately no redirect for non-crawler user agents here:
    // the caller (api/bench-preview.ts) already decided this is a crawler, and
    // a 302 back to /bench/:id sent it into a server-side redirect loop for
    // UAs the two crawler lists disagreed on (e.g. Pinterest, Snapchat).

    const title = `${bench.name} | ${SITE_NAME}`;

    const description = bench.description
      ? bench.description.length > 120
        ? bench.description.slice(0, 117) + "…"
        : bench.description
      : `Discover this bench on ${SITE_NAME}.`;

    // The photo bucket is private and signed URLs expire after minutes, so
    // og:image points at a stable app URL that signs on demand. External seed
    // photos (e.g. pexels) pass through unchanged.
    // The card endpoint draws a 1200x630 image (photo, name, rating, and
    // branding) for every bench, with or without a photo.
    const image = `${APP_URL}/api/og-image?id=${encodeURIComponent(bench.id)}`;

    const html = buildHtml({ url: benchUrl, title, description, image });

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        ...NO_SHARED_CACHE,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (err) {
    console.error(err);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
