/**
 * StreetViewImage — Renders a Google Street View Static API image for a given address or lat/lng.
 *
 * When lat/lng is provided, uses the Street View Metadata API to find the nearest panorama,
 * then calculates the heading from the panorama toward the property coordinates to ensure
 * the camera faces the building facade rather than picking a random direction.
 *
 * Falls back to a placeholder when no street view coverage is available.
 */
import { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';

interface StreetViewImageProps {
  address: string;
  lat?: number | null;
  lng?: number | null;
  width?: number;
  height?: number;
  className?: string;
  /** If true, hides completely when no image available instead of showing placeholder */
  hideOnError?: boolean;
}

/** Calculate compass heading from point A to point B (in degrees 0-360) */
function calculateHeading(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const dLng = ((toLng - fromLng) * Math.PI) / 180;
  const lat1 = (fromLat * Math.PI) / 180;
  const lat2 = (toLat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const heading = (Math.atan2(y, x) * 180) / Math.PI;
  return (heading + 360) % 360;
}

export function StreetViewImage({
  address,
  lat,
  lng,
  width = 800,
  height = 400,
  className,
  hideOnError = false,
}: StreetViewImageProps) {
  const [failed, setFailed] = useState(false);
  const [src, setSrc] = useState<string | null>(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const hasCoords = lat != null && lng != null;

  useEffect(() => {
    setFailed(false);
    setSrc(null);

    if (!apiKey) return;

    if (hasCoords && lat != null && lng != null) {
      // Step 1: Hit the Street View Metadata API to find the nearest panorama
      const metadataUrl =
        `https://maps.googleapis.com/maps/api/streetview/metadata` +
        `?location=${lat},${lng}&key=${apiKey}&source=outdoor&radius=50`;

      fetch(metadataUrl)
        .then((res) => res.json())
        .then((data) => {
          if (data.status !== 'OK' || !data.location) {
            // No outdoor panorama within 50m — try 150m
            const fallbackUrl =
              `https://maps.googleapis.com/maps/api/streetview/metadata` +
              `?location=${lat},${lng}&key=${apiKey}&source=outdoor&radius=150`;
            return fetch(fallbackUrl).then((r) => r.json());
          }
          return data;
        })
        .then((data) => {
          if (data.status !== 'OK' || !data.location) {
            // Still nothing — fall back to address-based lookup
            setSrc(
              `https://maps.googleapis.com/maps/api/streetview` +
                `?size=${width}x${height}` +
                `&location=${encodeURIComponent(address)}` +
                `&key=${apiKey}` +
                `&fov=80&pitch=10&source=outdoor`,
            );
            return;
          }

          // Step 2: Calculate heading from panorama location toward property
          const panoLat = data.location.lat;
          const panoLng = data.location.lng;
          const heading = calculateHeading(panoLat, panoLng, lat!, lng!);

          setSrc(
            `https://maps.googleapis.com/maps/api/streetview` +
              `?size=${width}x${height}` +
              `&pano=${data.pano_id}` +
              `&heading=${Math.round(heading)}` +
              `&fov=80&pitch=10` +
              `&key=${apiKey}`,
          );
        })
        .catch(() => {
          // Network error — fall back to address
          setSrc(
            `https://maps.googleapis.com/maps/api/streetview` +
              `?size=${width}x${height}` +
              `&location=${encodeURIComponent(address)}` +
              `&key=${apiKey}` +
              `&fov=80&pitch=10&source=outdoor`,
          );
        });
    } else if (address) {
      // No lat/lng available — use address directly
      setSrc(
        `https://maps.googleapis.com/maps/api/streetview` +
          `?size=${width}x${height}` +
          `&location=${encodeURIComponent(address)}` +
          `&key=${apiKey}` +
          `&fov=80&pitch=10&source=outdoor`,
      );
    }
  }, [lat, lng, address, apiKey, width, height, hasCoords]);

  if (!apiKey || (!address && !hasCoords)) {
    if (hideOnError) return null;
    return (
      <div className={`flex items-center justify-center bg-accent ${className ?? ''}`}>
        <Building2 className="w-10 h-10 text-muted-foreground" />
      </div>
    );
  }

  if (failed || (!src && !hasCoords && !address)) {
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

  if (!src) {
    // Still resolving metadata — show skeleton
    return (
      <div className={`bg-accent animate-pulse ${className ?? ''}`} />
    );
  }

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
