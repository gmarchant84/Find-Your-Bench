import { useEffect, useState, useRef, useCallback, Component, ReactNode } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker, useMap, InfoWindow } from '@vis.gl/react-google-maps';
import { MapPin, Navigation, Star, X, ArrowRight, Map as MapIcon } from 'lucide-react';
import { supabase, Bench, getVibe } from '../lib/supabase';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { calculateDistance, formatDistance, DistanceUnit } from '../lib/distance';

const NEARBY_RADIUS_METERS = 2000;

interface BenchMapProps {
  onBenchClick: (bench: Bench) => void;
  onMapLongPress?: (lat: number, lng: number) => void;
  selectedBench?: Bench | null;
  center?: { lat: number; lng: number } | null;
  zoom?: number;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  distanceUnit?: DistanceUnit;
  placementMode?: boolean;
  onPlacementConfirm?: (lat: number, lng: number) => void;
  onPlacementCancel?: () => void;
  onPlacedPinChange?: (pin: { lat: number; lng: number } | null) => void;
  onCameraChange?: (center: { lat: number; lng: number }, zoom: number) => void;
}

interface BenchWithDistance extends Bench {
  distance?: number;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function MarkerWithRef({
  bench,
  isSelected,
  isSaved,
  isNearby,
  onClick,
  onRef,
}: {
  bench: BenchWithDistance;
  isSelected: boolean;
  isSaved: boolean;
  isNearby: boolean;
  onClick: () => void;
  onRef: (marker: google.maps.marker.AdvancedMarkerElement | null) => void;
}) {
  const vibe = getVibe(bench.vibe_category);
  const scale = isSelected ? 'scale-125' : 'scale-100';

  // Border: selected > saved > vibe color > nearby > default white
  const borderStyle: React.CSSProperties = isSelected
    ? { borderColor: '#22c55e' }
    : isSaved
    ? { borderColor: '#f59e0b' }
    : vibe
    ? { borderColor: vibe.hex }
    : isNearby
    ? { borderColor: '#60a5fa' }
    : { borderColor: '#ffffff' };

  // No-photo marker background: use vibe gradient or default green
  const markerBg: React.CSSProperties = vibe
    ? { background: `linear-gradient(135deg, ${vibe.markerGradient[0]}, ${vibe.markerGradient[1]})` }
    : { background: 'linear-gradient(135deg, #4ade80, #10b981)' };

  return (
    <AdvancedMarker
      position={{ lat: Number(bench.latitude), lng: Number(bench.longitude) }}
      onClick={onClick}
      ref={onRef}
      zIndex={isSelected ? 100 : isSaved ? 10 : 1}
    >
      <div
        className={`relative cursor-pointer transition-all duration-200 hover:scale-110 active:scale-90 ${scale}`}
        style={{ filter: isSelected ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.35))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
      >
        {(bench.photos ?? []).length > 0 ? (
          <div className="w-12 h-12 rounded-full border-4 shadow-lg overflow-hidden" style={borderStyle}>
            <img src={(bench.photos ?? [])[0]} alt={bench.name} className="w-full h-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        ) : (
          <div className="w-11 h-11 rounded-full border-4 shadow-lg flex items-center justify-center" style={{ ...markerBg, ...borderStyle }}>
            {vibe
              ? <span className="text-lg leading-none select-none">{vibe.emoji}</span>
              : <MapPin className="w-5 h-5 text-white" />
            }
          </div>
        )}
        {(bench.average_rating ?? 0) > 0 && (
          <div
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-white shadow-md whitespace-nowrap border-2"
            style={{ borderColor: vibe?.hex ?? '#22c55e' }}
          >
            <span className="text-[9px] font-bold" style={{ color: vibe?.hex ?? '#15803d' }}>
              {bench.average_rating!.toFixed(1)}
            </span>
          </div>
        )}
      </div>
    </AdvancedMarker>
  );
}

function MapContent({
  onBenchClick,
  onMapLongPress,
  selectedBench,
  center: externalCenter,
  zoom: externalZoom,
  initialCenter,
  initialZoom,
  distanceUnit = 'miles',
  placementMode = false,
  onPlacementConfirm,
  onPlacementCancel,
  onPlacedPinChange,
  onCameraChange,
}: BenchMapProps) {
  const map = useMap();
  const [benches, setBenches] = useState<BenchWithDistance[]>([]);
  const [popupBench, setPopupBench] = useState<BenchWithDistance | null>(null);
  const [tempPin, setTempPin] = useState<{ lat: number; lng: number } | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyBenchIds, setNearbyBenchIds] = useState<string[]>([]);
  const [showNearbyOnly, setShowNearbyOnly] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [savedBenchIds, setSavedBenchIds] = useState<string[]>([]);
  // Placement mode: position of the preview pin (follows mouse on desktop)
  const [previewPin, setPreviewPin] = useState<{ lat: number; lng: number } | null>(null);
  const [placedPin, setPlacedPin] = useState<{ lat: number; lng: number } | null>(null);

  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressPosition = useRef<{ lat: number; lng: number } | null>(null);
  const markerClickedRef = useRef(false);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markerRefs = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const placementModeRef = useRef(placementMode);
  const isTouchDevice = useRef(
    typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  );

  // Keep ref in sync with prop so event handlers always read current value
  useEffect(() => {
    placementModeRef.current = placementMode;
  }, [placementMode]);

  useEffect(() => {
    fetchBenches();
    fetchSavedBenches();
  }, []);

  // Reset placement state when mode exits; clear stale marker-click guard when mode enters
  useEffect(() => {
    if (!placementMode) {
      setPreviewPin(null);
      setPlacedPin(null);
    } else {
      markerClickedRef.current = false;
    }
  }, [placementMode]);

  useEffect(() => {
    onPlacedPinChange?.(placedPin);
  }, [placedPin]);

  // ESC to cancel placement
  useEffect(() => {
    if (!placementMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onPlacementCancel?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [placementMode, onPlacementCancel]);

  useEffect(() => {
    if (tempPin) {
      const timer = setTimeout(() => setTempPin(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [tempPin]);

  useEffect(() => {
    if (externalCenter && map) {
      map.panTo(externalCenter);
      if (externalZoom) map.setZoom(externalZoom);
    }
  }, [externalCenter, externalZoom, map]);

  // Report camera position back to parent whenever the map idles after pan/zoom
  useEffect(() => {
    if (!map || !onCameraChange) return;
    const listener = map.addListener('idle', () => {
      const c = map.getCenter();
      const z = map.getZoom();
      if (c && z !== undefined) {
        onCameraChange({ lat: c.lat(), lng: c.lng() }, z);
      }
    });
    return () => google.maps.event.removeListener(listener);
  }, [map, onCameraChange]);

  useEffect(() => {
    if (!map) return;
    if (!clustererRef.current) {
      clustererRef.current = new MarkerClusterer({ map, markers: [] });
    }
    const markers = Array.from(markerRefs.current.values());
    clustererRef.current.clearMarkers();
    clustererRef.current.addMarkers(markers);
  }, [map, benches, showNearbyOnly]);

  // Apply/remove crosshair cursor on the map element when in placement mode
  useEffect(() => {
    if (!map) return;
    const mapDiv = map.getDiv();
    if (placementMode) {
      mapDiv.style.cursor = 'crosshair';
    } else {
      mapDiv.style.cursor = '';
    }
  }, [map, placementMode]);

  const fetchBenches = async () => {
    const { data, error } = await supabase
      .from('benches')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.error('Error fetching benches:', error); return; }
    if (data) setBenches(data as BenchWithDistance[]);
  };

  const fetchSavedBenches = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('saved_benches')
      .select('bench_id')
      .eq('user_id', user.id);
    if (data) setSavedBenchIds(data.map((s) => s.bench_id));
  };

  const findNearbyBenches = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }
    setLocationError(null);
    setNearbyLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userPos = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(userPos);
        const benchesWithDistance = benches.map((bench) => ({
          ...bench,
          distance: calculateDistance(userPos.lat, userPos.lng, Number(bench.latitude), Number(bench.longitude)),
        }));
        const nearby = benchesWithDistance.filter((b) => (b.distance ?? Infinity) <= NEARBY_RADIUS_METERS).map((b) => b.id);
        setNearbyBenchIds(nearby);
        setBenches(benchesWithDistance);
        setShowNearbyOnly(true);
        setNearbyLoading(false);
        if (map) { map.panTo(userPos); map.setZoom(15); }
      },
      (err) => {
        console.error('Error getting location:', err);
        setNearbyLoading(false);
        setLocationError('Unable to get your location. Please enable location services.');
      }
    );
  };

  // ── Placement mode handlers ──────────────────────────────────────────────

  const extractLatLng = (e: any): { lat: number; lng: number } | null => {
    const latLng = e?.detail?.latLng ?? e?.latLng;
    if (!latLng) return null;
    if (typeof latLng.lat === 'function') return { lat: latLng.lat(), lng: latLng.lng() };
    return { lat: latLng.lat, lng: latLng.lng };
  };

  const handleMapMouseMove = useCallback((e: any) => {
    if (!placementModeRef.current || placedPin) return;
    const pos = extractLatLng(e);
    if (pos) setPreviewPin(pos);
  }, [placedPin]);

  const handleMapClick = useCallback((e: any) => {
    if (placementModeRef.current) {
      if (markerClickedRef.current) { markerClickedRef.current = false; return; }
      const pos = extractLatLng(e);
      if (pos) {
        setPlacedPin(pos);
        setPreviewPin(null);
      }
      return;
    }
    if (markerClickedRef.current) { markerClickedRef.current = false; return; }
    setPopupBench(null);
  }, []);

  const handleRightClick = useCallback((e: any) => {
    if (placementModeRef.current) return;
    const pos = extractLatLng(e);
    if (pos && onMapLongPress) {
      setTempPin(pos);
      onMapLongPress(pos.lat, pos.lng);
    }
  }, [onMapLongPress]);

  // Desktop mouse-down (non-touch) for right-click fallback — handled via onContextmenu
  const handleMouseDown = useCallback((_e: any) => {
    // no-op: placement is handled via the floating button + click
  }, []);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleMarkerRef = useCallback(
    (benchId: string) => (marker: google.maps.marker.AdvancedMarkerElement | null) => {
      if (marker) { markerRefs.current.set(benchId, marker); }
      else { markerRefs.current.delete(benchId); }
    },
    []
  );

  const benchesToShow = showNearbyOnly
    ? benches.filter((b) => nearbyBenchIds.includes(b.id))
    : benches;

  const activePin = placedPin ?? previewPin;

  return (
    <>
      <GoogleMap
        defaultCenter={initialCenter ?? { lat: 37.7749, lng: -122.4194 }}
        defaultZoom={initialZoom ?? 13}
        mapId="find-your-bench-map"
        onMousemove={handleMapMouseMove}
        onMousedown={handleMouseDown}
        onMouseup={clearLongPress}
        onClick={handleMapClick}
        onContextmenu={handleRightClick}
        className="w-full h-full"
        gestureHandling="greedy"
        disableDefaultUI={false}
        clickableIcons={false}
      >
        {/* Placement preview / placed pin */}
        {placementMode && activePin && (
          <AdvancedMarker
            position={{ lat: activePin.lat, lng: activePin.lng }}
            zIndex={500}
          >
            <div className={`relative ${placedPin ? '' : 'pointer-events-none'}`}>
              {/* Pulsing ring */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`w-14 h-14 rounded-full border-4 ${placedPin ? 'border-green-500 animate-pulse' : 'border-green-400/60'} -translate-x-1/2 -translate-y-1/2`} />
              </div>
              <MapPin
                className={`w-10 h-10 drop-shadow-xl -translate-x-1/2 -translate-y-full ${placedPin ? 'text-green-600' : 'text-green-500/80'}`}
                fill="currentColor"
                strokeWidth={1.5}
              />
            </div>
          </AdvancedMarker>
        )}

        {/* Legacy temp pin (long-press / right-click outside placement mode) */}
        {!placementMode && tempPin && (
          <AdvancedMarker position={{ lat: tempPin.lat, lng: tempPin.lng }}>
            <div className="animate-bounce">
              <MapPin className="w-10 h-10 text-red-500 drop-shadow-lg" fill="currentColor" />
            </div>
          </AdvancedMarker>
        )}

        {userLocation && (
          <AdvancedMarker position={userLocation} zIndex={200}>
            <div className="relative">
              <div className="w-5 h-5 bg-blue-500 rounded-full border-4 border-white shadow-lg" />
              <div className="absolute inset-0 w-5 h-5 bg-blue-400 rounded-full animate-ping opacity-75" />
            </div>
          </AdvancedMarker>
        )}

        {benchesToShow.map((bench) => (
          <MarkerWithRef
            key={bench.id}
            bench={bench}
            isSelected={selectedBench?.id === bench.id || popupBench?.id === bench.id}
            isSaved={savedBenchIds.includes(bench.id)}
            isNearby={nearbyBenchIds.includes(bench.id)}
            onClick={() => {
              markerClickedRef.current = true;
              if (placementMode) return;
              if (isTouchDevice.current) {
                onBenchClick(bench);
              } else {
                setPopupBench(bench);
              }
            }}
            onRef={handleMarkerRef(bench.id)}
          />
        ))}

        {popupBench && !placementMode && (
          <InfoWindow
            position={{ lat: Number(popupBench.latitude), lng: Number(popupBench.longitude) }}
            onCloseClick={() => setPopupBench(null)}
            pixelOffset={[0, -55]}
          >
            <div
              className="w-64 font-sans animate-scale-in cursor-pointer group rounded-xl overflow-hidden -m-3"
              onClick={() => { setPopupBench(null); onBenchClick(popupBench); }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setPopupBench(null); onBenchClick(popupBench); } }}
              aria-label={`View ${popupBench.name}`}
            >
              {(popupBench.photos ?? []).length > 0 && (
                <div className="w-full h-36 overflow-hidden">
                  <img
                    src={(popupBench.photos ?? [])[0]}
                    alt={popupBench.name}
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
                  />
                </div>
              )}
              <div className={`px-4 pt-3 pb-4 transition-colors duration-150 group-hover:bg-gray-50 group-active:bg-gray-100 ${(popupBench.photos ?? []).length === 0 ? 'pt-4' : ''}`}>
                <h3 className="font-bold text-gray-900 text-base leading-tight mb-1.5 group-hover:text-green-700 transition-colors">
                  {popupBench.name}
                </h3>
                {getVibe(popupBench.vibe_category) && (() => {
                  const v = getVibe(popupBench.vibe_category)!;
                  return (
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold mb-2 ${v.bg} ${v.color} border ${v.border}`}>
                      <span>{v.emoji}</span>
                      <span>{v.label}</span>
                    </div>
                  );
                })()}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {(popupBench.average_rating ?? 0) > 0 ? (
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        <span className="text-sm font-semibold text-gray-700">{popupBench.average_rating!.toFixed(1)}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">No ratings yet</span>
                    )}
                    {popupBench.distance !== undefined && (
                      <div className="flex items-center gap-1 text-gray-500">
                        <Navigation className="w-3 h-3" />
                        <span className="text-xs">{formatDistance(popupBench.distance, distanceUnit)}</span>
                      </div>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-green-600 group-hover:translate-x-0.5 transition-all duration-150" />
                </div>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Right-click hint — desktop only, shown briefly on first hover if not in placement mode */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={findNearbyBenches}
          disabled={nearbyLoading}
          className="px-4 py-3 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-xl shadow-lg flex items-center gap-2 transition-colors border border-gray-200 disabled:opacity-60 btn-press"
        >
          <Navigation size={18} className={nearbyLoading ? 'text-gray-400 animate-spin' : 'text-blue-500'} />
          {nearbyLoading ? 'Finding...' : 'Nearby Benches'}
        </button>

        {showNearbyOnly && (
          <div className="flex flex-col gap-1">
            <div className="px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg shadow text-center">
              Showing {nearbyBenchIds.length} bench{nearbyBenchIds.length !== 1 ? 'es' : ''} near you
            </div>
            <button
              onClick={() => { setShowNearbyOnly(false); setNearbyBenchIds([]); }}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-800 text-white text-xs font-medium rounded-lg shadow transition-colors flex items-center justify-center gap-1"
            >
              <X className="w-3 h-3" />
              Show all benches
            </button>
          </div>
        )}

        {locationError && (
          <div className="px-3 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg shadow text-center">
            {locationError}
          </div>
        )}
      </div>
    </>
  );
}

class MapErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  render() {
    if (this.state.crashed) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-green-50 text-gray-500">
          <MapIcon className="w-10 h-10 text-green-300" />
          <p className="text-sm font-medium">Map failed to load</p>
          <button
            onClick={() => this.setState({ crashed: false })}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function BenchMap(props: BenchMapProps) {
  return (
    <MapErrorBoundary>
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <MapContent {...props} />
      </APIProvider>
    </MapErrorBoundary>
  );
}