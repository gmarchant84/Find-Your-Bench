import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type VibeCategory = 'family' | 'romantic' | 'nature' | 'views' | 'people-watching' | 'quiet';

export const BENCH_VIBES: Array<{
  id: VibeCategory;
  label: string;
  emoji: string;
  color: string;        // Tailwind text color
  bg: string;           // Tailwind bg color (light)
  border: string;       // Tailwind border color
  hex: string;          // Raw hex for canvas / inline style use
  markerGradient: [string, string]; // from/to for marker gradient
}> = [
  { id: 'family',          label: 'Family Friendly', emoji: '💗', color: 'text-pink-600',    bg: 'bg-pink-50',   border: 'border-pink-300',  hex: '#ec4899', markerGradient: ['#f472b6', '#ec4899'] },
  { id: 'romantic',        label: 'Romantic',        emoji: '❤️', color: 'text-red-600',     bg: 'bg-red-50',    border: 'border-red-300',   hex: '#ef4444', markerGradient: ['#f87171', '#ef4444'] },
  { id: 'nature',          label: 'Nature Escape',   emoji: '💚', color: 'text-green-600',   bg: 'bg-green-50',  border: 'border-green-300', hex: '#22c55e', markerGradient: ['#4ade80', '#22c55e'] },
  { id: 'views',           label: 'Beautiful Views', emoji: '💙', color: 'text-blue-600',    bg: 'bg-blue-50',   border: 'border-blue-300',  hex: '#3b82f6', markerGradient: ['#60a5fa', '#3b82f6'] },
  { id: 'people-watching', label: 'People Watching', emoji: '💛', color: 'text-yellow-600',  bg: 'bg-yellow-50', border: 'border-yellow-300',hex: '#eab308', markerGradient: ['#facc15', '#eab308'] },
  { id: 'quiet',           label: 'Quiet / Reflective', emoji: '🟣', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-300', hex: '#a855f7', markerGradient: ['#c084fc', '#a855f7'] },
];

export function getVibe(id: VibeCategory | null | undefined) {
  return BENCH_VIBES.find(v => v.id === id) ?? null;
}

export interface Bench {
  id: string;
  name: string;
  original_name: string;
  latitude: number;
  longitude: number;
  description: string | null;
  tags: string[] | null;
  founding_user_id: string | null;
  photos: string[] | null;
  created_at: string;
  verification_status?: 'unverified' | 'community_confirmed' | 'verified';
  confirmation_count?: number;
  credibility_score?: number;
  flagged_for_removal?: boolean;
  removal_reports?: number;
  average_rating?: number;
  total_ratings?: number;
  is_hidden?: boolean;
  duplicate_of?: string | null;
  vibe_category?: VibeCategory | null;
  // Joined from profiles — present when fetched with founder join
  founder_username?: string | null;
  founder_is_founding_bencher?: boolean;
}

export interface Rating {
  id: string;
  bench_id: string;
  user_id: string;
  comfort: number;
  tranquility: number;
  people_watching: number;
  beautiful_views: number;
  accessibility: number;
  overall: number;
  review_text: string;
  created_at: string;
}

export interface NameVote {
  id: string;
  bench_id: string;
  suggested_name: string;
  suggested_by: string;
  votes: number;
  created_at: string;
}

export interface UserVote {
  id: string;
  name_vote_id: string;
  user_id: string;
  created_at: string;
}

export const calculateVibeScore = (comfort: number, view: number, quietness: number): number => {
  const average = (comfort + view + quietness) / 3;
  return Math.round(average * 2 * 10) / 10;
};

export const getVibeScoreColor = (score: number): string => {
  if (score >= 8.5) return 'text-emerald-600';
  if (score >= 7) return 'text-green-600';
  if (score >= 5.5) return 'text-yellow-600';
  if (score >= 4) return 'text-orange-600';
  return 'text-red-600';
};

export const getVibeScoreBackground = (score: number): string => {
  if (score >= 8.5) return 'bg-emerald-100 border-emerald-300';
  if (score >= 7) return 'bg-green-100 border-green-300';
  if (score >= 5.5) return 'bg-yellow-100 border-yellow-300';
  if (score >= 4) return 'bg-orange-100 border-orange-300';
  return 'bg-red-100 border-red-300';
};

// Returns a safe, user-facing message for any error thrown by Supabase operations.
// Passes through known upload-limit messages; hides all internal DB/RLS detail.
export function friendlyError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (msg.startsWith('Upload limit reached:')) return msg;
  if (msg.startsWith('new row for relation') || msg.includes('violates') || msg.includes('relation') || msg.includes('column') || msg.includes('constraint')) {
    return fallback;
  }
  // Pass through short, clearly user-readable messages (no technical jargon)
  if (msg.length > 0 && msg.length < 120 && !/\b(uuid|oid|pg_|auth\.|public\.|rls|policy|trigger)\b/i.test(msg)) {
    return msg;
  }
  return fallback;
}
