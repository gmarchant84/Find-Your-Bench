import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BUCKET = "bench-photos";
const MAX_PATHS = 1000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => null);
    const paths: unknown = body?.paths;

    if (!Array.isArray(paths) || paths.length === 0) {
      return new Response(
        JSON.stringify({ error: "paths must be a non-empty array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(clean, 3600);

    if (error) throw error;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const urls: Record<string, string> = {};
    for (const item of data ?? []) {
      if (item.error) continue;
      const signed: string | undefined = (item as { signedURL?: string }).signedURL;
      if (!signed) continue;
      urls[item.path] = signed.startsWith("http")
        ? signed
        : `${supabaseUrl}/storage/v1/object/sign/${BUCKET}/${item.path}?${signed.split("?")[1] ?? ""}`;
    }

    return new Response(
      JSON.stringify({ urls }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("get-photo-urls error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
