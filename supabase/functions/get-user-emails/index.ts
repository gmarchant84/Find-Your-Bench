import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET") ?? "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const adminSecret = req.headers.get("x-admin-secret");
    if (adminSecret !== ADMIN_SECRET) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let username: string | undefined;
    try {
      const body = await req.json();
      username = body?.username;
    } catch {
      // empty or non-JSON body is fine — no filter applied
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all auth users via admin API
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers({
      perPage: 1000,
    });

    if (authError) throw authError;

    // Fetch profiles
    let profileQuery = supabase.from("profiles").select("id, username");
    if (username) {
      profileQuery = profileQuery.ilike("username", `%${username}%`);
    }
    const { data: profiles, error: profileError } = await profileQuery;
    if (profileError) throw profileError;

    const profileMap = new Map<string, string>(
      (profiles ?? []).map((p: { id: string; username: string | null }) => [p.id, p.username ?? ""])
    );

    // If filtering by username, restrict to matched profile IDs
    const allowedIds = username
      ? new Set((profiles ?? []).map((p: { id: string }) => p.id))
      : null;

    const result = users
      .filter((u) => !allowedIds || allowedIds.has(u.id))
      .map((u) => ({
        email: u.email ?? null,
        username: profileMap.get(u.id) ?? null,
        created_at: u.created_at,
      }));

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
