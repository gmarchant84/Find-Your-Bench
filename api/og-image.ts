import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

// Stable 1200x630 share card for a bench: /api/og-image?id=<benchId>.
// Bench photos live in a private bucket, so a signed URL put straight into
// og:image would expire. This endpoint asks the bench-og function for a freshly
// signed URL on every (CDN-missed) request and draws the card server-side, so
// the signed URL never leaves the server. With no id (or on any failure) it
// draws the generic Find Your Bench card.

const SUPABASE_URL = "https://ubgnmvplrygcszjekeqv.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViZ25tdnBscnlnY3N6amVrZXF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NDc4OTYsImV4cCI6MjA4OTAyMzg5Nn0.bhn1QPR8lgM3dmXx5nMCmfxqHCk-36XKDAnxaljCq5k";
const APP_URL = "https://www.findyourbench.app";
const LOGO = `${APP_URL}/fyb-logo-256.png`;
const GREEN = "#15803d";
const FONT_URL = (w: number) => `https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-${w}-normal.woff`;

// Inter regular and bold, fetched once per isolate (the default font has no bold).
let fontsPromise: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[]> | null = null;
function loadFonts() {
  fontsPromise ??= Promise.all(
    ([400, 700] as const).map(async (weight) => {
      const r = await fetch(FONT_URL(weight));
      if (!r.ok) throw new Error("font");
      return { name: "Inter", data: await r.arrayBuffer(), weight, style: "normal" as const };
    }),
  ).catch((e) => { fontsPromise = null; throw e; });
  return fontsPromise;
}

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style: { display: "flex", ...style }, children, ...extra },
});

interface BenchInfo {
  name: string;
  average_rating: number | null;
  total_ratings: number | null;
}

async function loadBench(id: string): Promise<{ bench: BenchInfo | null; photo: string | null }> {
  const headers = { Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY };
  const [benchRes, photoRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/benches?id=eq.${encodeURIComponent(id)}&select=name,average_rating,total_ratings`, { headers }),
    fetch(`${SUPABASE_URL}/functions/v1/bench-og?id=${encodeURIComponent(id)}&image=1`, { headers }),
  ]);
  const rows = benchRes.ok ? ((await benchRes.json()) as BenchInfo[]) : [];
  let photo: string | null = null;
  if (photoRes.ok) {
    const { url } = (await photoRes.json()) as { url?: string };
    if (url) photo = url.includes("images.pexels.com") ? `${url.split("?")[0]}?auto=compress&w=1200` : url;
  }
  return { bench: rows[0] ?? null, photo };
}

// Satori needs image bytes it can decode (jpeg/png); fetch once and inline.
async function inlineImage(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const r = await fetch(url);
    const type = r.headers.get("content-type") || "";
    if (!r.ok || !/image\/(jpe?g|png)/.test(type)) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.byteLength > 6_000_000) return null;
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return `data:${type.split(";")[0]};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

function brandBar(dark: boolean): Node {
  return h("div", { alignItems: "center", gap: 18 }, [
    h("img", { width: 72, height: 72, borderRadius: 16, backgroundColor: "#fff" }, undefined, { src: LOGO, width: 72, height: 72 }),
    h("div", { flexDirection: "column" }, [
      h("div", { fontSize: 34, fontWeight: 700, color: dark ? "#fff" : "#111827", textShadow: dark ? "0 2px 8px rgba(0,0,0,0.5)" : "none" }, "Find Your Bench"),
      h("div", { fontSize: 20, letterSpacing: 4, color: dark ? "rgba(255,255,255,0.85)" : "#6b7280" }, "GET OUTSIDE. STAY OUTSIDE."),
    ]),
  ]);
}

function genericCard(): Node {
  return h(
    "div",
    { width: "100%", height: "100%", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 36, backgroundColor: "#f0fdf4", backgroundImage: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)" },
    [
      h("img", { width: 220, height: 220, borderRadius: 40, backgroundColor: "#fff" }, undefined, { src: LOGO, width: 220, height: 220 }),
      h("div", { fontSize: 72, fontWeight: 700, color: "#111827" }, "Find Your Bench"),
      h("div", { fontSize: 34, color: "#374151" }, "Discover and share the best public benches near you"),
      h("div", { fontSize: 26, color: GREEN, fontWeight: 700 }, "findyourbench.app"),
    ],
  );
}

function benchCard(bench: BenchInfo, photo: string | null): Node {
  const name = bench.name.length > 60 ? `${bench.name.slice(0, 57)}...` : bench.name;
  const rating = (bench.total_ratings ?? 0) > 0 && (bench.average_rating ?? 0) > 0
    ? `${Number(bench.average_rating).toFixed(1)} stars from ${bench.total_ratings} rating${bench.total_ratings === 1 ? "" : "s"}`
    : "Be the first to rate it";
  if (!photo) {
    return h("div", { width: "100%", height: "100%", flexDirection: "column", justifyContent: "space-between", padding: 64, backgroundImage: "linear-gradient(135deg, #f0fdf4 0%, #bbf7d0 100%)" }, [
      brandBar(false),
      h("div", { flexDirection: "column", gap: 16 }, [
        h("div", { fontSize: 76, fontWeight: 700, color: "#111827", lineHeight: 1.1 }, name),
        h("div", { fontSize: 34, color: GREEN, fontWeight: 700 }, rating),
      ]),
    ]);
  }
  return h("div", { width: "100%", height: "100%", position: "relative", backgroundColor: "#111827" }, [
    h("img", { position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }, undefined, { src: photo, width: 1200, height: 630 }),
    h("div", { position: "absolute", top: 0, left: 0, width: 1200, height: 630, backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.8) 100%)" }),
    h("div", { position: "absolute", top: 0, left: 0, width: 1200, height: 630, flexDirection: "column", justifyContent: "space-between", padding: 56 }, [
      brandBar(true),
      h("div", { flexDirection: "column", gap: 12 }, [
        h("div", { fontSize: 72, fontWeight: 700, color: "#fff", lineHeight: 1.1, textShadow: "0 2px 12px rgba(0,0,0,0.6)" }, name),
        h("div", { fontSize: 32, color: "#fde68a", fontWeight: 700, textShadow: "0 2px 8px rgba(0,0,0,0.6)" }, rating),
      ]),
    ]),
  ]);
}

export default async function handler(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  let card = genericCard();
  let maxAge = 86400;
  if (id) {
    try {
      const { bench, photo } = await loadBench(id);
      if (bench) card = benchCard(bench, await inlineImage(photo));
      else maxAge = 300;
    } catch {
      maxAge = 300;
    }
  }
  const fonts = await loadFonts().catch(() => undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new ImageResponse(card as any, {
    width: 1200,
    height: 630,
    ...(fonts ? { fonts } : {}),
    headers: { "cache-control": `public, max-age=${maxAge}, s-maxage=${maxAge}` },
  });
}
