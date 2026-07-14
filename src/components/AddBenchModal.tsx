import { useState, useRef, useEffect } from 'react';
import {
  X, MapPin, Navigation, Loader2, ChevronRight, ChevronLeft,
  Camera, Upload, AlertCircle, Crosshair, Star,
} from 'lucide-react';
import { supabase, BENCH_VIBES, VibeCategory, friendlyError } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { handleBenchAdded, handleRatingGiven } from '../lib/gamification';
import { useAchievements } from '../hooks/useAchievements';

interface AddBenchModalProps {
  onClose: () => void;
  onSuccess: (benchId: string) => void;
  initialLocation?: { lat: number; lng: number };
  onChangeLocation?: () => void;
}

type Step = 'location' | 'details' | 'review' | 'success';

interface PendingPhoto {
  file: File;
  preview: string;
}

interface SuccessData {
  benchId: string;
  benchName: string;
  benchesAdded: number;
}

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

async function compressImage(file: File, maxPx = 1600, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas 2d context unavailable')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Compression failed')),
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')); };
    img.src = objectUrl;
  });
}

const STEP_ORDER: Step[] = ['location', 'details', 'review'];
const STEP_LABELS = ['Location', 'Details', 'Review'];

function StepIndicator({ step }: { step: Step }) {
  if (step === 'success') return null;
  const current = STEP_ORDER.indexOf(step);
  return (
    <div className="flex items-center justify-center gap-2 py-3">
      {STEP_ORDER.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all ${
            i < current ? 'bg-green-500 text-white' :
            i === current ? 'bg-green-600 text-white ring-4 ring-green-100' :
            'bg-gray-200 text-gray-400'
          }`}>
            {i < current ? '✓' : i + 1}
          </div>
          <span className={`text-xs font-medium hidden sm:block ${i === current ? 'text-green-700' : 'text-gray-400'}`}>
            {STEP_LABELS[i]}
          </span>
          {i < STEP_ORDER.length - 1 && (
            <div className={`w-8 h-0.5 ${i < current ? 'bg-green-400' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function StarRating({ value, onChange, hovered, onHover, onLeave }: {
  value: number;
  onChange: (v: number) => void;
  hovered: number;
  onHover: (v: number) => void;
  onLeave: () => void;
}) {
  const display = hovered || value;
  const labels: Record<number, string> = {
    1: 'Barely better than the ground.',
    2: "It'll do in a pinch.",
    3: 'Solid bench, no complaints.',
    4: 'Worth going out of your way for.',
    5: 'Drop everything. Find this bench.',
  };
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => onHover(n)}
            onMouseLeave={onLeave}
            onTouchStart={() => onHover(n)}
            onClick={() => onChange(n)}
            className="p-1 transition-transform hover:scale-110 active:scale-95"
          >
            <Star
              className={`w-10 h-10 transition-colors ${
                n <= display
                  ? 'fill-amber-400 text-amber-400'
                  : 'fill-gray-200 text-gray-200'
              }`}
            />
          </button>
        ))}
      </div>
      <span className={`text-sm font-medium h-5 transition-opacity duration-150 ${display ? 'text-green-700' : 'text-gray-400'}`}>
        {display ? labels[display] : 'Tap to rate'}
      </span>
    </div>
  );
}

export default function AddBenchModal({
  onClose,
  onSuccess,
  initialLocation,
  onChangeLocation,
}: AddBenchModalProps) {
  const { session } = useAuth();
  const { triggerAchievementCheck } = useAchievements();
  const submittingRef = useRef(false);

  // Location state
  const [latitude, setLatitude] = useState(initialLocation?.lat.toString() || '');
  const [longitude, setLongitude] = useState(initialLocation?.lng.toString() || '');
  const [locationLabel, setLocationLabel] = useState('');
  const [generatedName, setGeneratedName] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [nearbyBenches, setNearbyBenches] = useState<{ id: string; name: string; distance_meters: number }[]>([]);

  // Details state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [vibe, setVibe] = useState<VibeCategory | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  // Review state
  const [overallRating, setOverallRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [reviewText, setReviewText] = useState('');

  // UI state
  const [step, setStep] = useState<Step>('location');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initialLocation && !latitude && !longitude) getCurrentLocation();
    else if (initialLocation) {
      resolveLocation(initialLocation.lat, initialLocation.lng);
    }
  }, []);

  const getCurrentLocation = () => {
    if (!('geolocation' in navigator)) return;
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLatitude(lat.toString());
        setLongitude(lng.toString());
        setIsGettingLocation(false);
        resolveLocation(lat, lng);
      },
      () => setIsGettingLocation(false)
    );
  };

  const resolveLocation = (lat: number, lng: number) => {
    try {
      if (typeof google !== 'undefined' && google.maps?.Geocoder) {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === 'OK' && results?.[0]) {
            const comps = results[0].address_components;
            let street = '', neighborhood = '', park = '', locality = '';
            for (const c of comps) {
              if (c.types.includes('route')) street = c.short_name;
              if ((c.types.includes('establishment') || c.types.includes('park')) && !park) park = c.long_name;
              if ((c.types.includes('neighborhood') || c.types.includes('sublocality_level_1')) && !neighborhood) neighborhood = c.long_name;
              if (c.types.includes('locality') && !locality) locality = c.long_name;
            }
            setLocationLabel(park || neighborhood || locality || '');
            setGeneratedName(
              street ? `Bench at ${street}` :
              neighborhood ? `Bench near ${neighborhood}` : 'New Bench'
            );
          } else {
            setGeneratedName('New Bench');
          }
        });
      } else {
        setGeneratedName('New Bench');
      }
    } catch {
      setGeneratedName('New Bench');
    }
    checkForDuplicates(lat, lng);
  };

  const checkForDuplicates = async (lat: number, lng: number) => {
    const { data, error } = await supabase.rpc('find_nearby_benches', {
      lat_param: lat,
      lng_param: lng,
      radius_meters: 10,
    });
    if (!error && data && data.length > 0) setNearbyBenches(data);
    else setNearbyBenches([]);
  };

  const handlePhotoInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setIsProcessingPhoto(true);
    setErrorMessage('');
    for (const file of files) {
      if (!ALLOWED_MIME.includes(file.type)) { setErrorMessage('Only JPEG, PNG, and WEBP images are allowed.'); continue; }
      if (file.size > MAX_FILE_BYTES) { setErrorMessage('Each image must be under 10 MB.'); continue; }
      const preview = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target!.result as string);
        reader.readAsDataURL(file);
      });
      setPendingPhotos(prev => [...prev, { file, preview }]);
    }
    setIsProcessingPhoto(false);
  };

  const handleSubmit = async () => {
    if (submittingRef.current || !session?.user) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage('');

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) {
      setErrorMessage('Valid location is required.');
      submittingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    const userId = session.user.id;

    // Upload photos
    const uploadedPhotos: Array<{ url: string }> = [];
    for (const pending of pendingPhotos) {
      try {
        const compressed = await compressImage(pending.file);
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const path = `${userId}/${filename}`;
        const { data: storageData, error: storageError } = await supabase.storage
          .from('bench-photos')
          .upload(path, compressed, { contentType: 'image/jpeg', upsert: false });
        if (storageError) throw storageError;
        const { data: urlData } = supabase.storage.from('bench-photos').getPublicUrl(storageData.path);
        uploadedPhotos.push({ url: urlData.publicUrl });
      } catch (err: any) {
        setErrorMessage(friendlyError(err, 'Photo upload failed. Please try again.'));
        submittingRef.current = false;
        setIsSubmitting(false);
        return;
      }
    }

    const finalName = name.trim() || generatedName || 'New Bench';

    // Insert bench
    const { data: benchData, error: benchError } = await supabase
      .from('benches')
      .insert({
        name: finalName,
        latitude: lat,
        longitude: lng,
        description: description.trim() || null,
        photos: uploadedPhotos.length > 0 ? uploadedPhotos.map(p => p.url) : null,
        vibe_category: vibe ?? null,
        founding_user_id: userId,
        original_name: finalName,
        verification_status: 'unverified',
      })
      .select()
      .single();

    if (benchError || !benchData) {
      setErrorMessage(friendlyError(benchError, 'Failed to save bench. Please try again.'));
      submittingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    // Insert bench_photos rows
    if (uploadedPhotos.length > 0) {
      await supabase.from('bench_photos').insert(
        uploadedPhotos.map((p, i) => ({
          bench_id: benchData.id,
          user_id: userId,
          photo_url: p.url,
          category: 'bench',
          is_primary: i === 0,
        }))
      );
    }

    // Insert initial rating
    const { data: ratingData, error: ratingError } = await supabase
      .from('ratings')
      .insert({
        bench_id: benchData.id,
        user_id: userId,
        overall: overallRating,
        review_text: reviewText.trim() || null,
      })
      .select('id')
      .single();

    if (!ratingError && ratingData) {
      await handleRatingGiven(userId, ratingData.id);
    }

    // Award gamification points
    await handleBenchAdded(userId, benchData.id);
    await triggerAchievementCheck();

    // Fetch stats for success screen
    const { data: statsData } = await supabase
      .from('user_stats')
      .select('benches_added')
      .eq('user_id', userId)
      .maybeSingle();

    setSuccessData({
      benchId: benchData.id,
      benchName: finalName,
      benchesAdded: statsData?.benches_added ?? 1,
    });

    submittingRef.current = false;
    setIsSubmitting(false);
    setStep('success');
    onSuccess(benchData.id);
  };

  const advanceToDetails = () => {
    if (!latitude || !longitude) return;
    setStep('details');
  };

  const advanceToReview = () => {
    setStep('review');
  };

  const resetForAnother = () => {
    setLatitude('');
    setLongitude('');
    setLocationLabel('');
    setGeneratedName('');
    setNearbyBenches([]);
    setName('');
    setDescription('');
    setVibe(null);
    setPendingPhotos([]);
    setOverallRating(0);
    setHoveredRating(0);
    setReviewText('');
    setSuccessData(null);
    setErrorMessage('');
    setStep('location');
    getCurrentLocation();
  };

  const locationSet = !!(latitude && longitude);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[92dvh] overflow-y-auto shadow-2xl flex flex-col">

        {/* Header */}
        <div className="sticky top-0 bg-white z-10 border-b border-gray-100 px-5 pt-4 pb-2">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold text-gray-900">
              {step === 'success' ? 'Bench Added!' :
               step === 'location' ? 'Step 1: Location' :
               step === 'details' ? 'Step 2: Details' :
               'Step 3: Rate It'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <StepIndicator step={step} />
        </div>

        <div className="flex-1 px-5 py-4">
          {errorMessage && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-800">{errorMessage}</p>
            </div>
          )}

          {/* STEP 1: LOCATION */}
          {step === 'location' && (
            <div className="space-y-5">
              <p className="text-sm text-gray-500">Stand next to the bench and tap "Use My Location" for the best accuracy.</p>

              <div className={`rounded-2xl border-2 p-4 transition-colors ${locationSet ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                {isGettingLocation ? (
                  <div className="flex items-center gap-3 py-2">
                    <Loader2 className="w-5 h-5 text-green-500 animate-spin" />
                    <p className="text-sm font-medium text-gray-600">Getting your location...</p>
                  </div>
                ) : locationSet ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-green-900 text-sm">Location set</p>
                        <p className="text-sm text-green-700">{locationLabel || `${parseFloat(latitude).toFixed(4)}, ${parseFloat(longitude).toFixed(4)}`}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button" onClick={getCurrentLocation}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-green-300 hover:border-green-400 text-green-700 rounded-lg text-xs font-medium transition"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        Re-detect
                      </button>
                      {onChangeLocation && (
                        <button
                          type="button" onClick={onChangeLocation}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-green-300 hover:border-green-400 text-green-700 rounded-lg text-xs font-medium transition"
                        >
                          <Crosshair className="w-3.5 h-3.5" />
                          Adjust on map
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-5 h-5 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-500">No location set yet</p>
                    </div>
                    <button
                      type="button" onClick={getCurrentLocation}
                      className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition shadow-sm"
                    >
                      <Navigation className="w-4 h-4" />
                      Use My Location
                    </button>
                    {onChangeLocation && (
                      <button
                        type="button" onClick={onChangeLocation}
                        className="w-full py-2.5 bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition"
                      >
                        <Crosshair className="w-4 h-4" />
                        Pick on map
                      </button>
                    )}
                  </div>
                )}
              </div>

              {nearbyBenches.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm font-semibold text-amber-900">Nearby bench already exists</p>
                  </div>
                  {nearbyBenches.slice(0, 2).map(b => (
                    <div key={b.id} className="bg-white rounded-lg px-3 py-2 flex items-center justify-between mt-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{b.name || 'Unnamed Bench'}</p>
                        <p className="text-xs text-gray-500">{b.distance_meters.toFixed(0)}m away</p>
                      </div>
                      <button type="button" onClick={onClose}
                        className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 transition">
                        View it
                      </button>
                    </div>
                  ))}
                  <p className="text-xs text-amber-700 mt-2">Tap "Next" below only if this is a different bench.</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: DETAILS */}
          {step === 'details' && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Bench name <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text" value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 transition"
                  placeholder={generatedName || 'e.g. Sunset View Bench'}
                  maxLength={120}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Vibe <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {BENCH_VIBES.map((v) => {
                    const selected = vibe === v.id;
                    return (
                      <button
                        key={v.id} type="button" onClick={() => setVibe(selected ? null : v.id)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition ${
                          selected ? `${v.bg} ${v.color} ${v.border}` : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span>{v.emoji}</span>
                        <span className="text-xs">{v.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Photos <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                {pendingPhotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {pendingPhotos.map((photo, i) => (
                      <div key={i} className="relative aspect-square group">
                        <img src={photo.preview} alt="" className="w-full h-full object-cover rounded-xl border-2 border-gray-100" />
                        <button
                          type="button"
                          onClick={() => setPendingPhotos(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button" onClick={() => cameraInputRef.current?.click()} disabled={isProcessingPhoto}
                    className="flex-1 py-3 border-2 border-dashed border-gray-300 hover:border-green-400 rounded-xl flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-green-600 transition bg-gray-50 hover:bg-green-50 disabled:opacity-50"
                  >
                    {isProcessingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    Camera
                  </button>
                  <button
                    type="button" onClick={() => fileInputRef.current?.click()} disabled={isProcessingPhoto}
                    className="flex-1 py-3 border-2 border-dashed border-gray-300 hover:border-green-400 rounded-xl flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-green-600 transition bg-gray-50 hover:bg-green-50 disabled:opacity-50"
                  >
                    {isProcessingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Upload
                  </button>
                </div>
                <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple className="hidden" onChange={handlePhotoInput} />
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handlePhotoInput} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Description <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={description} onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 transition resize-none text-sm"
                  placeholder="What makes this bench special?"
                  rows={3} maxLength={500}
                />
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW */}
          {step === 'review' && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-gray-600 text-sm">You'll be this bench's first reviewer. Your rating counts!</p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-5">
                <p className="text-sm font-semibold text-gray-700 text-center mb-4">Overall Rating <span className="text-red-500">*</span></p>
                <StarRating
                  value={overallRating}
                  onChange={setOverallRating}
                  hovered={hoveredRating}
                  onHover={setHoveredRating}
                  onLeave={() => setHoveredRating(0)}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Write a review <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={reviewText} onChange={(e) => setReviewText(e.target.value)}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 transition resize-none text-sm"
                  placeholder="Tell others about your experience..."
                  rows={4} maxLength={1000}
                />
                <p className="text-xs text-gray-400 text-right mt-1">{reviewText.length}/1000</p>
              </div>
            </div>
          )}

          {/* SUCCESS */}
          {step === 'success' && successData && (
            <div className="text-center py-4 space-y-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-1">Bench Added!</h3>
                <p className="text-gray-500 text-sm">You're helping people discover great places to get outside.</p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl border border-green-200 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900 text-sm">{successData.benchName}</p>
                    <p className="text-xs text-gray-500">Just added by you</p>
                  </div>
                </div>
                <div className="border-t border-green-200 pt-3 flex items-center justify-center gap-2">
                  <span className="text-2xl font-bold text-green-600">{successData.benchesAdded}</span>
                  <span className="text-sm text-green-700 font-medium">
                    {successData.benchesAdded === 1 ? 'bench added — your first!' : 'benches added total'}
                  </span>
                </div>
                {successData.benchesAdded === 1 && (
                  <div className="bg-white rounded-xl px-4 py-2.5 flex items-center gap-2 border border-green-200">
                    <span className="text-xl">🏆</span>
                    <div className="text-left">
                      <p className="text-xs font-bold text-gray-800">First Bench</p>
                      <p className="text-xs text-gray-500">Badge earned!</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => { onClose(); window.location.href = `/bench/${successData.benchId}`; }}
                  className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-semibold transition shadow-md"
                >
                  View This Bench
                </button>
                <button
                  type="button" onClick={resetForAnother}
                  className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition text-sm"
                >
                  Add Another Bench
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        {step !== 'success' && (
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4 flex gap-3">
            {step === 'location' ? (
              <button type="button" onClick={onClose}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition">
                Cancel
              </button>
            ) : (
              <button type="button"
                onClick={() => setStep(step === 'details' ? 'location' : 'details')}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}

            {step === 'location' && (
              <button type="button" onClick={advanceToDetails} disabled={!locationSet}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-1 ${
                  locationSet
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-sm'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 'details' && (
              <button type="button" onClick={advanceToReview}
                className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-semibold text-sm transition flex items-center justify-center gap-1 shadow-sm"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 'review' && (
              <button type="button" onClick={handleSubmit}
                disabled={overallRating === 0 || isSubmitting}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 ${
                  overallRating > 0 && !isSubmitting
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-sm'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Submit Bench'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
