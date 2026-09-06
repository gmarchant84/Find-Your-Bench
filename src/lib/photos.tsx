import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * Photo URL signing + thumbnails.
 *
 * Bench photos live in a PRIVATE Supabase storage bucket. The app stores either
 * a bare storage path (new rows: "userId/filename.jpg"), a legacy full public
 * URL ("https://.../storage/v1/object/public/bench-photos/userId/filename.jpg"),
 * or an external URL (seed photos, e.g. images.pexels.com). External URLs are
 * used as-is; Supabase photos are swapped for short-lived signed URLs fetched
 * in batches from the get-photo-urls edge function.
 *
 * Thumbnails: every photo has an optional small companion object at
 * "<path>_thumb<ext>" (max 640px wide, ~40-60KB). Render sites ask for size
 * 'thumb' (the default) or 'full'. The edge function signs the thumb path when
 * it exists and falls back to the original when it doesn't, so pre-thumbnail
 * photos keep working.
 */

const BUCKET = 'bench-photos';
const PUBLIC_URL_MARKER = `/storage/v1/object/public/${BUCKET}/`;
const SIGN_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-photo-urls`;

export type PhotoSize = 'thumb' | 'full';

/** URL is a Supabase bench photo (needs signing) vs an external image. */
export function isSupabasePhoto(url: string | null | undefined): boolean {
  return !!url && url.includes(PUBLIC_URL_MARKER);
}

/** Normalize any stored value to a bare storage path (or pass external URLs through). */
export function photoPath(url: string): string {
  const i = url.indexOf(PUBLIC_URL_MARKER);
  return i >= 0 ? url.slice(i + PUBLIC_URL_MARKER.length) : url;
}

/** Storage path of the thumbnail companion object for a photo path. */
export function thumbPath(path: string): string {
  return path.replace(/(\.[A-Za-z0-9]+)$/, '_thumb$1');
}

type CacheEntry = { url: string; expiresAt: number };
const cache = new Map<string, CacheEntry>(); // key: `${size}:${path}`
const subscribers = new Set<() => void>();
let queue: Array<{ path: string; size: PhotoSize }> = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const URL_REFRESH_MS = 45 * 60 * 1000; // refresh well before the 1h signed expiry

function notifyAll() {
  subscribers.forEach((fn) => fn());
}

async function flushQueue() {
  flushTimer = null;
  const pending = queue;
  queue = [];
  if (pending.length === 0) return;

  // One request per size group so thumbs and originals batch separately.
  const groups = new Map<PhotoSize, string[]>();
  for (const { path, size } of pending) {
    const list = groups.get(size) ?? [];
    if (!list.includes(path)) list.push(path);
    groups.set(size, list);
  }

  for (const [size, paths] of groups) {
    try {
      const res = await fetch(SIGN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths, size }),
      });
      if (!res.ok) throw new Error(`get-photo-urls failed: ${res.status}`);
      const data = await res.json();
      const now = Date.now();
      for (const p of paths) {
        const u = data.urls?.[p];
        if (typeof u === 'string' && u.length > 0) {
          cache.set(`${size}:${p}`, { url: u, expiresAt: now + URL_REFRESH_MS });
        }
      }
      notifyAll();
    } catch (err) {
      console.error('Photo URL signing failed:', err);
      // Re-queue once after a short delay so a transient blip doesn't blank photos
      setTimeout(() => {
        for (const p of paths) {
          if (!cache.has(`${size}:${p}`) && !queue.some((q) => q.path === p && q.size === size)) {
            queue.push({ path: p, size });
          }
        }
        if (queue.length > 0 && !flushTimer) flushTimer = setTimeout(flushQueue, 2000);
      }, 2000);
    }
  }
}

/**
 * Synchronous lookup: returns a signed URL if cached, queues the path for
 * signing otherwise, and returns null (caller renders a placeholder).
 */
export function getSignedPhotoUrl(
  url: string | null | undefined,
  size: PhotoSize = 'thumb',
): string | null {
  if (!url) return null;
  if (!isSupabasePhoto(url) && !looksLikeStoragePath(url)) return url; // external URL
  const path = photoPath(url);
  const key = `${size}:${path}`;
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.url;
  if (!queue.some((q) => q.path === path && q.size === size)) queue.push({ path, size });
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
export function useSignedPhotoUrl(
  url: string | null | undefined,
  size: PhotoSize = 'thumb',
): string | null {
  const [signed, setSigned] = useState<string | null>(() => getSignedPhotoUrl(url, size));

  useEffect(() => {
    let active = true;
    const check = () => {
      if (active) setSigned(getSignedPhotoUrl(url, size));
    };
    check();
    subscribers.add(check);
    return () => {
      active = false;
      subscribers.delete(check);
    };
  }, [url, size]);

  return signed;
}

const PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * Drop-in <img> for bench photos. Renders a transparent placeholder while the
 * signed URL loads; passes non-Supabase URLs straight through. Defaults to the
 * small thumbnail variant - pass size="full" for hero images.
 */
export function SignedPhotoImg({
  src,
  alt,
  className,
  style,
  loading,
  onError,
  size = 'thumb',
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  loading?: 'lazy' | 'eager';
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  size?: PhotoSize;
}) {
  const signed = useSignedPhotoUrl(src, size);
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

/**
 * Resize an image blob to a small thumbnail (max 640px wide) for map markers,
 * cards, and lists.
 */
async function makeThumbBlob(src: Blob, maxPx = 640, quality = 0.72): Promise<Blob> {
  const bitmap = await createImageBitmap(src);
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
  );
  if (!blob) throw new Error('Thumbnail encoding failed');
  return blob;
}

/**
 * Upload a photo and its thumbnail companion. The thumbnail is best-effort:
 * if it fails, the original still works (signing falls back to it).
 */
export async function uploadPhotoWithThumb(
  path: string,
  full: Blob,
  opts: { upsert?: boolean } = {},
): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, full, { contentType: full.type || 'image/jpeg', upsert: !!opts.upsert });
  if (error) throw error;
  try {
    const thumb = await makeThumbBlob(full);
    await supabase.storage
      .from(BUCKET)
      .upload(thumbPath(path), thumb, { contentType: 'image/jpeg', upsert: true });
  } catch (err) {
    console.warn('Thumbnail upload skipped:', err);
  }
}
