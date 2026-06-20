import { X } from 'lucide-react';

interface ImageLightboxProps {
  imageUrl: string;
  imageAlt?: string;
  onClose: () => void;
}

export default function ImageLightbox({ imageUrl, imageAlt = 'Image', onClose }: ImageLightboxProps) {
  return (
    <div
      className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
        aria-label="Close"
      >
        <X className="w-8 h-8" />
      </button>
      <img
        src={imageUrl}
        alt={imageAlt}
        className="max-w-full max-h-full object-contain rounded-lg"
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}
