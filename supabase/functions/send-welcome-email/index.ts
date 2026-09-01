import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function buildEmailHtml(username: string): string {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Find Your Bench</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f0;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <img src="https://findyourbench.app/fyb-logo.png" alt="Find Your Bench" width="64" height="64" style="display:block;border-radius:14px;" />
              <div style="margin-top:12px;font-size:20px;font-weight:800;color:#1a4d2e;letter-spacing:-0.5px;">Find Your Bench</div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border-radius:16px;padding:36px 32px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
              <p style="margin:0 0 8px 0;font-size:22px;font-weight:800;color:#111827;line-height:1.3;">Hey [username],</p>
              <p style="margin:0 0 24px 0;font-size:15px;color:#6b7280;">Welcome to the community. Glad you found us.</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 20px;">
                    <p style="margin:0;font-size:14px;color:#15803d;line-height:1.6;">
                      Fair warning: until you add your first bench, you're technically a <strong>ground-sitter</strong>. No judgment, we've all been there. But there's only one way to change that.
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 20px 0;font-size:15px;color:#374151;line-height:1.7;">
                Next time you're out and you find a good bench, rock, stump, or anything worth sitting on, add it to the map. Takes less than a minute. You'll be the reason someone else finds their perfect spot.
              </p>
              <p style="margin:0 0 12px 0;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Here's how</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
                    <table cellpadding="0" cellspacing="0"><tr>
                      <td style="width:28px;height:28px;background-color:#1a4d2e;border-radius:50%;text-align:center;vertical-align:middle;"><span style="color:#ffffff;font-size:12px;font-weight:700;">1</span></td>
                      <td style="padding-left:12px;font-size:14px;color:#374151;">Open <a href="https://findyourbench.app" style="color:#16a34a;font-weight:600;text-decoration:none;">findyourbench.app</a></td>
                    </tr></table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
                    <table cellpadding="0" cellspacing="0"><tr>
                      <td style="width:28px;height:28px;background-color:#1a4d2e;border-radius:50%;text-align:center;vertical-align:middle;"><span style="color:#ffffff;font-size:12px;font-weight:700;">2</span></td>
                      <td style="padding-left:12px;font-size:14px;color:#374151;">Tap the green <strong>+ Add Bench</strong> button</td>
                    </tr></table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;">
                    <table cellpadding="0" cellspacing="0"><tr>
                      <td style="width:28px;height:28px;background-color:#1a4d2e;border-radius:50%;text-align:center;vertical-align:middle;"><span style="color:#ffffff;font-size:12px;font-weight:700;">3</span></td>
                      <td style="padding-left:12px;font-size:14px;color:#374151;">Drop a pin, snap a photo, give it a vibe. Done.</td>
                    </tr></table>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:14px 18px;">
                    <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
                      <strong>Tip:</strong> Make sure location is enabled in your browser so we can show you benches nearby and drop your pin in the right spot.
                    </p>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="https://findyourbench.app" style="display:inline-block;background-color:#16a34a;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:-0.2px;">Find Your Bench</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px 0;font-size:13px;color:#9ca3af;text-align:center;line-height:1.6;">
                We're a web app for now. No download needed, just open the link in your browser.<br>A native app is on the way.
              </p>
              <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 20px 0;" />
              <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">
                That's it. You're no longer a ground-sitter. Now go find your bench.
              </p>
              <p style="margin:16px 0 0 0;font-size:14px;color:#6b7280;">
                See you out there,<br><br>
                thebenchfather<br>
                <span style="color:#9ca3af;font-size:13px;">Find Your Bench</span>
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                You're receiving this because you signed up at <a href="https://findyourbench.app" style="color:#9ca3af;">findyourbench.app</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return html.replace("[username]", username);
}

async function fetchUsername(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  maxAttempts = 5,
  delayMs = 1000
): Promise<string> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .maybeSingle();

    if (data?.username) return data.username;

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return "friend";
}

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

    const payload = await req.json();

    if (payload.type !== "INSERT" || payload.schema !== "auth" || payload.table !== "users") {
      return new Response(
        JSON.stringify({ error: "Unexpected webhook payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const record = payload.record;
    const userId: string = record?.id;
    const email: string = record?.email;

    if (!userId || !email) {
      return new Response(
        JSON.stringify({ error: "Missing user id or email in payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const username = await fetchUsername(supabase, userId);

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY is not configured");

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "tbf@findyourbench.app",
        to: [email],
        reply_to: "hello@findyourbench.app",
        subject: "Welcome to Find Your Bench 🪑",
        html: buildEmailHtml(username),
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      throw new Error(`Resend API error (${emailRes.status}): ${errBody}`);
    }

    const emailData = await emailRes.json();

    return new Response(
      JSON.stringify({ success: true, emailId: emailData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("send-welcome-email error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
