/**
 * StreetViewImage — Renders a Google Street View Static API image for a given address.
 *
 * Falls back to a placeholder when no street view coverage is available.
 */
import { useState } from 'react';
import { Building2 } from 'lucide-react';

interface StreetViewImageProps {
  address: string;
  width?: number;
  height?: number;
  className?: string;
  /** If true, hides completely when no image available instead of showing placeholder */
  hideOnError?: boolean;
}

export function StreetViewImage({
  address,
  width = 800,
  height = 400,
  className,
  hideOnError = false,
}: StreetViewImageProps) {
  const [failed, setFailed] = useState(false);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!apiKey || !address) {
    if (hideOnError) return null;
    return (
      <div className={`flex items-center justify-center bg-accent ${className ?? ''}`}>
        <Building2 className="w-10 h-10 text-muted-foreground" />
      </div>
    );
  }

  if (failed) {
    if (hideOnError) return null;
    return (
      <div className={`flex items-center justify-center bg-accent ${className ?? ''}`}>
        <div className="text-center">
          <Building2 className="w-10 h-10 mx-auto mb-1 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">No Street View</p>
        </div>
      </div>
    );
  }

  const src = `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&location=${encodeURIComponent(address)}&key=${apiKey}&fov=90&pitch=5`;

  return (
    <img
      src={src}
      alt={`Street view of ${address}`}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
