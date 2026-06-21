import { useState, useRef, useCallback } from 'react';
import { Camera, Upload, ImagePlus, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { supabase, friendlyError } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface AddPhotoSectionProps {
  benchId: string;
  hasPhotos: boolean;
  foundingUserId?: string | null;
  onUploaded: (photoUrl: string) => void;
}

const CATEGORIES = [
  { value: 'bench', label: 'Bench' },
  { value: 'view', label: 'View from Bench' },
  { value: 'surroundings', label: 'Surroundings' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'detail', label: 'Detail Shot' },
] as const;

type Category = typeof CATEGORIES[number]['value'];

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

// Compress an image File to a target max dimension / quality using canvas
async function compressImage(file: File, maxPx = 1600, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { width, height } = img;
      const scale = Math.min(1, maxPx / Math.max(width, height));
      const w = Math.round(width * scale);
      const h = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas compression failed'));
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')); };
    img.src = objectUrl;
  });
}

export default function AddPhotoSection({ benchId, hasPhotos, foundingUserId, onUploaded }: AddPhotoSectionProps) {
  const { session } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<Category>('bench');
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!ALLOWED_MIME.includes(file.type)) {
      setErrorMsg('Only JPEG, PNG, and WEBP images are allowed.');
      setStatus('error');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setErrorMsg('Image must be under 10 MB.');
      setStatus('error');
      return;
    }
    setStatus('idle');
    setErrorMsg('');
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const clearPreview = () => {
    setPreview(null);
    setSelectedFile(null);
    setStatus('idle');
    setErrorMsg('');
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    if (!session?.user) {
      setErrorMsg('You must be signed in to upload photos.');
      setStatus('error');
      return;
    }
    setUploading(true);
    setStatus('idle');
    setErrorMsg('');

    try {
      const userId = session.user.id;
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const oneDayAgo  = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Client-side throttle pre-check (DB trigger enforces authoritatively)
      const [{ count: hourCount }, { count: dayCount }, { count: benchCount }] = await Promise.all([
        supabase.from('bench_photos').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', oneHourAgo),
        supabase.from('bench_photos').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', oneDayAgo),
        supabase.from('bench_photos').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('bench_id', benchId),
      ]);

      if ((hourCount ?? 0) >= 10) {
        setErrorMsg('Upload limit reached: maximum 10 photos per hour.');
        setStatus('error');
        return;
      }
      if ((dayCount ?? 0) >= 50) {
        setErrorMsg('Upload limit reached: maximum 50 photos per day.');
        setStatus('error');
        return;
      }
      if ((benchCount ?? 0) >= 5) {
        setErrorMsg('This bench already has 5 of your photos (maximum per bench).');
        setStatus('error');
        return;
      }

      // Compress image
      const compressed = await compressImage(selectedFile);
      const ext = 'jpg';
      const filename = `${session.user.id}/${benchId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      // Upload to storage
      const { data: storageData, error: storageError } = await supabase.storage
        .from('bench-photos')
        .upload(filename, compressed, { contentType: 'image/jpeg', upsert: false });

      if (storageError) throw storageError;

      const { data: urlData } = supabase.storage
        .from('bench-photos')
        .getPublicUrl(storageData.path);

      const photoUrl = urlData.publicUrl;

      // Insert into bench_photos table — user_id is always set (auth enforced above)
      const { error: insertError } = await supabase.from('bench_photos').insert({
        bench_id: benchId,
        user_id: session.user.id,
        photo_url: photoUrl,
        caption: caption.trim() || null,
        category,
        is_primary: !hasPhotos,
      });

      if (insertError) throw insertError;

      // Notify the founding user if someone else added a photo
      if (foundingUserId && foundingUserId !== session.user.id) {
        await supabase.from('bench_notifications').insert({
          user_id: foundingUserId,
          bench_id: benchId,
          actor_id: session.user.id,
          type: 'photo',
        });
      }

      // Append URL to benches.photos[] so the header image updates
      const { data: benchData } = await supabase
        .from('benches')
        .select('photos')
        .eq('id', benchId)
        .maybeSingle();

      const existingPhotos: string[] = benchData?.photos ?? [];
      await supabase
        .from('benches')
        .update({ photos: [...existingPhotos, photoUrl] })
        .eq('id', benchId);

      setStatus('success');
      onUploaded(photoUrl);
      setTimeout(() => {
        clearPreview();
        setCaption('');
        setCategory('bench');
        setStatus('idle');
      }, 2000);
    } catch (err: any) {
      setErrorMsg(friendlyError(err, 'Upload failed. Please try again.'));
      setStatus('error');
    } finally {
      setUploading(false);
    }
  };

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!hasPhotos && !preview) {
    return (
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`rounded-2xl border-2 border-dashed transition-all duration-200 ${
          isDragging
            ? 'border-green-500 bg-green-50 scale-[1.01]'
            : 'border-gray-200 bg-gray-50 hover:border-green-400 hover:bg-green-50/50'
        }`}
      >
        <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Camera className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-base font-semibold text-gray-700 mb-1">No photos yet</p>
          <p className="text-sm text-gray-500 mb-6">Be the first to add one!</p>

          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              <Camera className="w-4 h-4" />
              Take Photo
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl border border-gray-200 transition-colors text-sm"
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
          </div>

          {isDragging && (
            <p className="mt-4 text-sm font-medium text-green-600">Drop to add photo</p>
          )}
          {!isDragging && (
            <p className="mt-4 text-xs text-gray-400 hidden sm:block">or drag and drop an image here</p>
          )}
        </div>

        <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={handleInputChange} />
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple={false} className="hidden" onChange={handleInputChange} />
      </div>
    );
  }

  // ── Has photos — compact add button ──────────────────────────────────────
  if (hasPhotos && !preview) {
    return (
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`rounded-xl border transition-all duration-200 ${
          isDragging ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <ImagePlus className="w-4 h-4 text-green-600 flex-shrink-0" />
            <span className="font-medium">
              {isDragging ? 'Drop to add photo' : 'Add another photo'}
            </span>
            {!isDragging && <span className="text-gray-400 hidden sm:inline">· drag or tap to upload</span>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center gap-1.5 py-2 px-3 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold rounded-lg transition-colors text-xs"
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Camera</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 py-2 px-3 bg-white hover:bg-gray-100 text-gray-700 font-semibold rounded-lg border border-gray-200 transition-colors text-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload</span>
            </button>
          </div>
        </div>

        <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={handleInputChange} />
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple={false} className="hidden" onChange={handleInputChange} />
      </div>
    );
  }

  // ── Preview & confirm panel ──────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* Preview image */}
      <div className="relative">
        <img
          src={preview!}
          alt="Preview"
          className="w-full h-52 object-cover"
          loading="lazy"
        />
        {!uploading && status !== 'success' && (
          <button
            onClick={clearPreview}
            className="absolute top-2 right-2 w-8 h-8 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {status === 'success' && (
          <div className="absolute inset-0 bg-green-600/80 flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-white font-bold text-sm">Photo uploaded successfully</p>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Category picker */}
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Category</p>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition border ${
                  category === cat.value
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Caption */}
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Add a caption (optional)"
          maxLength={120}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 transition"
        />

        {/* Error */}
        {status === 'error' && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2.5 pt-1">
          <button
            onClick={clearPreview}
            disabled={uploading}
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading || status === 'success'}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold rounded-xl text-sm transition disabled:opacity-60"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload Photo
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
