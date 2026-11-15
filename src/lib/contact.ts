/**
 * The one place the public contact address lives. hello@ is already the
 * reply-to on the welcome email (supabase/functions/send-welcome-email).
 * Make sure this mailbox is monitored before launch.
 */
export const CONTACT_EMAIL = 'hello@findyourbench.app';

export function mailtoUrl(subject: string, body?: string): string {
  const params = new URLSearchParams({ subject });
  if (body) params.set('body', body);
  // URLSearchParams encodes spaces as '+', which mail clients show literally.
  return `mailto:${CONTACT_EMAIL}?${params.toString().replace(/\+/g, '%20')}`;
}

/** Prefilled "Report this bench" email (covers the bench, its photos and reviews). */
export function reportBenchMailto(bench: { id: string; name: string }): string {
  const url = `https://www.findyourbench.app/bench/${bench.id}`;
  return mailtoUrl(
    `Report: ${bench.name}`,
    `Bench: ${bench.name}\nLink: ${url}\n\nWhat's wrong (bench, photo or review)?\n\n`,
  );
}
