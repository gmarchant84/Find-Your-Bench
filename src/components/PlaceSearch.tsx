import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, MapPin, Navigation, Tag, Smile, Loader2 } from 'lucide-react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { supabase, BENCH_VIBES, getVibe } from '../lib/supabase';

interface PlaceSearchProps {
  onPlaceSelect: (lat: number, lng: number, placeName: string) => void;
  onClose: () => void;
  userLocation?: { lat: number; lng: number } | null;
}

interface BenchResult {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  vibe_category?: string | null;
  tags?: string[] | null;
  photos?: string[] | null;
}

interface PlacePrediction {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

type ResultSection =
  | { kind: 'places'; items: PlacePrediction[] }
  | { kind: 'benches'; items: BenchResult[] };

const DEBOUNCE_MS = 280;

export default function PlaceSearch({ onPlaceSelect, onClose, userLocation }: PlaceSearchProps) {
  const [query, setQuery] = useState('');
  const [sections, setSections] = useState<ResultSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const placesLib = useMapsLibrary('places');
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Autofocus on mount
    setTimeout(() => inputRef.current?.focus(), 60);
  }, []);

  useEffect(() => {
    if (!placesLib) return;
    autocompleteService.current = new placesLib.AutocompleteService();
    const div = document.createElement('div');
    placesService.current = new placesLib.PlacesService(div);
  }, [placesLib]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const search = useCallback(async (value: string) => {
    if (!value.trim()) {
      setSections([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);

    const lower = value.toLowerCase();
    const [placePredictions, benchResults] = await Promise.all([
      // ── Google Places autocomplete ──────────────────────────────────────
      new Promise<PlacePrediction[]>((resolve) => {
        if (!autocompleteService.current) { resolve([]); return; }

        // Build location bias from user's current position so neighborhood
        // names like "Ocean Beach" rank results near them first.
        const locationBias: google.maps.places.AutocompletionRequest = {
          input: value,
          ...(userLocation
            ? {
                location: new google.maps.LatLng(userLocation.lat, userLocation.lng),
                radius: 50000, // 50 km bias radius
              }
            : {}),
        };

        autocompleteService.current.getPlacePredictions(
          locationBias,
          (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
              resolve(
                results.slice(0, 5).map((r) => ({
                  placeId: r.place_id,
                  mainText: r.structured_formatting.main_text,
                  secondaryText: r.structured_formatting.secondary_text,
                }))
              );
            } else {
              resolve([]);
            }
          }
        );
      }),

      // ── Bench search (name + vibe + tags) ──────────────────────────────
      (async (): Promise<BenchResult[]> => {
        // Check if query matches a vibe label or emoji
        const matchedVibe = BENCH_VIBES.find(
          (v) =>
            v.label.toLowerCase().includes(lower) ||
            v.id.toLowerCase().includes(lower) ||
            lower.includes(v.emoji)
        );

        let q = supabase
          .from('benches')
          .select('id, name, latitude, longitude, vibe_category, tags, photos')
          .limit(6);

        if (matchedVibe) {
          q = q.eq('vibe_category', matchedVibe.id);
        } else {
          q = q.ilike('name', `%${value}%`);
        }

        const { data } = await q;

        // Also do a tag match if no name results
        if (!matchedVibe && (!data || data.length === 0)) {
          const { data: tagData } = await supabase
            .from('benches')
            .select('id, name, latitude, longitude, vibe_category, tags, photos')
            .contains('tags', [lower])
            .limit(4);
          return (tagData as BenchResult[]) ?? [];
        }

        return (data as BenchResult[]) ?? [];
      })(),
    ]);

    const next: ResultSection[] = [];
    if (placePredictions.length > 0) next.push({ kind: 'places', items: placePredictions });
    if (benchResults.length > 0) next.push({ kind: 'benches', items: benchResults });

    setSections(next);
    setLoading(false);
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!value.trim()) {
      setSections([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceTimer.current = setTimeout(() => search(value), DEBOUNCE_MS);
  };

  const handlePlaceClick = (placeId: string, description: string) => {
    if (!placesService.current) return;
    placesService.current.getDetails(
      { placeId, fields: ['geometry', 'name'] },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          onPlaceSelect(place.geometry.location.lat(), place.geometry.location.lng(), description);
        }
      }
    );
  };

  const handleBenchClick = (bench: BenchResult) => {
    onPlaceSelect(Number(bench.latitude), Number(bench.longitude), bench.name);
  };

  const isEmpty = hasSearched && !loading && sections.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col sm:items-center sm:justify-start sm:pt-16 p-0 sm:p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative w-full sm:max-w-lg bg-white sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-screen sm:max-h-[80vh] mt-auto sm:mt-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
          <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Search places, benches, vibes..."
            className="flex-1 text-base text-gray-900 placeholder-gray-400 bg-transparent outline-none"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {loading && <Loader2 className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" />}
          {!loading && query && (
            <button
              onClick={() => handleChange('')}
              className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition"
            >
              <X className="w-3.5 h-3.5 text-gray-600" />
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-shrink-0 text-sm font-medium text-gray-500 hover:text-gray-800 transition pl-1 sm:hidden"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="hidden sm:flex flex-shrink-0 w-8 h-8 items-center justify-center rounded-full hover:bg-gray-100 transition"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* Empty state */}
          {isEmpty && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Search className="w-6 h-6 text-gray-400" />
              </div>
              <p className="font-semibold text-gray-700 mb-1">No results for "{query}"</p>
              <p className="text-sm text-gray-500">Try a different place, bench name, or vibe</p>
            </div>
          )}

          {/* Idle state — show vibe shortcuts */}
          {!hasSearched && !loading && (
            <div className="px-4 py-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Browse by Vibe</p>
              <div className="grid grid-cols-2 gap-2">
                {BENCH_VIBES.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => handleChange(v.label)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition hover:shadow-sm text-left ${v.bg} ${v.border} ${v.color}`}
                  >
                    <span className="text-lg leading-none">{v.emoji}</span>
                    <span className="text-sm font-medium">{v.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sections */}
          {sections.map((section, si) => (
            <div key={si}>
              {section.kind === 'places' && (
                <>
                  <div className="px-4 pt-4 pb-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                      <Navigation className="w-3 h-3" />
                      Locations
                    </p>
                  </div>
                  {section.items.map((p) => (
                    <button
                      key={p.placeId}
                      onClick={() => handlePlaceClick(p.placeId, p.mainText)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-4 h-4 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{p.mainText}</p>
                        {p.secondaryText && (
                          <p className="text-sm text-gray-500 truncate">{p.secondaryText}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </>
              )}

              {section.kind === 'benches' && (
                <>
                  <div className="px-4 pt-4 pb-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                      <Tag className="w-3 h-3" />
                      Benches
                    </p>
                  </div>
                  {section.items.map((bench) => {
                    const vibe = getVibe(bench.vibe_category as any);
                    return (
                      <button
                        key={bench.id}
                        onClick={() => handleBenchClick(bench)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition text-left"
                      >
                        {(bench.photos ?? []).length > 0 ? (
                          <img
                            src={bench.photos![0]}
                            alt={bench.name}
                            className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-base"
                            style={vibe ? { background: `linear-gradient(135deg, ${vibe.markerGradient[0]}, ${vibe.markerGradient[1]})` } : { background: 'linear-gradient(135deg,#4ade80,#10b981)' }}
                          >
                            {vibe ? vibe.emoji : <Smile className="w-4 h-4 text-white" />}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{bench.name}</p>
                          {vibe && (
                            <p className={`text-sm truncate ${vibe.color}`}>{vibe.emoji} {vibe.label}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          ))}

          {/* Bottom padding for mobile */}
          <div className="h-4" />
        </div>
      </div>
    </div>
  );
}
