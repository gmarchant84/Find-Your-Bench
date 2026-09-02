import { useEffect, useState } from 'react';

/**
 * Photo URL signing.
 *
 * Bench photos live in a PRIVATE Supabase storage bucket. The app stores either
 * a bare storage path (new rows: "userId/filename.jpg"), a legacy full public
 * URL ("https://.../storage/v1/object/public/bench-photos/userId/filename.jpg"),
 * or an external URL (seed photos, e.g. images.pexels.com). External URLs are
 * used as-is; Supabase photos are swapped for short-lived signed URLs fetched
 * in batches from the get-photo-urls edge function.
 */

const BUCKET = 'bench-photos';
const PUBLIC_URL_MARKER = `/storage/v1/object/public/${BUCKET}/`;
const SIGN_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-photo-urls`;

/** URL is a Supabase bench photo (needs signing) vs an external image. */
export function isSupabasePhoto(url: string | null | undefined): boolean {
  return !!url && url.includes(PUBLIC_URL_MARKER);
}

/** Normalize any stored value to a bare storage path (or pass external URLs through). */
export function photoPath(url: string): string {
  const i = url.indexOf(PUBLIC_URL_MARKER);
  return i >= 0 ? url.slice(i + PUBLIC_URL_MARKER.length) : url;
}

type CacheEntry = { url: string; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const subscribers = new Set<() => void>();
let queue: string[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const URL_REFRESH_MS = 45 * 60 * 1000; // refresh well before the 1h signed expiry

function notifyAll() {
  subscribers.forEach((fn) => fn());
}

async function flushQueue() {
  flushTimer = null;
  const paths = queue;
  queue = [];
  if (paths.length === 0) return;
  try {
    const res = await fetch(SIGN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    });
    if (!res.ok) throw new Error(`get-photo-urls failed: ${res.status}`);
    const data = await res.json();
    const now = Date.now();
    for (const p of paths) {
      const u = data.urls?.[p];
      if (typeof u === 'string' && u.length > 0) {
        cache.set(p, { url: u, expiresAt: now + URL_REFRESH_MS });
      }
    }
    notifyAll();
  } catch (err) {
    console.error('Photo URL signing failed:', err);
    // Re-queue once after a short delay so a transient blip doesn't blank photos
    setTimeout(() => {
      for (const p of paths) {
        if (!cache.has(p) && !queue.includes(p)) queue.push(p);
      }
      if (queue.length > 0 && !flushTimer) flushTimer = setTimeout(flushQueue, 2000);
    }, 2000);
  }
}

/**
 * Synchronous lookup: returns a signed URL if cached, queues the path for
 * signing otherwise, and returns null (caller renders a placeholder).
 */
export function getSignedPhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!isSupabasePhoto(url) && !looksLikeStoragePath(url)) return url; // external URL
  const path = photoPath(url);
  const entry = cache.get(path);
  if (entry && entry.expiresAt > Date.now()) return entry.url;
  if (!queue.includes(path)) queue.push(path);
  if (!flushTimer) flushTimer = setTimeout(flushQueue, 40);
  return null;
}

/** New-style stored values are bare storage paths (uploads or avatars). */
function looksLikeStoragePath(url: string): boolean {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//.test(url) ||
    url.startsWith('avatars/')
  );
}

/** React hook: resolves any photo value (path, legacy URL, external URL) to a renderable src. */
export function useSignedPhotoUrl(url: string | null | undefined): string | null {
  const [signed, setSigned] = useState<string | null>(() => getSignedPhotoUrl(url));

  useEffect(() => {
    let active = true;
    const check = () => {
      if (active) setSigned(getSignedPhotoUrl(url));
    };
    check();
    subscribers.add(check);
    return () => {
      active = false;
      subscribers.delete(check);
    };
  }, [url]);

  return signed;
}

const PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * Drop-in <img> for bench photos. Renders a transparent placeholder while the
 * signed URL loads; passes non-Supabase URLs straight through.
 */
export function SignedPhotoImg({
  src,
  alt,
  className,
  style,
  loading,
  onError,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  loading?: 'lazy' | 'eager';
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}) {
  const signed = useSignedPhotoUrl(src);
  return (
    <img
      src={signed ?? PLACEHOLDER}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      onError={onError}
    />
  );
}
