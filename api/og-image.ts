export const config = { runtime: "edge" };

// Stable og:image URL for a bench: /api/og-image?id=<benchId>.
// Bench photos live in a private bucket, so a signed URL put straight into
// og:image expires after an hour and breaks when platforms re-fetch the
// preview. This endpoint asks the bench-og function for a freshly signed URL
// on every (CDN-missed) request and streams the image back.

const SUPABASE_URL = "https://ubgnmvplrygcszjekeqv.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViZ25tdnBscnlnY3N6amVrZXF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NDc4OTYsImV4cCI6MjA4OTAyMzg5Nn0.bhn1QPR8lgM3dmXx5nMCmfxqHCk-36XKDAnxaljCq5k";
const DEFAULT_IMAGE = "https://www.findyourbench.app/fyb-logo.png";

export default async function handler(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  const fallback = () =>
    new Response(null, {
      status: 302,
      headers: { Location: DEFAULT_IMAGE, "cache-control": "public, max-age=300" },
    });
  if (!id) return fallback();

  try {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/bench-og?id=${encodeURIComponent(id)}&image=1`,
      { headers: { Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY } },
    );
    if (!res.ok) return fallback();
    const { url } = (await res.json()) as { url?: string };
    if (!url) return fallback();

    const img = await fetch(url);
    const type = img.headers.get("content-type") || "";
    if (!img.ok || !type.startsWith("image/")) return fallback();

    return new Response(img.body, {
      status: 200,
      headers: {
        "content-type": type,
        // Same bytes for everyone; the signed URL never leaves the server.
        "cache-control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch {
    return fallback();
  }
}
