# Edge Functions

Deployed via the Supabase dashboard or MCP. These copies are the source of
truth for the code; the deployed versions additionally read secrets from the
project's Edge Function Secrets settings:

- `send-welcome-email` requires `RESEND_API_KEY` (Resend API key, from
  resend.com) and uses the built-in `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.
- `get-user-emails` requires `ADMIN_SECRET` (any strong value you choose;
  callers must send it as the `x-admin-secret` header).
- `bench-og` requires no custom secrets (uses `SUPABASE_URL` and
  `SUPABASE_ANON_KEY`).

All three run with JWT verification disabled because they implement their own
authentication or are meant to be publicly reachable (webhook / crawler
endpoints).
