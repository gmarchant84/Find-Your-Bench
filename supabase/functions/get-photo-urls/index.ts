import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BUCKET = "bench-photos";
const MAX_PATHS = 1000;

/** Storage path of the thumbnail companion object for a photo path. */
function thumbPath(path: string): string {
  return path.replace(/(\.[A-Za-z0-9]+)$/, "_thumb$1");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => null);
    const paths: unknown = body?.paths;
    // 'thumb' asks for the small companion object when it exists (falling back
    // to the original); 'full' (the default) signs the original. Older app
    // bundles send no size field and expect originals for everything.
    const wantThumb: boolean = body?.size === "thumb";

    if (!Array.isArray(paths) || paths.length === 0) {
      return new Response(
        JSON.stringify({ error: "paths must be a non-empty array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Sanitize: strings only, no path traversal, capped batch size
    const clean = paths
      .filter((p): p is string => typeof p === "string" && p.length > 0)
      .map((p) => p.replace(/^\/+/, ""))
      .filter((p) => !p.includes(".."))
      .slice(0, MAX_PATHS);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    // The batch API returns signed paths like "/object/sign/..." - make them
    // absolute against the project URL so <img src> works directly.
    const baseUrl = Deno.env.get("SUPABASE_URL")!;
    const absolutize = (u: string): string =>
      u.startsWith("http") ? u : baseUrl + "/storage/v1" + u;

    // First attempt: thumbnails when requested, originals otherwise.
    const firstTargets = wantThumb ? clean.map(thumbPath) : clean;
    const { data: first, error: firstError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(firstTargets, 3600);
    if (firstError) throw firstError;

    const urls: Record<string, string> = {};
    const missingThumbs: Array<{ req: string; obj: string }> = [];

    // Map signed results by object path (the batch API returns each item's path).
    const signedByPath = new Map<string, string>();
    for (const item of first ?? []) {
      const signed: string | undefined = (item as { signedURL?: string }).signedURL;
      if (!item.error && signed) signedByPath.set(item.path, absolutize(signed));
    }

    for (let i = 0; i < clean.length; i++) {
      const signed = signedByPath.get(firstTargets[i]);
      if (signed) {
        urls[clean[i]] = signed;
      } else if (wantThumb) {
        // Thumbnail companion not uploaded yet (legacy photo) - fall back to
        // the original object.
        missingThumbs.push({ req: clean[i], obj: clean[i] });
      }
    }

    if (missingThumbs.length > 0) {
      const { data: fallback, error: fallbackError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(
          missingThumbs.map((m) => m.obj),
          3600,
        );
      if (fallbackError) throw fallbackError;
      const fallbackByPath = new Map<string, string>();
      for (const item of fallback ?? []) {
        const signed: string | undefined = (item as { signedURL?: string }).signedURL;
        if (!item.error && signed) fallbackByPath.set(item.path, absolutize(signed));
      }
      for (const m of missingThumbs) {
        const signed = fallbackByPath.get(m.obj);
        if (signed) urls[m.req] = signed;
      }
    }

    return new Response(
      JSON.stringify({ urls }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("get-photo-urls error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
