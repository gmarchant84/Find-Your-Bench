import { useState, useRef } from 'react';
import { X, Save, Camera, Upload, Loader2 } from 'lucide-react';
import { supabase, friendlyError } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface Bench {
  id: string;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  tags: string[] | null;
  photos: string[] | null;
}

interface EditBenchModalProps {
  bench: Bench;
  onClose: () => void;
  onSaved: (updated: Partial<Bench>) => void;
}

const AVAILABLE_TAGS = [
  { id: 'scenic', label: 'Scenic View' },
  { id: 'quiet', label: 'Quiet' },
  { id: 'sunny', label: 'Sunny' },
  { id: 'shady', label: 'Shady' },
  { id: 'lunch', label: 'Good for Lunch' },
  { id: 'people-watching', label: 'People Watching' },
];

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

export default function EditBenchModal({ bench, onClose, onSaved }: EditBenchModalProps) {
  const { session } = useAuth();
  const [name, setName] = useState(bench.name);
  const [description, setDescription] = useState(bench.description || '');
  const [latitude, setLatitude] = useState(bench.latitude.toString());
  const [longitude, setLongitude] = useState(bench.longitude.toString());
  const [tags, setTags] = useState<string[]>(bench.tags || []);
  const [photoUrls, setPhotoUrls] = useState<string[]>(
    (bench.photos || []).filter((p): p is string => typeof p === 'string' && p.startsWith('https://'))
  );
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const toggleTag = (id: string) =>
    setTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);

  const removePhoto = (idx: number) =>
    setPhotoUrls(prev => prev.filter((_, i) => i !== idx));

  const handlePhotoFile = async (file: File) => {
    if (!session?.user) { setError('You must be signed in to upload photos.'); return; }
    if (!ALLOWED_MIME.includes(file.type)) { setError('Only JPEG, PNG, and WEBP images are allowed.'); return; }
    if (file.size > MAX_FILE_BYTES) { setError('Image must be under 10 MB.'); return; }

    setError('');
    setUploadingPhoto(true);
    try {
      const compressed = await compressImage(file);
      const path = `${session.user.id}/${bench.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const { data: storageData, error: storageError } = await supabase.storage
        .from('bench-photos')
        .upload(path, compressed, { contentType: 'image/jpeg', upsert: false });
      if (storageError) throw storageError;
      const { data: urlData } = supabase.storage.from('bench-photos').getPublicUrl(storageData.path);
      setPhotoUrls(prev => [...prev, urlData.publicUrl]);
    } catch (err: any) {
      setError(friendlyError(err, 'Photo upload failed. Please try again.'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handlePhotoFile(file);
    e.target.value = '';
  };

  const handleSave = async () => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (!name.trim()) { setError('Name is required'); return; }
    if (isNaN(lat) || isNaN(lng)) { setError('Coordinates must be valid numbers'); return; }
    if (lat < -90 || lat > 90) { setError('Latitude must be between -90 and 90'); return; }
    if (lng < -180 || lng > 180) { setError('Longitude must be between -180 and 180'); return; }

    setError('');
    setLoading(true);

    const updates = {
      name: name.trim(),
      description: description.trim() || null,
      latitude: lat,
      longitude: lng,
      tags,
      photos: photoUrls,
    };

    const { error: updateError } = await supabase
      .from('benches')
      .update(updates)
      .eq('id', bench.id);

    setLoading(false);

    if (updateError) {
      setError(friendlyError(updateError, 'Unable to save changes. Please try again.'));
      return;
    }

    onSaved(updates);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between z-10">
          <h2 className="text-base font-bold text-gray-900">Edit Bench</h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-full transition">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Name</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)} maxLength={120}
              className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500 transition"
              placeholder="Bench name"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Description</label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)} rows={3} maxLength={1000}
              className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500 transition resize-none"
              placeholder="What makes this bench special?"
            />
          </div>

          {/* Coordinates */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Coordinates</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number" step="any" value={latitude} onChange={e => setLatitude(e.target.value)}
                className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500 transition"
                placeholder="Latitude"
              />
              <input
                type="number" step="any" value={longitude} onChange={e => setLongitude(e.target.value)}
                className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500 transition"
                placeholder="Longitude"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Tags</label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TAGS.map(tag => (
                <button
                  key={tag.id} type="button" onClick={() => toggleTag(tag.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                    tags.includes(tag.id)
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-green-400'
                  }`}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          {/* Photos — storage upload only */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Photos</label>
            <div className="space-y-2 mb-3">
              {photoUrls.map((url, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                  <img src={url} alt="" className="w-10 h-10 object-cover rounded flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <span className="flex-1 text-xs text-gray-600 truncate">{url}</span>
                  <button
                    type="button" onClick={() => removePhoto(i)}
                    className="w-7 h-7 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-full transition flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button" onClick={() => cameraInputRef.current?.click()} disabled={uploadingPhoto}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-300 hover:border-green-500 rounded-xl text-xs text-gray-600 hover:text-green-700 transition bg-gray-50 hover:bg-green-50 disabled:opacity-50"
              >
                {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                Camera
              </button>
              <button
                type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-300 hover:border-green-500 rounded-xl text-xs text-gray-600 hover:text-green-700 transition bg-gray-50 hover:bg-green-50 disabled:opacity-50"
              >
                {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Upload
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">JPEG, PNG or WEBP · max 10 MB</p>
            <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={handleFileInput} />
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileInput} />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition"
            >
              Cancel
            </button>
            <button
              type="button" onClick={handleSave} disabled={loading || uploadingPhoto}
              className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
