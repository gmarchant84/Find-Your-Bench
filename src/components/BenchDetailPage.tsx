import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, MapPin, User, ThumbsUp, ThumbsDown, MessageSquarePlus, Bookmark, Check, X, AlertCircle, Camera, CheckCircle2, FolderOpen, Share2, ExternalLink, LogIn } from 'lucide-react';
import { supabase, getVibe, getLocationType } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import VerificationBadge from './VerificationBadge';
import FoundingBencherBadge from './FoundingBencherBadge';
import { useAuth } from '../context/AuthContext';
import { AddRating } from './AddRating';
import AdminControls from './AdminControls';
import AddPhotoSection from './AddPhotoSection';
import PhotoGallery from './PhotoGallery';
import SaveToListModal from './SaveToListModal';
import ImageLightbox from './ImageLightbox';
import AuthPromptModal from './AuthPromptModal';

const BADGE_ICONS: Record<string, string> = {
  seedling: '🌱',
  groundskeeper: '🪑',
  scout: '🗺️',
  trail_blazer: '🏕️',
  park_ranger: '🌳',
  bench_legend: '🏆',
  critic: '✍️',
  connoisseur: '🔍',
  the_reviewer: '📜',
  on_a_roll: '🔥',
  unstoppable: '⚡',
  bench_obsessed: '💎',
  perma_bencher: '🌟',
  the_benchfather: '👑',
};

interface VerificationSectionProps {
  bench: { verification_status?: string; confirmation_count?: number; photos?: string[] | null };
  userConfirmations: { exists: boolean; removed: boolean };
  saveMessage: string | null;
  ratings: { id: string; user_id: string }[];
  onConfirmation: (type: 'exists' | 'removed') => void;
  onReview: () => void;
  session: Session | null;
  onSignIn: () => void;
}

function VerificationSection({ bench, userConfirmations, saveMessage, ratings, onConfirmation, onReview, session, onSignIn }: VerificationSectionProps) {
  const status = bench.verification_status || 'unverified';
  const confirmCount = bench.confirmation_count || 0;
  const photoCount = (bench.photos ?? []).length;
  const isVerified = status === 'verified';

  // Each step is "done" as soon as the community has at least one of that action.
  // The confirm step is done when any user has confirmed (confirmCount >= 1).
  const steps = [
    {
      key: 'confirm',
      label: 'Confirm it exists',
      done: confirmCount >= 1,
      icon: ThumbsUp,
    },
    {
      key: 'photo',
      label: 'Photo uploaded',
      done: photoCount > 0,
      icon: Camera,
    },
    {
      key: 'review',
      label: 'Leave a review',
      done: ratings.length > 0,
      icon: Star,
    },
  ];

  const completedSteps = steps.filter(s => s.done).length;
  const progressPct = Math.round((completedSteps / steps.length) * 100);

  return (
    <div className={`rounded-xl border ${isVerified ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'} p-4 space-y-4`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`font-semibold text-sm ${isVerified ? 'text-green-800' : 'text-gray-800'}`}>
            {isVerified ? 'Community Verified' : 'Help Verify This Bench'}
          </h3>
          {!isVerified && (
            <p className="text-xs text-gray-500 mt-0.5">
              {completedSteps}/{steps.length} steps complete
            </p>
          )}
        </div>
        {isVerified ? (
          <div className="flex items-center gap-1.5 text-green-700">
            <CheckCircle2 className="w-5 h-5 fill-green-100 stroke-green-600" />
            <span className="text-sm font-semibold">Verified</span>
          </div>
        ) : (
          <span className="text-xs font-medium text-gray-400 bg-white border border-gray-200 px-2.5 py-1 rounded-full">
            {progressPct}% there
          </span>
        )}
      </div>

      {/* Progress bar */}
      {!isVerified && (
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Steps */}
      {!isVerified && (
        <div className="space-y-2">
          {steps.map(step => {
            const Icon = step.icon;
            return (
              <div key={step.key} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${
                  step.done ? 'bg-green-500' : 'bg-gray-200'
                }`}>
                  {step.done
                    ? <Check className="w-3 h-3 text-white" />
                    : <Icon className="w-3 h-3 text-gray-400" />
                  }
                </div>
                <span className={`text-sm flex-1 transition-colors duration-300 ${step.done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Toast message */}
      {saveMessage && (
        <div className="p-2.5 bg-green-100 border border-green-300 rounded-lg text-green-800 text-sm font-medium text-center">
          {saveMessage}
        </div>
      )}

      {/* Action buttons */}
      {session ? (
        <div className="flex gap-2.5">
          <button
            onClick={() => onConfirmation('exists')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold transition btn-press text-sm ${
              userConfirmations.exists
                ? 'bg-green-600 text-white shadow-sm shadow-green-200'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-green-400'
            }`}
          >
            <ThumbsUp className="w-4 h-4" />
            Still Here
          </button>
          {!ratings.some(r => r.user_id === session?.user?.id) && (
            <button
              onClick={onReview}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white text-gray-700 border border-gray-200 hover:border-amber-400 rounded-xl font-semibold transition btn-press text-sm"
            >
              <MessageSquarePlus className="w-4 h-4" />
              Review
            </button>
          )}
          <button
            onClick={() => onConfirmation('removed')}
            className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-semibold transition btn-press text-xs ${
              userConfirmations.removed
                ? 'bg-red-500 text-white shadow-sm'
                : 'bg-white text-gray-400 border border-gray-200 hover:border-red-300 hover:text-red-500'
            }`}
            title="Report bench as gone"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
            Gone
          </button>
        </div>
      ) : (
        <button
          onClick={onSignIn}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition text-sm"
        >
          <LogIn className="w-4 h-4" />
          Sign in to confirm or review
        </button>
      )}

      {/* Write a review CTA when verified and has no reviews yet */}
      {isVerified && !ratings.some(r => r.user_id === session?.user?.id) && session && (
        <button
          onClick={onReview}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-white text-gray-700 border border-gray-200 hover:border-amber-400 rounded-xl font-semibold transition btn-press text-sm"
        >
          <MessageSquarePlus className="w-4 h-4" />
          Be the first to review
        </button>
      )}
    </div>
  );
}

function formatDistanceLabel(meters: number, unit: 'miles' | 'km'): string {
  if (unit === 'miles') {
    const miles = meters * 0.000621371;
    if (miles < 0.1) return `${Math.round(miles * 5280)} ft`;
    if (miles < 10) return `${miles.toFixed(1)} mi`;
    return `${Math.round(miles)} mi`;
  } else {
    const km = meters * 0.001;
    if (km < 0.1) return `${Math.round(meters)} m`;
    if (km < 10) return `${km.toFixed(1)} km`;
    return `${Math.round(km)} km`;
  }
}

interface Bench {
  id: string;
  name: string;
  original_name: string;
  latitude: number;
  longitude: number;
  description: string | null;
  founding_user_id: string | null;
  photos: string[] | null;
  tags: string[] | null;
  created_at: string;
  verification_status?: 'unverified' | 'community_confirmed' | 'verified';
  confirmation_count?: number;
  credibility_score?: number;
  flagged_for_removal?: boolean;
  removal_reports?: number;
  is_hidden?: boolean;
  duplicate_of?: string | null;
  vibe_category?: string | null;
  location_type?: string | null;
}

// Badge priority order — highest rarity first
const BADGE_PRIORITY = ['the_benchfather','bench_legend','park_ranger','perma_bencher','bench_obsessed','trail_blazer','the_reviewer','unstoppable','scout','connoisseur','on_a_roll','critic','groundskeeper','seedling'];

interface Rating {
  id: string;
  user_id: string;
  comfort: number;
  tranquility: number;
  people_watching: number;
  beautiful_views: number;
  accessibility: number;
  overall: number;
  review_text: string | null;
  created_at: string;
  reviewer_username?: string | null;
  reviewer_badge?: string | null;
}

interface BenchDetailProps {
  bench: Bench;
  onBack: () => void;
  backButtonText?: string;
  distance?: number;
  distanceUnit?: 'miles' | 'km';
  founderUsername?: string | null;
  founderIsFoundingBencher?: boolean;
}

export default function BenchDetail({ bench: initialBench, onBack, backButtonText = 'Back', distance, distanceUnit = 'miles', founderUsername: initialFounderUsername, founderIsFoundingBencher: initialFounderIsFoundingBencher }: BenchDetailProps) {
  const { session, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [bench, setBench] = useState<Bench>(initialBench);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [userConfirmations, setUserConfirmations] = useState<{
    exists: boolean;
    removed: boolean;
  }>({ exists: false, removed: false });
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showAddRating, setShowAddRating] = useState(false);
  const [isVisited, setIsVisited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [showSaveToList, setShowSaveToList] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [benchLists, setBenchLists] = useState<{ id: string; name: string; emoji: string }[]>([]);
  const [founderUsername, setFounderUsername] = useState<string | null>(initialFounderUsername ?? null);
  const [founderIsFoundingBencher, setFounderIsFoundingBencher] = useState<boolean>(initialFounderIsFoundingBencher ?? false);
  const [founderFeaturedBadge, setFounderFeaturedBadge] = useState<string | null>(null);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  const [photoGalleryKey, setPhotoGalleryKey] = useState(0);
  const [primaryPhotoUrl, setPrimaryPhotoUrl] = useState<string | null>(null);
  const [primaryPhotoLoaded, setPrimaryPhotoLoaded] = useState(false);

  const touchStartY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchRatings();
    fetchUserConfirmations();
    fetchVisitedStatus();
    fetchBenchLists();
    reverseGeocode();
    fetchPrimaryPhoto();
    if (bench.founding_user_id && !initialFounderUsername) {
      Promise.all([
        supabase.from('profiles').select('username, is_founding_bencher, featured_badge_id').eq('id', bench.founding_user_id).maybeSingle(),
        supabase.from('user_achievement_unlocks').select('achievement_id').eq('user_id', bench.founding_user_id),
      ]).then(([{ data: profile }, { data: unlocks }]) => {
        if (profile) {
          setFounderUsername(profile.username ?? null);
          setFounderIsFoundingBencher(profile.is_founding_bencher ?? false);
          const earned = (unlocks ?? []).map(u => u.achievement_id);
          const badge = profile.featured_badge_id
            ?? BADGE_PRIORITY.find(b => earned.includes(b))
            ?? null;
          setFounderFeaturedBadge(badge);
        }
      });
    }
  }, [bench.id]);

  const fetchPrimaryPhoto = async () => {
    const { data } = await supabase
      .from('bench_photos')
      .select('photo_url')
      .eq('bench_id', bench.id)
      .eq('is_primary', true)
      .maybeSingle();
    if (data?.photo_url) {
      setPrimaryPhotoUrl(data.photo_url);
    } else {
      // Fallback: get first photo if no primary set
      const { data: first } = await supabase
        .from('bench_photos')
        .select('photo_url')
        .eq('bench_id', bench.id)
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (first?.photo_url) setPrimaryPhotoUrl(first.photo_url);
    }
  };

  const reverseGeocode = () => {
    if (typeof google === 'undefined' || !google.maps?.Geocoder) return;
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat: bench.latitude, lng: bench.longitude } }, (results, status) => {
      if (status !== 'OK' || !results || results.length === 0 || !results[0]?.address_components) return;
      const components = results[0].address_components;
      let park = '';
      let neighborhood = '';
      let locality = '';
      for (const c of components) {
        if (c.types.includes('establishment') || c.types.includes('park')) {
          if (!park) park = c.long_name;
        }
        if (c.types.includes('neighborhood') || c.types.includes('sublocality_level_1')) {
          if (!neighborhood) neighborhood = c.long_name;
        }
        if (c.types.includes('locality')) {
          if (!locality) locality = c.long_name;
        }
      }
      const label = park || neighborhood || locality || null;
      setLocationLabel(label);
    });
  };

  const fetchRatings = async () => {
    const { data, error } = await supabase
      .from('ratings')
      .select('*')
      .eq('bench_id', bench.id);

    if (error) {
      setError('Failed to load ratings');
      return;
    }
    if (data) {
      // Fetch profile data for all reviewers
      const userIds = [...new Set(data.map(r => r.user_id).filter(Boolean))];
      let profileMap = new Map<string, { username: string | null; featured_badge_id: string | null; earned_badges: string[] }>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, featured_badge_id')
          .in('id', userIds);
        const { data: unlocks } = await supabase
          .from('user_achievement_unlocks')
          .select('user_id, achievement_id')
          .in('user_id', userIds);
        const earnedByUser = new Map<string, string[]>();
        (unlocks ?? []).forEach(u => {
          if (!earnedByUser.has(u.user_id)) earnedByUser.set(u.user_id, []);
          earnedByUser.get(u.user_id)!.push(u.achievement_id);
        });
        (profiles ?? []).forEach(p => profileMap.set(p.id, {
          username: p.username ?? null,
          featured_badge_id: p.featured_badge_id ?? null,
          earned_badges: earnedByUser.get(p.id) ?? [],
        }));
      }
      const enriched = data.map(r => {
        const profile = profileMap.get(r.user_id);
        const badge = profile?.featured_badge_id
          ?? BADGE_PRIORITY.find(b => profile?.earned_badges.includes(b))
          ?? null;
        return { ...r, reviewer_username: profile?.username ?? null, reviewer_badge: badge };
      });
      setRatings(enriched);
      if (enriched.length > 0) {
        const avg = enriched.reduce((sum, r) => sum + r.overall, 0) / enriched.length;
        setAvgRating(avg);
      }
    }
  };

  const fetchUserConfirmations = async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from('bench_confirmations')
      .select('confirmation_type')
      .eq('bench_id', bench.id)
      .eq('user_id', session.user.id);
    if (data) {
      setUserConfirmations({
        exists: data.some(c => c.confirmation_type === 'exists'),
        removed: data.some(c => c.confirmation_type === 'removed')
      });
    }
  };

  const fetchVisitedStatus = async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from('visited_benches')
      .select('id')
      .eq('bench_id', bench.id)
      .eq('user_id', session.user.id)
      .maybeSingle();
    setIsVisited(!!data);
  };

  const fetchBenchLists = async () => {
    if (!session?.user?.id) return;
    const { data: memberRows } = await supabase
      .from('list_benches')
      .select('list_id')
      .eq('bench_id', bench.id)
      .eq('user_id', session.user.id);
    if (!memberRows || memberRows.length === 0) { setBenchLists([]); return; }
    const { data: lists } = await supabase
      .from('bench_lists')
      .select('id, name, emoji')
      .in('id', memberRows.map(r => r.list_id));
    setBenchLists(lists ?? []);
  };

  const showMsg = (msg: string, duration = 2500) => {
    setSaveMessage(msg);
    setTimeout(() => setSaveMessage(null), duration);
  };

  const handleVisitedBench = async () => {
    if (!session?.user?.id) { setShowAuthPrompt(true); return; }
    if (isVisited) {
      const { error } = await supabase.from('visited_benches').delete()
        .eq('bench_id', bench.id).eq('user_id', session.user.id);
      if (!error) { setIsVisited(false); showMsg('Removed from visited'); }
    } else {
      const { error } = await supabase.from('visited_benches')
        .insert({ bench_id: bench.id, user_id: session.user.id });
      if (!error) {
        setIsVisited(true);
        showMsg('Marked as visited!');
        // Notify founding user
        if (bench.founding_user_id && bench.founding_user_id !== session.user.id) {
          await supabase.from('bench_notifications').insert({
            user_id: bench.founding_user_id,
            bench_id: bench.id,
            actor_id: session.user.id,
            type: 'visit',
          });
        }
      }
    }
  };

  const refreshBench = async () => {
    const { data } = await supabase
      .from('benches')
      .select('verification_status, confirmation_count, credibility_score, photos')
      .eq('id', bench.id)
      .maybeSingle();
    if (data) {
      setBench(prev => ({ ...prev, ...data }));
    }
  };

  const handlePhotoUploaded = async (_photoUrl: string) => {
    // Refresh bench to pick up updated photos[] and verification state
    await refreshBench();
    // Force PhotoGallery remount to reload from bench_photos table
    setPhotoGalleryKey(k => k + 1);
  };

  const handleConfirmation = async (type: 'exists' | 'removed') => {
    if (!session?.user?.id) { setShowAuthPrompt(true); return; }
    const isAlreadyConfirmed = userConfirmations[type];
    if (isAlreadyConfirmed) {
      const { error } = await supabase.from('bench_confirmations').delete()
        .eq('bench_id', bench.id).eq('user_id', session.user.id).eq('confirmation_type', type);
      if (!error) {
        setUserConfirmations(prev => ({ ...prev, [type]: false }));
        await refreshBench();
      }
    } else {
      const oppositeType = type === 'exists' ? 'removed' : 'exists';
      await supabase.from('bench_confirmations').delete()
        .eq('bench_id', bench.id).eq('user_id', session.user.id).eq('confirmation_type', oppositeType);
      const { error } = await supabase.from('bench_confirmations')
        .insert({ bench_id: bench.id, user_id: session.user.id, confirmation_type: type });
      if (!error) {
        setUserConfirmations({ exists: type === 'exists', removed: type === 'removed' });
        showMsg(type === 'exists' ? 'Thanks for confirming!' : 'Thanks for reporting!');
        // Notify founding user
        if (bench.founding_user_id && bench.founding_user_id !== session.user.id) {
          await supabase.from('bench_notifications').insert({
            user_id: bench.founding_user_id,
            bench_id: bench.id,
            actor_id: session.user.id,
            type: 'confirmation',
          });
        }
        await refreshBench();
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (deltaY > 80 && containerRef.current?.scrollTop === 0) onBack();
    touchStartY.current = null;
  };

  return (
    <div ref={containerRef} className="animate-slide-up" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200 flex items-center justify-between px-3 py-3 -mx-3 sm:-mx-4 mb-5">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-green-700 hover:text-green-800 transition btn-press min-h-[44px] min-w-[44px] pr-3"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-semibold text-sm hidden sm:inline">{backButtonText}</span>
          <span className="font-semibold text-sm sm:hidden">Back</span>
        </button>
        <h2 className="text-gray-900 font-bold text-sm truncate flex-1 mx-2 text-center">{bench.name}</h2>
        <button
          onClick={onBack}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition btn-press"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      <div className="space-y-5">
        {/* Main card */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          {bench.is_hidden && (
            <div className="bg-red-500 text-white text-xs font-semibold px-4 py-2 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              Hidden from public — only visible to admins
            </div>
          )}
          {primaryPhotoUrl && (
            <div
              className="relative w-full h-56 sm:h-72 bg-gray-100 overflow-hidden cursor-zoom-in"
              onClick={() => setLightboxPhoto(primaryPhotoUrl)}
            >
              <img
                src={primaryPhotoUrl}
                alt={bench.name}
                className={`w-full h-full object-cover object-center transition-opacity duration-300 ${primaryPhotoLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setPrimaryPhotoLoaded(true)}
                onError={() => setPrimaryPhotoUrl(null)}
              />
              {!primaryPhotoLoaded && (
                <div className="absolute inset-0 bg-gray-100 animate-pulse" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
            </div>
          )}

          <div className="p-4 sm:p-5 space-y-4">
            {/* Title + badge */}
            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <h1 className="text-xl font-bold text-gray-900 leading-tight">{bench.name}</h1>
                <VerificationBadge
                  status={bench.verification_status || 'unverified'}
                  confirmationCount={bench.confirmation_count}
                />
              </div>
              {(() => {
                const vibe = getVibe(bench.vibe_category as any);
                if (!vibe) return null;
                return (
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold mb-2 ${vibe.bg} ${vibe.color} border ${vibe.border}`}>
                    <span className="text-base leading-none">{vibe.emoji}</span>
                    <span>{vibe.label}</span>
                  </div>
                );
              })()}
              {bench.name !== bench.original_name && (
                <p className="text-gray-500 text-sm">Originally: {bench.original_name}</p>
              )}
            </div>

            {/* Admin controls */}
            {isAdmin && (
              <AdminControls
                bench={bench}
                onDeleted={onBack}
                onUpdated={(updates) => setBench(prev => ({ ...prev, ...updates }))}
              />
            )}

            {/* Save / Visited */}
            <div className="flex gap-3">
              <button
                onClick={() => session ? setShowSaveToList(true) : setShowAuthPrompt(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition btn-press text-sm ${
                  benchLists.length > 0
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${benchLists.length > 0 ? 'fill-current' : ''}`} />
                {benchLists.length > 0 ? `Saved (${benchLists.length})` : 'Save to List'}
              </button>
              <button
                onClick={() => session ? handleVisitedBench() : setShowAuthPrompt(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition btn-press text-sm ${
                  isVisited
                    ? 'bg-green-600 text-white shadow-md shadow-green-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Check className="w-4 h-4" />
                {isVisited ? 'Visited' : 'Mark Visited'}
              </button>
            </div>

            {/* In-list chips — only when saved */}
            {session && benchLists.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5" />
                  Saved to
                </p>
                <div className="flex flex-wrap gap-2">
                  {benchLists.map(l => (
                    <span
                      key={l.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-full text-xs font-medium"
                    >
                      <span>{l.emoji}</span>
                      <span>{l.name}</span>
                    </span>
                  ))}
                  <button
                    onClick={() => setShowSaveToList(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 text-gray-500 hover:border-green-400 hover:text-green-700 rounded-full text-xs font-medium transition"
                  >
                    + Add to list
                  </button>
                </div>
              </div>
            )}

            {/* Community verification section */}
            <VerificationSection
              bench={bench}
              userConfirmations={userConfirmations}
              saveMessage={saveMessage}
              ratings={ratings}
              onConfirmation={handleConfirmation}
              onReview={() => session ? setShowAddRating(true) : setShowAuthPrompt(true)}
              session={session}
              onSignIn={() => setShowAuthPrompt(true)}
            />

            {/* Rating summary */}
            {ratings.length > 0 && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Star className="w-5 h-5 text-amber-500 fill-current" />
                    <span className="text-xl font-bold text-gray-900">
                      {avgRating > 0 ? avgRating.toFixed(1) : '—'}
                    </span>
                  </div>
                  <span className="text-gray-500 text-sm">({ratings.length} review{ratings.length !== 1 ? 's' : ''})</span>
                </div>
              </div>
            )}

            {/* Description */}
            {bench.description && (
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-1.5">About</h2>
                <p className="text-gray-600 text-sm leading-relaxed">{bench.description}</p>
              </div>
            )}

            {/* Location type + Tags */}
            {(bench.location_type || (bench.tags && bench.tags.length > 0)) && (
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-2">Features</h2>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const lt = getLocationType(bench.location_type as any);
                    return lt ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-sm font-medium">
                        <span>{lt.emoji}</span>
                        <span>{lt.label}</span>
                      </span>
                    ) : null;
                  })()}
                  {(bench.tags ?? []).map((tag, i) => (
                    <span key={i} className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Founding bencher / Added by */}
            {founderUsername && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <User className="w-4 h-4 text-amber-700 flex-shrink-0" />
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span className="text-sm text-amber-800">Added by</span>
                  <span className="text-sm font-bold text-amber-900">@{founderUsername}</span>
                  {founderFeaturedBadge && (
                    <span className="text-base" title={founderFeaturedBadge}>{BADGE_ICONS[founderFeaturedBadge] ?? ''}</span>
                  )}
                  {founderIsFoundingBencher && <FoundingBencherBadge size="xs" />}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Location + actions row */}
        <div className="flex gap-2">
          {(locationLabel || distance !== undefined) ? (
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-white border border-gray-200 rounded-xl min-w-0">
              <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
              <div className="min-w-0">
                {locationLabel && (
                  <p className="text-sm font-medium text-gray-800 truncate">{locationLabel}</p>
                )}
                {distance !== undefined && (
                  <p className="text-xs text-gray-500">{formatDistanceLabel(distance, distanceUnit)} away</p>
                )}
              </div>
            </div>
          ) : null}
          <button
            onClick={() => {
              const url = `${window.location.origin}/bench/${bench.id}`;
              if (navigator.share) {
                navigator.share({ title: bench.name, url }).catch(() => {
                  // Fallback to clipboard if share fails
                  navigator.clipboard.writeText(url).catch(() => {});
                  setShareCopied(true);
                  setTimeout(() => setShareCopied(false), 2500);
                });
              } else {
                navigator.clipboard.writeText(url).then(() => {
                  setShareCopied(true);
                  setTimeout(() => setShareCopied(false), 2500);
                }).catch(() => {
                  setShareCopied(true);
                  setTimeout(() => setShareCopied(false), 2500);
                });
              }
            }}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition btn-press ${!(locationLabel || distance !== undefined) ? 'flex-1' : 'flex-shrink-0'}`}
          >
            <Share2 className="w-4 h-4" />
            {shareCopied ? 'Copied!' : 'Share'}
          </button>
          <a
            href={`https://maps.google.com/?q=${bench.latitude},${bench.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition btn-press ${!(locationLabel || distance !== undefined) ? 'flex-1' : 'flex-shrink-0'}`}
          >
            <ExternalLink className="w-4 h-4" />
            Directions
          </a>
        </div>

        {/* Photos section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">
              Photos{(bench.photos?.length ?? 0) > 0 ? ` (${bench.photos!.length})` : ''}
            </h2>
          </div>

          <div className="space-y-3">
            {/* Gallery — only when photos exist */}
            {(bench.photos?.length ?? 0) > 0 && (
              <PhotoGallery key={photoGalleryKey} benchId={bench.id} />
            )}

            {/* Upload section */}
            {session ? (
              <AddPhotoSection
                benchId={bench.id}
                foundingUserId={bench.founding_user_id}
                hasPhotos={(bench.photos?.length ?? 0) > 0}
                onUploaded={handlePhotoUploaded}
              />
            ) : (
              <button
                onClick={() => setShowAuthPrompt(true)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300 hover:border-green-400 text-gray-500 hover:text-green-700 rounded-xl font-medium text-sm transition"
              >
                <Camera className="w-4 h-4" />
                Add a photo
              </button>
            )}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Reviews */}
        {ratings.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-3">
              Reviews ({ratings.length})
            </h2>
            <div className="space-y-3">
              {ratings.map((rating) => (
                <div key={rating.id} className="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      {rating.reviewer_username && (
                        <span className="text-sm font-semibold text-gray-800">@{rating.reviewer_username}</span>
                      )}
                      {rating.reviewer_badge && (
                        <span className="text-sm" title={rating.reviewer_badge}>{BADGE_ICONS[rating.reviewer_badge] ?? ''}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">{new Date(rating.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-3">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${i < rating.overall ? 'text-amber-500 fill-current' : 'text-gray-200'}`}
                      />
                    ))}
                    <span className="text-base font-bold text-gray-900 ml-1">{rating.overall.toFixed(1)}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3">
                    {rating.comfort > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <span>🪑</span>
                        <span className="text-gray-500">Comfort:</span>
                        <span className="text-gray-900 font-semibold">{rating.comfort}/5</span>
                      </div>
                    )}
                    {rating.tranquility > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <span>🌿</span>
                        <span className="text-gray-500">Tranquility:</span>
                        <span className="text-gray-900 font-semibold">{rating.tranquility}/5</span>
                      </div>
                    )}
                    {rating.people_watching > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <span>👀</span>
                        <span className="text-gray-500">People:</span>
                        <span className="text-gray-900 font-semibold">{rating.people_watching}/5</span>
                      </div>
                    )}
                    {rating.beautiful_views > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <span>🌅</span>
                        <span className="text-gray-500">Views:</span>
                        <span className="text-gray-900 font-semibold">{rating.beautiful_views}/5</span>
                      </div>
                    )}
                    {rating.accessibility > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <span>♿</span>
                        <span className="text-gray-500">Access:</span>
                        <span className="text-gray-900 font-semibold">{rating.accessibility}/5</span>
                      </div>
                    )}
                  </div>

                  {rating.review_text && (
                    <p className="text-gray-600 text-sm border-t border-gray-100 pt-3 leading-relaxed">
                      "{rating.review_text}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showAddRating && (
        <AddRating
          benchId={bench.id}
          foundingUserId={bench.founding_user_id}
          onClose={() => setShowAddRating(false)}
          onSuccess={() => { setShowAddRating(false); fetchRatings(); refreshBench(); }}
        />
      )}

      {showAuthPrompt && (
        <AuthPromptModal
          onSignUp={() => navigate('/login?signup=1')}
          onLogIn={() => navigate('/login')}
          onClose={() => setShowAuthPrompt(false)}
        />
      )}

      {showSaveToList && (
        <SaveToListModal
          benchId={bench.id}
          benchName={bench.name}
          onClose={() => { setShowSaveToList(false); fetchBenchLists(); }}
        />
      )}

      {lightboxPhoto && (
        <ImageLightbox
          imageUrl={lightboxPhoto}
          imageAlt={bench.name}
          onClose={() => setLightboxPhoto(null)}
        />
      )}
    </div>
  );
}
