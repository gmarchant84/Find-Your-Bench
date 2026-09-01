/*
# Add Welcome Email Webhook Trigger

## Summary
Creates a database trigger on auth.users that fires on every new user signup and
calls the send-welcome-email edge function via pg_net HTTP POST.

## Changes

### New Function
- `public.trigger_welcome_email()` — SECURITY DEFINER trigger function that builds
  a Supabase-style webhook payload and dispatches it to the send-welcome-email
  edge function using pg_net.

### New Trigger
- `on_auth_user_created` on `auth.users` AFTER INSERT — fires per row, calls
  trigger_welcome_email().

### Extensions
- Enables `pg_net` (already present in most Supabase projects; IF NOT EXISTS
  makes this idempotent).

## Notes
1. The trigger uses pg_net's net.http_post which is async/fire-and-forget,
   so it does not block the signup flow.
2. The edge function is called with the anon key in Authorization so it passes
   Supabase's routing layer (verify_jwt is false on the function itself).
3. Payload mirrors the standard Supabase webhook envelope so the edge function
   can reuse the same parsing logic as a real webhook.
*/

CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
BEGIN
  payload := jsonb_build_object(
    'type',       'INSERT',
    'table',      'users',
    'schema',     'auth',
    'record',     to_jsonb(NEW),
    'old_record', null
  );

  PERFORM net.http_post(
    url     := 'https://ubgnmvplrygcszjekeqv.supabase.co/functions/v1/send-welcome-email',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViZ25tdnBscnlnY3N6amVrZXF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NDc4OTYsImV4cCI6MjA4OTAyMzg5Nn0.bhn1QPR8lgM3dmXx5nMCmfxqHCk-36XKDAnxaljCq5k'
    ),
    body    := payload
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.trigger_welcome_email();
