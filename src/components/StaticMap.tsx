import { useState } from 'react';
import { MapPin } from 'lucide-react';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const MAP_STYLES = [
  'feature:poi|element:all|visibility:off',
  'feature:transit|element:all|visibility:off',
  'feature:road|element:labels.icon|visibility:off',
  'feature:landscape.man_made|element:all|saturation:-40',
  'feature:water|element:geometry|color:0xb3d9f2',
  'feature:road.highway|element:geometry|color:0xffd580',
];

interface StaticMapProps {
  lat: number;
  lng: number;
  width?: number;
  height?: number;
  zoom?: number;
  className?: string;
  onClick?: () => void;
}

function buildUrl(lat: number, lng: number, w: number, h: number, zoom: number, scale: 1 | 2): string {
  const parts = [
    `center=${lat},${lng}`,
    `zoom=${zoom}`,
    `size=${w}x${h}`,
    `scale=${scale}`,
    `maptype=roadmap`,
    `markers=color:0x15803d|${lat},${lng}`,
    ...MAP_STYLES.map(s => `style=${s}`),
    `key=${API_KEY}`,
  ];
  return `https://maps.googleapis.com/maps/api/staticmap?${parts.join('&')}`;
}

export default function StaticMap({ lat, lng, width = 400, height = 160, zoom = 16, className = '', onClick }: StaticMapProps) {
  const [failed, setFailed] = useState(false);

  if (!API_KEY || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 ${className}`}
        onClick={onClick}
      >
        <MapPin className="w-6 h-6 text-green-400 opacity-60" />
      </div>
    );
  }

  const src = buildUrl(lat, lng, width, height, zoom, 1);
  const src2x = buildUrl(lat, lng, width, height, zoom, 2);

  return (
    <img
      src={src}
      srcSet={`${src} 1x, ${src2x} 2x`}
      width={width}
      height={height}
      alt="Map showing bench location"
      loading="lazy"
      decoding="async"
      draggable={false}
      className={className}
      onClick={onClick}
      onError={() => setFailed(true)}
    />
  );
}
