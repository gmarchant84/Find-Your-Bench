import { useState, useEffect } from 'react';
import { Camera, ThumbsUp, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAchievements } from '../hooks/useAchievements';
import ImageLightbox from './ImageLightbox';

interface Photo {
  id: string;
  photo_url: string;
  caption: string;
  category: 'view' | 'bench' | 'surroundings' | 'seasonal' | 'detail';
  helpful_count: number;
  uploaded_at: string;
  user_id: string | null;
  profiles?: {
    username: string;
  };
  user_voted?: boolean;
}

interface PhotoGalleryProps {
  benchId: string;
  onPhotoClick?: (photo: Photo) => void;
}

const categoryLabels = {
  view: 'View from Bench',
  bench: 'Bench',
  surroundings: 'Surroundings',
  seasonal: 'Seasonal',
  detail: 'Detail Shot'
};

const categoryColors = {
  view: 'bg-blue-100 text-blue-800',
  bench: 'bg-green-100 text-green-800',
  surroundings: 'bg-yellow-100 text-yellow-800',
  seasonal: 'bg-purple-100 text-purple-800',
  detail: 'bg-orange-100 text-orange-800'
};

export default function PhotoGallery({ benchId, onPhotoClick }: PhotoGalleryProps) {
  useAchievements(); // keep hook active for side effects
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  useEffect(() => {
    loadPhotos();
  }, [benchId]);

  async function loadPhotos() {
    try {
      const [{ data: { user } }, { data: photosData, error }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from('bench_photos')
          .select('*, profiles:user_id (username)')
          .eq('bench_id', benchId)
          .order('is_primary', { ascending: false })
          .order('helpful_count', { ascending: false })
          .order('uploaded_at', { ascending: false }),
      ]);

      if (error || !photosData) {
        console.error('Error fetching photos:', error);
        setLoadError(true);
        setLoading(false);
        return;
      }

      if (user) {
        const { data: votes } = await supabase
          .from('photo_votes')
          .select('photo_id')
          .eq('user_id', user.id);

        const votedPhotoIds = new Set(votes?.map(v => v.photo_id) || []);
        setPhotos(photosData.map(photo => ({ ...photo, user_voted: votedPhotoIds.has(photo.id) })));
      } else {
        setPhotos(photosData);
      }
    } catch (err) {
      console.error('Error loading photos:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  async function toggleHelpful(photoId: string, currentlyVoted: boolean) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Optimistic update
    setPhotos(prev => prev.map(p => p.id === photoId
      ? { ...p, user_voted: !currentlyVoted, helpful_count: p.helpful_count + (currentlyVoted ? -1 : 1) }
      : p
    ));
    if (selectedPhoto?.id === photoId) {
      setSelectedPhoto(prev => prev ? {
        ...prev,
        user_voted: !currentlyVoted,
        helpful_count: prev.helpful_count + (currentlyVoted ? -1 : 1),
      } : prev);
    }

    if (currentlyVoted) {
      await supabase.from('photo_votes').delete().eq('photo_id', photoId).eq('user_id', user.id);
    } else {
      await supabase.from('photo_votes').insert({ photo_id: photoId, user_id: user.id });
    }
  }

  const filteredPhotos = selectedCategory
    ? photos.filter(p => p.category === selectedCategory)
    : photos;

  const categories = Array.from(new Set(photos.map(p => p.category)));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="text-center py-6 text-gray-400 text-sm">
        <Camera className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p>Couldn't load photos. Check your connection and try again.</p>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No photos yet. Be the first to add one!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === null
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Photos ({photos.length})
          </button>
          {categories.map(category => {
            const count = photos.filter(p => p.category === category).length;
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? categoryColors[category as keyof typeof categoryColors]
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {categoryLabels[category as keyof typeof categoryLabels]} ({count})
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {filteredPhotos.map((photo) => (
          <div
            key={photo.id}
            className="relative group cursor-pointer rounded-lg overflow-hidden bg-gray-100 aspect-square"
            onClick={() => {
              setSelectedPhoto(photo);
              onPhotoClick?.(photo);
            }}
          >
            <img
              src={photo.photo_url}
              alt={photo.caption || 'Bench photo'}
              className="w-full h-full object-cover object-center transition-transform group-hover:scale-105"
              loading="lazy"
              onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${categoryColors[photo.category]}`}>
                  {categoryLabels[photo.category]}
                </span>
                {photo.caption && (
                  <p className="text-xs line-clamp-1 mt-1">{photo.caption}</p>
                )}
              </div>
            </div>
            <button
              className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs backdrop-blur-sm transition-colors ${
                photo.user_voted
                  ? 'bg-green-600 text-white'
                  : 'bg-black/30 text-white hover:bg-black/50'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                toggleHelpful(photo.id, photo.user_voted || false);
              }}
            >
              <ThumbsUp className="w-3 h-3" />
              <span>{photo.helpful_count}</span>
            </button>
          </div>
        ))}
      </div>

      {selectedPhoto && (
        <ImageLightbox
          imageUrl={selectedPhoto.photo_url}
          imageAlt={selectedPhoto.caption || 'Bench photo'}
          onClose={() => setSelectedPhoto(null)}
        />
      )}

      {selectedPhoto && (
        <div className="fixed bottom-0 left-0 right-0 z-[51] p-4 pointer-events-none flex justify-center">
          <div className="bg-white rounded-xl shadow-2xl p-4 max-w-sm w-full pointer-events-auto">
            <div className="flex items-center justify-between mb-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${categoryColors[selectedPhoto.category]}`}>
                {categoryLabels[selectedPhoto.category]}
              </span>
              <button
                onClick={() => toggleHelpful(selectedPhoto.id, selectedPhoto.user_voted || false)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedPhoto.user_voted
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <ThumbsUp className="w-4 h-4" />
                <span>Helpful ({selectedPhoto.helpful_count})</span>
              </button>
            </div>
            {selectedPhoto.caption && (
              <p className="text-gray-700 mb-2 text-sm">{selectedPhoto.caption}</p>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <User className="w-4 h-4" />
              <span>Uploaded by {selectedPhoto.profiles?.username || 'Anonymous'}</span>
              <span>•</span>
              <span>{new Date(selectedPhoto.uploaded_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
