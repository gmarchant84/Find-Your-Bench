import { useState, useRef, useEffect } from 'react';
import { X, Camera, Upload, MapPin, Tag, Navigation, AlertCircle, Loader2 } from 'lucide-react';
import { supabase, friendlyError } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAchievements } from '../hooks/useAchievements';

interface AddBenchProps {
  onClose: () => void;
  onSuccess: () => void;
  initialLat?: number;
  initialLng?: number;
}

const AVAILABLE_TAGS = ['scenic', 'quiet', 'sunny', 'shady', 'people-watching'];

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
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
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

export function AddBench({ onClose, onSuccess, initialLat, initialLng }: AddBenchProps) {
  const { session } = useAuth();
  const { triggerAchievementCheck } = useAchievements();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState(initialLat?.toString() || '');
  const [longitude, setLongitude] = useState(initialLng?.toString() || '');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initialLat && !initialLng) getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    setGettingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude.toString());
          setLongitude(pos.coords.longitude.toString());
          setGettingLocation(false);
        },
        () => setGettingLocation(false)
      );
    } else {
      setGettingLocation(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleFile = (file: File) => {
    if (!ALLOWED_MIME.includes(file.type)) {
      setError('Only JPEG, PNG, and WEBP images are allowed.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('Image must be under 10 MB.');
      return;
    }
    setError('');
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;

    if (selectedTags.length === 0) {
      setError('Please select at least one category tag');
      return;
    }

    if (!description.trim()) {
      setError('Please add a description');
      return;
    }

    setError('');
    setLoading(true);

    try {
      let photoUrls: string[] = [];

      if (photoFile) {
        const compressed = await compressImage(photoFile);
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const path = `${session.user.id}/${filename}`;

        const { data: storageData, error: storageError } = await supabase.storage
          .from('bench-photos')
          .upload(path, compressed, { contentType: 'image/jpeg', upsert: false });

        if (storageError) throw storageError;

        const { data: urlData } = supabase.storage
          .from('bench-photos')
          .getPublicUrl(storageData.path);

        photoUrls = [urlData.publicUrl];
      }

      const { data, error: insertError } = await supabase
        .from('benches')
        .insert({
          name,
          original_name: name,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          description,
          tags: selectedTags,
          founding_user_id: session.user.id,
          photos: photoUrls.length > 0 ? photoUrls : null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (data && photoUrls.length > 0) {
        await supabase.from('bench_photos').insert({
          bench_id: data.id,
          user_id: session.user.id,
          photo_url: photoUrls[0],
          category: 'bench',
          is_primary: true,
        });
      }

      await triggerAchievementCheck();
      onSuccess();
    } catch (err) {
      setError(friendlyError(err, 'Failed to add bench. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen px-3 py-4 sm:py-8">
        <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden border-2 border-green-200">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-4 text-white relative">
            <button onClick={onClose} className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full p-2">
              <X size={24} />
            </button>
            <h2 className="text-xl font-bold">Add a New Bench</h2>
            <p className="text-green-100 mt-1">Become a Founding Bencher</p>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Bench Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="e.g., Sunset View Bench, Reading Corner"
                required
                maxLength={120}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-700">Location *</label>
                <button
                  type="button"
                  onClick={getCurrentLocation}
                  disabled={gettingLocation}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50"
                >
                  <Navigation size={14} />
                  {gettingLocation ? 'Getting location...' : 'Use my location'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number" step="any" value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="w-full px-3 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  placeholder="Latitude" required
                />
                <input
                  type="number" step="any" value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="w-full px-3 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  placeholder="Longitude" required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                rows={4}
                maxLength={500}
                placeholder="What makes this bench special?"
                required
              />
            </div>

            {/* Photo upload — storage only, no external URLs */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Photo (optional)</label>
              {photoPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-200">
                  <img src={photoPreview} alt="Preview" className="w-full h-40 object-cover" />
                  <button
                    type="button"
                    onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 hover:border-green-500 rounded-xl text-sm text-gray-600 hover:text-green-700 transition bg-gray-50 hover:bg-green-50"
                  >
                    <Camera size={16} /> Take Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 hover:border-green-500 rounded-xl text-sm text-gray-600 hover:text-green-700 transition bg-gray-50 hover:bg-green-50"
                  >
                    <Upload size={16} /> Upload
                  </button>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-1">JPEG, PNG or WEBP · max 10 MB</p>
              <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={handleFileInput} />
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileInput} />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Tag size={16} className="inline mr-1" />
                Category Tags * (select at least one)
              </label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_TAGS.map((tag) => (
                  <button
                    key={tag} type="button" onClick={() => toggleTag(tag)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-green-600 text-white shadow-md'
                        : 'bg-green-50 text-green-700 border-2 border-green-200 hover:border-green-400'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              {selectedTags.length > 0 && (
                <p className="text-sm text-green-600 mt-2">{selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected</p>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle size={16} className="flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button" onClick={onClose}
                className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit" disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-xl disabled:opacity-50 shadow-md"
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> Adding...</> : 'Add Bench'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
