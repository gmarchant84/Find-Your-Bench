import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import BenchList from '../components/BenchList';
import AddBenchModal from '../components/AddBenchModal';
import UserProfileModal from '../components/UserProfileModal';
import { Leaderboard } from '../components/Leaderboard';
import { BenchMap as BenchMapComponent } from '../components/BenchMap';
import PlaceSearch from '../components/PlaceSearch';
import Header from '../components/Header';
import FloatingAddButton from '../components/FloatingAddButton';
import AuthPromptModal from '../components/AuthPromptModal';
import { MapPin, X, Plus, CheckCircle, AlertCircle, Navigation } from 'lucide-react';
import { DistanceUnit, calculateDistance as calcDistance } from '../lib/distance';
import { BenchOfTheDay } from '../components/BenchOfTheDay';

interface Bench {
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
  average_rating?: number;
  total_ratings?: number;
  vibe_category?: string | null;
  is_hidden?: boolean;
  founder_username?: string | null;
  founder_is_founding_bencher?: boolean;
}

interface BenchWithDistance extends Bench {
  distance?: number;
}


const MAP_STATE_KEY = 'fyb_map_state';

interface SavedMapState {
  lat: number;
  lng: number;
  zoom: number;
  category: string;
}

function loadMapState(): SavedMapState | null {
  try {
    const raw = localStorage.getItem(MAP_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveMapState(state: SavedMapState) {
  try {
    localStorage.setItem(MAP_STATE_KEY, JSON.stringify(state));
  } catch {}
}

export default function BenchMap() {
  const { session, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [benches, setBenches] = useState<BenchWithDistance[]>([]);
  const [filteredBenches, setFilteredBenches] = useState<BenchWithDistance[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(() => loadMapState()?.category ?? 'all');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [, setLocationError] = useState<string | null>(null);
  const [addBenchLocation, setAddBenchLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showPlaceSearch, setShowPlaceSearch] = useState(false);
  const [searchCenter, setSearchCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('miles');
  const [isNewUser, setIsNewUser] = useState(true);
  const [showNearbyMessage, setShowNearbyMessage] = useState(false);
  // mapCenter/mapZoom are used only for imperative pan commands (place search, nearby).
  // The map's own camera is the source of truth for state preservation.
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(13);
  const [placementMode, setPlacementMode] = useState(false);
  const [placedPin, setPlacedPin] = useState<{ lat: number; lng: number } | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const lastBenchClickTime = useRef(0);

  // Persist camera state so it survives bench-detail overlay open/close
  const savedState = useRef<SavedMapState>(
    loadMapState() ?? { lat: 37.7749, lng: -122.4194, zoom: 13, category: 'all' }
  );
  const initialMapState = useRef(savedState.current);

  const handleCameraChange = useCallback((center: { lat: number; lng: number }, zoom: number) => {
    savedState.current = { ...center, zoom, category: savedState.current.category };
    saveMapState(savedState.current);
  }, []);

  useEffect(() => {
    fetchBenches();
    getUserLocation();
    fetchUserPreferences();
    checkIfNewUser();
    const channel = supabase
      .channel('benches-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'benches' }, () => {
        fetchBenches();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUserPreferences = async () => {
    if (!session?.user) return;

    const { data } = await supabase
      .from('profiles')
      .select('distance_unit')
      .eq('id', session.user.id)
      .maybeSingle();

    if (data && data.distance_unit) {
      setDistanceUnit(data.distance_unit as DistanceUnit);
    }
  };

  const checkIfNewUser = async () => {
    if (!session?.user) {
      setIsNewUser(true);
      return;
    }

    const { data: benchesData } = await supabase
      .from('benches')
      .select('id')
      .eq('founding_user_id', session.user.id)
      .limit(1);

    const { data: ratingsData } = await supabase
      .from('ratings')
      .select('id')
      .eq('user_id', session.user.id)
      .limit(1);

    const { data: confirmationsData } = await supabase
      .from('bench_confirmations')
      .select('id')
      .eq('user_id', session.user.id)
      .limit(1);

    const hasActivity = (benchesData && benchesData.length > 0) ||
                       (ratingsData && ratingsData.length > 0) ||
                       (confirmationsData && confirmationsData.length > 0);

    setIsNewUser(!hasActivity);
  };

  useEffect(() => {
    if (userLocation) {
      calculateDistances();
    }
  }, [userLocation]);

  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredBenches(benches);
    } else {
      setFilteredBenches(benches.filter(bench => bench.vibe_category === selectedCategory));
    }
    // Persist category change
    savedState.current = { ...savedState.current, category: selectedCategory };
    saveMapState(savedState.current);
  }, [benches, selectedCategory]);

  const getUserLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLocationError(null);
        },
        (error) => {
          console.error('Error getting location:', error);
          setLocationError('Unable to get your location');
        }
      );
    } else {
      setLocationError('Geolocation not supported');
    }
  };

  const calculateDistances = () => {
    if (!userLocation) return;

    const benchesWithDistance = benches.map((bench) => ({
      ...bench,
      distance: calcDistance(
        userLocation.lat,
        userLocation.lng,
        Number(bench.latitude),
        Number(bench.longitude)
      ),
    }));

    setBenches(benchesWithDistance);
  };

  const fetchBenches = async () => {
    const { data, error } = await supabase
      .from('benches')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      showToast('error', 'Could not load benches. Check your connection.');
      setLoading(false);
      return;
    }

    if (data) {
      const benchData = (data as Bench[]).filter(b => isAdmin || !b.is_hidden);

      // Fetch founder profiles in a single query
      const founderIds = [...new Set(benchData.map(b => b.founding_user_id).filter(Boolean))] as string[];
      let profileMap = new Map<string, { username: string | null; is_founding_bencher: boolean }>();
      if (founderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, is_founding_bencher')
          .in('id', founderIds);
        (profiles ?? []).forEach(p => profileMap.set(p.id, { username: p.username ?? null, is_founding_bencher: p.is_founding_bencher ?? false }));
      }

      const enriched = benchData.map(b => ({
        ...b,
        founder_username: b.founding_user_id ? (profileMap.get(b.founding_user_id)?.username ?? null) : null,
        founder_is_founding_bencher: b.founding_user_id ? (profileMap.get(b.founding_user_id)?.is_founding_bencher ?? false) : false,
      }));

      if (userLocation) {
        setBenches(enriched.map(bench => ({
          ...bench,
          distance: calcDistance(userLocation.lat, userLocation.lng, Number(bench.latitude), Number(bench.longitude)),
        })));
      } else {
        setBenches(enriched);
      }
    }
    setLoading(false);
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleAddBench = async (benchData: any) => {
    // photos comes as [{url, category, caption}] with already-uploaded storage URLs
    const photosWithMeta: Array<{ url: string; category: string; caption: string }> = Array.isArray(benchData.photos)
      ? benchData.photos
          .map((p: any) => typeof p === 'string' ? { url: p, category: 'bench', caption: '' } : p)
          .filter((p: any) => Boolean(p?.url))
      : [];

    const photoUrls = photosWithMeta.map(p => p.url);

    const payload = {
      name: benchData.name,
      latitude: benchData.latitude,
      longitude: benchData.longitude,
      description: benchData.description || null,
      photos: photoUrls.length > 0 ? photoUrls : null,
      tags: benchData.tags?.length > 0 ? benchData.tags : null,
      vibe_category: benchData.vibe_category ?? null,
      founding_user_id: session?.user?.id ?? null,
      original_name: benchData.name || null,
      verification_status: 'unverified',
    };

    const { data, error } = await supabase
      .from('benches')
      .insert(payload)
      .select()
      .single();

    if (error) {
      showToast('error', 'Failed to save bench. Please try again.');
      return;
    }

    if (!data) {
      showToast('error', 'Failed to save bench. Please try again.');
      return;
    }

    // Insert bench_photos rows for any uploaded photos
    if (photosWithMeta.length > 0 && session?.user?.id) {
      await supabase.from('bench_photos').insert(
        photosWithMeta.map((p, i) => ({
          bench_id: data.id,
          user_id: session.user!.id,
          photo_url: p.url,
          category: p.category || 'bench',
          caption: p.caption || null,
          is_primary: i === 0,
        }))
      );
    }

    setShowAddModal(false);
    setAddBenchLocation(null);
    setPlacementMode(false);
    showToast('success', 'Bench added! Thanks for contributing.');
    fetchBenches();
    checkIfNewUser();
  };

  const handleShowNearby = () => {
    if (userLocation) {
      // Switch to list view sorted by distance
      setViewMode('list');
      setMapCenter(userLocation);
      setMapZoom(15);
    } else {
      // Request location, then switch to list once we have it
      getUserLocation();
      setViewMode('list');
    }
  };

  const handleOpenAddModal = () => {
    // Ignore if a bench marker was just tapped — prevents ghost taps opening the add flow
    if (Date.now() - lastBenchClickTime.current < 500) return;
    if (!session) { setShowAuthPrompt(true); return; }
    setShowAddModal(true);
  };

  const handleShowProfile = () => {
    if (!session) { setShowAuthPrompt(true); return; }
    setShowProfile(true);
  };

  const handleChangeLocationManually = () => {
    setShowAddModal(false);
    setPlacementMode(true);
  };

  const handlePlacementConfirm = (lat: number, lng: number) => {
    setPlacementMode(false);
    setAddBenchLocation({ lat, lng });
    setShowAddModal(true);
  };

  const handlePlacementCancel = () => {
    setPlacementMode(false);
    // If user came from the modal (had a prior location), re-open modal keeping the original location
    if (addBenchLocation) {
      setShowAddModal(true);
    } else {
      setAddBenchLocation(null);
    }
  };

  const handleMapLongPress = (lat: number, lng: number) => {
    if (!session) { setShowAuthPrompt(true); return; }
    setAddBenchLocation({ lat, lng });
    setShowAddModal(true);
  };

  const handlePlaceSelect = (lat: number, lng: number, _placeName: string) => {
    setShowPlaceSearch(false);
    setMapCenter({ lat, lng });
    setMapZoom(15);
    // Recalculate distances from the searched location so list sorts by proximity to it
    setSearchCenter({ lat, lng });
    setBenches(prev => prev.map(bench => ({
      ...bench,
      distance: calcDistance(lat, lng, Number(bench.latitude), Number(bench.longitude)),
    })));
  };

  const handleGoHome = () => {
    setShowProfile(false);
    setShowLeaderboard(false);
    setViewMode('map');
    setSelectedCategory('all');
    setShowFilters(false);
    setSearchCenter(null);
    // Restore distances from user location when clearing search
    if (userLocation) {
      setBenches(prev => prev.map(bench => ({
        ...bench,
        distance: calcDistance(userLocation.lat, userLocation.lng, Number(bench.latitude), Number(bench.longitude)),
      })));
    }
    setMapCenter(userLocation);
    setMapZoom(13);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-yellow-50">
      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-white text-sm font-semibold transition-all animate-slide-down pointer-events-none ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-500'
        }`}>
          {toast.type === 'success'
            ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
            : <AlertCircle className="w-4 h-4 flex-shrink-0" />
          }
          {toast.message}
        </div>
      )}

      {/* Placement mode banner — fixed so it isn't clipped by the map container */}
      {placementMode && (
        <div className="fixed inset-x-0 top-4 flex justify-center z-[90] pointer-events-none px-4">
          <div className="bg-gray-900/90 backdrop-blur-sm text-white rounded-2xl shadow-2xl flex items-center gap-3 px-5 py-3.5 pointer-events-auto max-w-sm w-full">
            <div className="flex-1 min-w-0">
              {placedPin ? (
                <p className="text-sm font-semibold leading-snug">Pin placed — confirm or reposition</p>
              ) : (
                <p className="text-sm font-semibold leading-snug">Tap the map to place your bench</p>
              )}
              <p className="text-xs text-gray-400 mt-0.5">Tap Cancel to go back</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {placedPin && (
                <button
                  onClick={() => handlePlacementConfirm(placedPin.lat, placedPin.lng)}
                  className="px-3.5 py-2 bg-green-500 hover:bg-green-400 text-white text-sm font-bold rounded-xl transition-colors"
                >
                  Confirm
                </button>
              )}
              <button
                onClick={handlePlacementCancel}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                aria-label="Cancel placement"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <Header
        viewMode={viewMode}
        showLeaderboard={showLeaderboard}
        showFilters={showFilters}
        showProfile={showProfile}
        userLocation={userLocation}
        selectedCategory={selectedCategory}
        isLoggedIn={!!session}
        onViewModeChange={setViewMode}
        onShowLeaderboard={() => setShowLeaderboard(true)}
        onShowFilters={() => setShowFilters(!showFilters)}
        onShowProfile={handleShowProfile}
        onShowPlaceSearch={() => setShowPlaceSearch(true)}
        onShowNearby={handleShowNearby}
        onAddBench={handleOpenAddModal}
        onCategoryChange={setSelectedCategory}
        onGoHome={handleGoHome}
        onShowAbout={() => navigate('/about')}
      />

      <FloatingAddButton
        onClick={placementMode ? handlePlacementCancel : handleOpenAddModal}
        active={placementMode}
      />

      <div className="max-w-7xl mx-auto px-4 py-4">
        {benches.length === 0 && !loading ? (
          <div className="text-center py-12">
            <div className="bg-white rounded-2xl shadow-sm border-2 border-green-100 p-8 max-w-md mx-auto">
              <MapPin className="w-14 h-14 text-green-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-3">
                Be the first to discover a bench!
              </h2>
              <p className="text-gray-600 mb-6 text-sm">
                Help build the bench community by adding your favorite spot
              </p>
              <button
                onClick={handleOpenAddModal}
                className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition shadow-lg"
              >
                <Plus className="w-5 h-5" />
                Add Your First Bench
              </button>
            </div>
          </div>
        ) : (
          <>
          </>
        )}

        {benches.length > 0 && viewMode === 'map' ? (
          <div className="space-y-4">
            {showNearbyMessage && (
              <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 text-center animate-pulse">
                <p className="text-green-900 font-semibold">Showing benches near you</p>
              </div>
            )}
            {(
              <BenchOfTheDay
                userLocation={userLocation ? { latitude: userLocation.lat, longitude: userLocation.lng } : null}
                onBenchClick={(benchId) => {
                  navigate(`/bench/${benchId}`);
                }}
              />
            )}
            {isNewUser && (
              <div className="bg-white border-2 border-green-100 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 text-sm">New to Find Your Bench?</h3>
                  <button
                    onClick={() => navigate('/about')}
                    className="text-xs text-green-600 font-semibold hover:text-green-700 transition"
                  >
                    Learn more →
                  </button>
                </div>
                <div className="flex gap-2">
                  {userLocation && (
                    <button
                      onClick={handleShowNearby}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm transition shadow-sm"
                    >
                      <Navigation className="w-4 h-4" />
                      Benches Near Me
                    </button>
                  )}
                  <button
                    onClick={handleOpenAddModal}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition"
                  >
                    <Plus className="w-4 h-4" />
                    Add a Bench
                  </button>
                </div>
              </div>
            )}
            {/* Map is always mounted so camera state is never lost when opening a bench */}
            <div className={`${isNewUser || showNearbyMessage ? 'h-[calc(100dvh-460px)]' : 'h-[calc(100dvh-360px)]'} min-h-[300px] rounded-2xl overflow-hidden border-2 border-green-100 shadow-lg`}>
              <BenchMapComponent
                onBenchClick={(bench) => {
                  lastBenchClickTime.current = Date.now();
                  setPlacementMode(false);
                  navigate(`/bench/${bench.id}`);
                }}
                onMapLongPress={handleMapLongPress}
                selectedBench={null}
                center={mapCenter}
                zoom={mapZoom}
                initialCenter={{ lat: initialMapState.current.lat, lng: initialMapState.current.lng }}
                initialZoom={initialMapState.current.zoom}
                distanceUnit={distanceUnit}
                placementMode={placementMode}
                onPlacementConfirm={handlePlacementConfirm}
                onPlacementCancel={handlePlacementCancel}
                onPlacedPinChange={setPlacedPin}
                onCameraChange={handleCameraChange}
              />
            </div>
          </div>
        ) : benches.length > 0 ? (
          <div>
            <div>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  {selectedCategory === 'all' ? 'All Benches' : selectedCategory}
                </h2>
                <p className="text-gray-600 text-sm">
                  {filteredBenches.length} bench{filteredBenches.length !== 1 ? 'es' : ''} found
                  {filteredBenches.some(b => b.distance !== undefined) && (
                    searchCenter && !userLocation
                      ? ' · sorted by distance'
                      : searchCenter
                        ? ' · sorted by distance from search'
                        : userLocation
                          ? ' · sorted by distance'
                          : ''
                  )}
                </p>
              </div>
              <BenchList
                benches={filteredBenches.sort((a, b) => {
                  if (a.distance && b.distance) return a.distance - b.distance;
                  return 0;
                })}
                loading={loading}
                onSelectBench={(bench) => navigate(`/bench/${bench.id}`)}
                distanceUnit={distanceUnit}
              />
            </div>
          </div>
        ) : null}
      </div>

      {showAuthPrompt && (
        <AuthPromptModal
          onSignUp={() => navigate('/login?signup=1')}
          onLogIn={() => navigate('/login')}
          onClose={() => setShowAuthPrompt(false)}
        />
      )}

      {showAddModal && (
        <AddBenchModal
          onClose={() => {
            setShowAddModal(false);
            setAddBenchLocation(null);
            setPlacementMode(false);
          }}
          onAdd={handleAddBench}
          initialLocation={addBenchLocation || undefined}
          onChangeLocation={handleChangeLocationManually}
        />
      )}

      {showProfile && (
        <UserProfileModal
          onClose={() => setShowProfile(false)}
          onBenchClick={(benchId) => {
            navigate(`/bench/${benchId}`);
          }}
        />
      )}

      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto relative rounded-t-2xl sm:rounded-2xl">
            <button
              onClick={() => setShowLeaderboard(false)}
              className="absolute top-4 right-4 z-10 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5 text-gray-700" />
            </button>
            <Leaderboard onBenchClick={(benchId) => {
              navigate(`/bench/${benchId}`);
              setShowLeaderboard(false);
            }} />
          </div>
        </div>
      )}

      {showPlaceSearch && (
        <PlaceSearch
          onPlaceSelect={handlePlaceSelect}
          onClose={() => setShowPlaceSearch(false)}
          userLocation={userLocation}
        />
      )}
    </div>
  );
}
