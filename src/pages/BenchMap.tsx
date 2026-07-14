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
  const { session, isAdmin, currentStreak, refreshStreak } = useAuth();
  const navigate = useNavigate();
  const [benches, setBenches] = useState<BenchWithDistance[]>([]);
  const [filteredBenches, setFilteredBenches] = useState<BenchWithDistance[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(() => loadMapState()?.category ?? 'all');
  const [selectedLocationType, setSelectedLocationType] = useState('all');
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
    let filtered = benches;
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(b => b.vibe_category === selectedCategory);
    }
    if (selectedLocationType !== 'all') {
      filtered = filtered.filter(b => b.location_type === selectedLocationType);
    }
    setFilteredBenches(filtered);
    savedState.current = { ...savedState.current, category: selectedCategory };
    saveMapState(savedState.current);
  }, [benches, selectedCategory, selectedLocationType]);

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

  const handleBenchCreated = async (benchId: string) => {
    // The new AddBenchModal handles all insertion itself — we just clean up UI and refresh
    setShowAddModal(false);
    setAddBenchLocation(null);
    setPlacementMode(false);

    // Check if this was their first bench
    const { count: benchCount } = await supabase
      .from('benches')
      .select('id', { count: 'exact', head: true })
      .eq('founding_user_id', session?.user?.id ?? '');
    const isFirstBench = (benchCount ?? 0) <= 1;
    showToast('success', isFirstBench ? "Welcome. You're no longer a ground-sitter." : 'Bench added! Thanks for contributing.');

    fetchBenches();
    checkIfNewUser();
    refreshStreak();
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
    setSelectedLocationType('all');
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

      {/* Placement mode — instruction chip at top, confirm button near the pin at bottom */}
      {placementMode && (
        <>
          {/* Top instruction chip */}
          <div className="fixed inset-x-0 top-4 flex justify-center z-[90] pointer-events-none px-4">
            <div className="bg-gray-900/90 backdrop-blur-sm text-white rounded-2xl shadow-2xl flex items-center gap-3 px-5 py-3 pointer-events-auto">
              <p className="text-sm font-semibold">
                {placedPin ? 'Pin placed — confirm or tap to reposition' : 'Tap the map to place your bench'}
              </p>
              <button
                onClick={handlePlacementCancel}
                className="p-1.5 hover:bg-white/10 rounded-xl transition-colors ml-1"
                aria-label="Cancel placement"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Confirm button — floats at bottom near where the pin lands */}
          {placedPin && (
            <div className="fixed inset-x-0 bottom-8 flex justify-center z-[90] pointer-events-none px-4">
              <button
                onClick={() => handlePlacementConfirm(placedPin.lat, placedPin.lng)}
                className="pointer-events-auto px-8 py-4 bg-green-500 hover:bg-green-400 active:bg-green-600 text-white text-base font-bold rounded-2xl shadow-2xl transition-colors"
              >
                Confirm Location
              </button>
            </div>
          )}
        </>
      )}

      <Header
        viewMode={viewMode}
        showLeaderboard={showLeaderboard}
        showFilters={showFilters}
        showProfile={showProfile}
        userLocation={userLocation}
        selectedCategory={selectedCategory}
        selectedLocationType={selectedLocationType}
        isLoggedIn={!!session}
        streak={currentStreak}
        onViewModeChange={setViewMode}
        onShowLeaderboard={() => setShowLeaderboard(true)}
        onShowFilters={() => setShowFilters(!showFilters)}
        onShowProfile={handleShowProfile}
        onShowPlaceSearch={() => setShowPlaceSearch(true)}
        onShowNearby={handleShowNearby}
        onAddBench={handleOpenAddModal}
        onCategoryChange={setSelectedCategory}
        onLocationTypeChange={setSelectedLocationType}
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
            <div className={`${isNewUser || showNearbyMessage ? 'h-[calc(100vh-460px)]' : 'h-[calc(100vh-360px)]'} min-h-[300px] rounded-2xl overflow-hidden border-2 border-green-100 shadow-lg`}>
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
          onSuccess={handleBenchCreated}
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
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto relative rounded-t-2xl sm:rounded-2xl">
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
