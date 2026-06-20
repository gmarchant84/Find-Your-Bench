import { useState, useRef, useEffect } from 'react';
import { X, Camera, Upload, MapPin, Navigation, AlertCircle, Loader2, Crosshair } from 'lucide-react';
import { supabase, BENCH_VIBES, VibeCategory, friendlyError } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface AddBenchModalProps {
  onClose: () => void;
  onAdd: (benchData: any) => void;
  initialLocation?: { lat: number; lng: number };
  onChangeLocation?: () => void;
}

interface NearbyBench {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distance_meters: number;
}

const BENCH_TAGS = [
  { id: 'scenic', label: 'Scenic View', icon: '🌄' },
  { id: 'quiet', label: 'Quiet Reading Spot', icon: '📚' },
  { id: 'sunny', label: 'Sunny Bench', icon: '☀️' },
  { id: 'shady', label: 'Shady Bench', icon: '🌳' },
  { id: 'lunch', label: 'Good for Lunch', icon: '🥪' },
  { id: 'people-watching', label: 'People Watching', icon: '👀' },
];

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

interface PendingPhoto {
  file: File;
  preview: string;
  category: string;
  caption: string;
}

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

export default function AddBenchModal({
  onClose,
  onAdd,
  initialLocation,
  onChangeLocation,
}: AddBenchModalProps) {
  const { session } = useAuth();
  const submittingRef = useRef(false);
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState(initialLocation?.lat.toString() || '');
  const [longitude, setLongitude] = useState(initialLocation?.lng.toString() || '');
  const [description, setDescription] = useState('');
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [vibe, setVibe] = useState<VibeCategory | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nearbyBenches, setNearbyBenches] = useState<NearbyBench[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [generatedName, setGeneratedName] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [geoError, setGeoError] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initialLocation && !latitude && !longitude) getCurrentLocation();
  }, []);

  useEffect(() => {
    if (latitude && longitude) {
      checkForDuplicates();
      generateBenchName();
    }
  }, [latitude, longitude]);

  const getCurrentLocation = () => {
    if ('geolocation' in navigator) {
      setIsGettingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude.toString());
          setLongitude(pos.coords.longitude.toString());
          setIsGettingLocation(false);
        },
        () => setIsGettingLocation(false)
      );
    }
  };

  const checkForDuplicates = async () => {
    const { data, error } = await supabase.rpc('find_nearby_benches', {
      lat_param: parseFloat(latitude),
      lng_param: parseFloat(longitude),
      radius_meters: 10
    });
    if (!error && data && data.length > 0) {
      setNearbyBenches(data);
      setShowDuplicateWarning(true);
    } else {
      setNearbyBenches([]);
      setShowDuplicateWarning(false);
    }
  };

  const generateBenchName = async () => {
    try {
      if (typeof google !== 'undefined' && google.maps?.Geocoder) {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode(
          { location: { lat: parseFloat(latitude), lng: parseFloat(longitude) } },
          (results, status) => {
            if (status === 'OK' && results?.[0]) {
              const components = results[0].address_components;
              let streetName = '';
              let neighborhoodName = '';
              let park = '';
              let locality = '';
              for (const c of components) {
                if (c.types.includes('route')) streetName = c.short_name;
                if ((c.types.includes('establishment') || c.types.includes('park')) && !park) park = c.long_name;
                if ((c.types.includes('neighborhood') || c.types.includes('sublocality_level_1')) && !neighborhoodName) neighborhoodName = c.long_name;
                if (c.types.includes('locality') && !locality) locality = c.long_name;
              }
              setLocationLabel(park || neighborhoodName || locality || '');
              setGeneratedName(
                streetName ? `Bench at ${streetName}` :
                neighborhoodName ? `Bench near ${neighborhoodName}` : 'New Bench'
              );
              setGeoError('');
            } else {
              setGeneratedName('New Bench');
            }
          }
        );
      } else {
        setGeneratedName('New Bench');
      }
    } catch {
      setGeneratedName('New Bench');
      setGeoError('Geocoding service unavailable');
    }
  };

  const handleTagToggle = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handlePhotoInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    setIsProcessingPhoto(true);
    setErrorMessage('');

    for (const file of files) {
      if (!ALLOWED_MIME.includes(file.type)) {
        setErrorMessage('Only JPEG, PNG, and WEBP images are allowed.');
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        setErrorMessage('Each image must be under 10 MB.');
        continue;
      }
      const preview = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target!.result as string);
        reader.readAsDataURL(file);
      });
      setPendingPhotos(prev => [...prev, { file, preview, category: 'bench', caption: '' }]);
    }

    setIsProcessingPhoto(false);
  };

  const removePhoto = (index: number) => {
    setPendingPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const updatePhotoCategory = (index: number, category: string) => {
    setPendingPhotos(prev => prev.map((p, i) => i === index ? { ...p, category } : p));
  };

  const updatePhotoCaption = (index: number, caption: string) => {
    setPendingPhotos(prev => prev.map((p, i) => i === index ? { ...p, caption } : p));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage('');

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (!latitude || !longitude || isNaN(lat) || isNaN(lng)) {
      setErrorMessage('Valid location coordinates are required');
      submittingRef.current = false;
      setIsSubmitting(false);
      return;
    }
    if (lat < -90 || lat > 90) { setErrorMessage('Latitude must be between -90 and 90'); submittingRef.current = false; setIsSubmitting(false); return; }
    if (lng < -180 || lng > 180) { setErrorMessage('Longitude must be between -180 and 180'); submittingRef.current = false; setIsSubmitting(false); return; }

    if (!session?.user) {
      setErrorMessage('You must be signed in to add a bench.');
      submittingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    // Upload all pending photos to storage and collect their URLs
    const uploadedPhotos: Array<{ url: string; category: string; caption: string }> = [];

    for (const pending of pendingPhotos) {
      try {
        const compressed = await compressImage(pending.file);
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const path = `${session.user.id}/${filename}`;

        const { data: storageData, error: storageError } = await supabase.storage
          .from('bench-photos')
          .upload(path, compressed, { contentType: 'image/jpeg', upsert: false });

        if (storageError) {
            submittingRef.current = false;
            setIsSubmitting(false);
            throw storageError;
          }

        const { data: urlData } = supabase.storage
          .from('bench-photos')
          .getPublicUrl(storageData.path);

        uploadedPhotos.push({ url: urlData.publicUrl, category: pending.category, caption: pending.caption });
      } catch (err: any) {
        setErrorMessage(friendlyError(err, 'Photo upload failed. Please try again.'));
        submittingRef.current = false;
        setIsSubmitting(false);
        return;
      }
    }

    const finalName = name.trim() || generatedName || 'New Bench';
    onAdd({
      name: finalName,
      latitude: lat,
      longitude: lng,
      description: description || null,
      photos: uploadedPhotos,
      tags: tags.length > 0 ? tags : [],
      vibe_category: vibe,
    });
  };

  const isFormValid = !!(latitude && longitude);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-gradient-to-r from-green-500 to-emerald-600 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Add a New Bench</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {errorMessage && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-800">{errorMessage}</p>
            </div>
          )}

          {geoError && (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-800">{geoError}</p>
            </div>
          )}

          {/* Location */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">Location *</h3>
                {isGettingLocation ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                    <p className="text-sm text-blue-700">Getting your location...</p>
                  </div>
                ) : latitude && longitude ? (
                  <div className="space-y-2">
                    <p className="text-sm text-blue-700">{locationLabel || 'Location set'}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-blue-800 mb-1">Latitude</label>
                        <input
                          type="number" step="any"
                          value={latitude}
                          onChange={(e) => setLatitude(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-blue-800 mb-1">Longitude</label>
                        <input
                          type="number" step="any"
                          value={longitude}
                          onChange={(e) => setLongitude(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button" onClick={getCurrentLocation}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium transition"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        Re-detect location
                      </button>
                      {onChangeLocation && (
                        <button
                          type="button"
                          onClick={onChangeLocation}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 rounded-lg text-xs font-medium transition"
                        >
                          <Crosshair className="w-3.5 h-3.5" />
                          Pick on map
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-blue-700">No location set — use GPS or enter coordinates manually</p>
                    <button
                      type="button" onClick={getCurrentLocation}
                      className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
                    >
                      <Navigation className="w-4 h-4" />
                      Use My Location
                    </button>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="block text-xs font-medium text-blue-800 mb-1">Latitude</label>
                        <input
                          type="number" step="any"
                          value={latitude}
                          onChange={(e) => setLatitude(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                          placeholder="e.g. 37.7749"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-blue-800 mb-1">Longitude</label>
                        <input
                          type="number" step="any"
                          value={longitude}
                          onChange={(e) => setLongitude(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                          placeholder="e.g. -122.4194"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Duplicate warning */}
          {showDuplicateWarning && nearbyBenches.length > 0 && (
            <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-orange-900 mb-2">A bench may already exist here</h3>
                  <div className="space-y-2">
                    {nearbyBenches.map((bench) => (
                      <div key={bench.id} className="bg-white rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{bench.name || 'Unnamed Bench'}</p>
                          <p className="text-sm text-gray-600">{bench.distance_meters.toFixed(1)}m away</p>
                        </div>
                        <button
                          type="button" onClick={onClose}
                          className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition"
                        >
                          Confirm This One
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-orange-700 mt-3">Or continue to add a new bench if this is different.</p>
                </div>
              </div>
            </div>
          )}

          {/* Photos */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">Photos (optional)</label>
            <div className="space-y-3">
              {pendingPhotos.length > 0 && (
                <div className="grid grid-cols-1 gap-4">
                  {pendingPhotos.map((photo, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-3 space-y-3">
                      <div className="relative group">
                        <img src={photo.preview} alt={`Photo ${index + 1}`} className="w-full h-48 object-cover rounded-lg border-2 border-gray-200" />
                        <button
                          type="button" onClick={() => removePhoto(index)}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-gray-700">Category</label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { value: 'view', label: 'View from Bench' },
                            { value: 'bench', label: 'Bench' },
                            { value: 'surroundings', label: 'Surroundings' },
                            { value: 'seasonal', label: 'Seasonal' },
                            { value: 'detail', label: 'Detail Shot' }
                          ].map(cat => (
                            <button
                              key={cat.value} type="button"
                              onClick={() => updatePhotoCategory(index, cat.value)}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                                photo.category === cat.value
                                  ? 'bg-green-500 text-white'
                                  : 'bg-white border border-gray-300 text-gray-700 hover:border-green-400'
                              }`}
                            >
                              {cat.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Caption (optional)</label>
                        <input
                          type="text" value={photo.caption}
                          onChange={(e) => updatePhotoCaption(index, e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-green-500"
                          placeholder="Describe this photo..."
                          maxLength={120}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button" onClick={() => cameraInputRef.current?.click()} disabled={isProcessingPhoto}
                  className="flex-1 py-4 border-2 border-dashed border-gray-300 hover:border-green-500 rounded-xl flex flex-col items-center gap-2 transition bg-gray-50 hover:bg-green-50 disabled:opacity-50"
                >
                  {isProcessingPhoto ? <Loader2 className="w-6 h-6 text-green-500 animate-spin" /> : <Camera className="w-6 h-6 text-gray-400" />}
                  <span className="text-xs font-medium text-gray-600">Camera</span>
                </button>
                <button
                  type="button" onClick={() => fileInputRef.current?.click()} disabled={isProcessingPhoto}
                  className="flex-1 py-4 border-2 border-dashed border-gray-300 hover:border-green-500 rounded-xl flex flex-col items-center gap-2 transition bg-gray-50 hover:bg-green-50 disabled:opacity-50"
                >
                  {isProcessingPhoto ? <Loader2 className="w-6 h-6 text-green-500 animate-spin" /> : <Upload className="w-6 h-6 text-gray-400" />}
                  <span className="text-xs font-medium text-gray-600">Upload</span>
                </button>
              </div>
              <p className="text-xs text-gray-400">JPEG, PNG or WEBP · max 10 MB · stored securely</p>

              <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple className="hidden" onChange={handlePhotoInput} />
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handlePhotoInput} />
            </div>
          </div>

          {/* Bench name */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Bench Name (optional)</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 transition"
              placeholder={generatedName || 'e.g., Sunset View Bench'}
              maxLength={120}
            />
            {generatedName && !name && (
              <p className="text-sm text-gray-500 mt-1">Auto-generated: "{generatedName}"</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Description (optional)</label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 transition resize-none"
              placeholder="Tell us about this bench... What makes it special?"
              rows={4}
              maxLength={500}
            />
          </div>

          {/* Vibe picker */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Bench Vibe <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <p className="text-xs text-gray-500 mb-3">What feeling does this bench give you?</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {BENCH_VIBES.map((v) => {
                const isSelected = vibe === v.id;
                return (
                  <button
                    key={v.id} type="button" onClick={() => setVibe(isSelected ? null : v.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl font-medium text-sm transition border-2 ${
                      isSelected ? `${v.bg} ${v.color} ${v.border} shadow-md` : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-lg leading-none">{v.emoji}</span>
                    <span className="text-xs leading-tight text-left">{v.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">Tags (optional)</label>
            <div className="flex flex-wrap gap-2">
              {BENCH_TAGS.map((tag) => (
                <button
                  key={tag.id} type="button" onClick={() => handleTagToggle(tag.id)}
                  className={`px-4 py-2.5 rounded-full font-medium text-sm transition border-2 ${
                    tags.includes(tag.id)
                      ? 'bg-green-500 text-white border-green-500 shadow-md'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-green-400'
                  }`}
                >
                  <span className="mr-1.5">{tag.icon}</span>{tag.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t-2 border-gray-100">
            <button
              type="button" onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={!isFormValid || isProcessingPhoto || isSubmitting}
              className={`flex-1 px-6 py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2 ${
                isFormValid && !isProcessingPhoto && !isSubmitting
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-md'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding Bench...
                </>
              ) : 'Add Bench'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
