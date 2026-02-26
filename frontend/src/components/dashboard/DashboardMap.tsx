/**
 * DashboardMap — Portfolio-level Google Map showing all deals as pins
 *
 * Separate from CompMap (which shows comps for a single property).
 * Pin colour is based on deal score:
 *   75+  → Green (#10B981)
 *   65-74 → Yellow (#F59E0B)
 *   <65  → Red (#EF4444)
 *   No score → Purple (#8B5CF6)
 *
 * Clicking a pin opens an InfoWindow and notifies the parent (so the
 * corresponding DealCard can highlight / scroll into view).
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GoogleMap, Marker, InfoWindow, useLoadScript } from '@react-google-maps/api';
import { MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DashboardDeal } from '@/components/dashboard/DealCard';

// ============================================================
// Types
// ============================================================

interface DashboardMapProps {
  deals: DashboardDeal[];
  selectedDealId: number | null;
  onPinClick: (dealId: number) => void;
}

interface DealPin {
  id: number;
  position: { lat: number; lng: number };
  deal: DashboardDeal;
  color: string;
}

// ============================================================
// Constants
// ============================================================

const LIBRARIES: ('places')[] = ['places'];

const darkMapStyles: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8B8B9E' }] },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#2d2d44' }],
  },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1a1a2e' }],
  },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f0f23' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1e1e35' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1e1e35' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'labels', stylers: [{ color: '#555566' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#9999aa' }] },
];

const containerStyle = { width: '100%', height: '450px' };

const SCORE_COLORS = {
  high: '#10B981',
  medium: '#F59E0B',
  low: '#EF4444',
  none: '#8B5CF6',
} as const;

// ============================================================
// Helpers
// ============================================================

const getScoreColor = (score: number | null): string => {
  if (score == null) return SCORE_COLORS.none;
  if (score >= 75) return SCORE_COLORS.high;
  if (score >= 65) return SCORE_COLORS.medium;
  return SCORE_COLORS.low;
};

const createScoreMarkerIcon = (color: string, score: number | null) => {
  const scoreText = score != null ? Math.round(score).toString() : '?';
  const fontSize = scoreText.length > 2 ? '9' : '10';

  return {
    url: `data:image/svg+xml,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
        <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="${color}"/>
        <text x="16" y="20" text-anchor="middle" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="bold" fill="white">${scoreText}</text>
      </svg>
    `)}`,
    scaledSize: new google.maps.Size(32, 40),
    anchor: new google.maps.Point(16, 40),
  };
};

const formatDealValue = (value: number | null): string => {
  if (!value) return '\u2014';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
};

// ============================================================
// Component
// ============================================================

export const DashboardMap: React.FC<DashboardMapProps> = ({
  deals,
  selectedDealId,
  onPinClick,
}) => {
  const navigate = useNavigate();
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || '',
    version: 'weekly',
    libraries: LIBRARIES,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [dealCoords, setDealCoords] = useState<Map<number, { lat: number; lng: number }>>(
    new Map(),
  );
  const [infoWindowId, setInfoWindowId] = useState<number | null>(null);
  const geocodeCache = useRef<Map<string, { lat: number; lng: number } | null>>(new Map());
  const prevSelectedRef = useRef<number | null>(null);

  // ----- Geocoding -----

  const geocodeAddress = useCallback(
    (addr: string): Promise<{ lat: number; lng: number } | null> => {
      const cached = geocodeCache.current.get(addr);
      if (cached !== undefined) return Promise.resolve(cached);

      return new Promise((resolve) => {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: addr }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            const loc = results[0].geometry.location;
            const coords = { lat: loc.lat(), lng: loc.lng() };
            geocodeCache.current.set(addr, coords);
            resolve(coords);
          } else {
            geocodeCache.current.set(addr, null);
            resolve(null);
          }
        });
      });
    },
    [],
  );

  // Use backend lat/lng when available, geocode only as fallback
  useEffect(() => {
    if (!isLoaded || !apiKey) return;

    const dealsWithAddress = deals.filter((d) => d.address);
    if (dealsWithAddress.length === 0) return;

    // Separate deals with backend coords from those needing geocoding
    const coordMap = new Map<number, { lat: number; lng: number }>();
    const needsGeocoding: typeof dealsWithAddress = [];

    for (const deal of dealsWithAddress) {
      if (deal.latitude != null && deal.longitude != null) {
        coordMap.set(deal.id, { lat: deal.latitude, lng: deal.longitude });
      } else {
        needsGeocoding.push(deal);
      }
    }

    if (needsGeocoding.length === 0) {
      setDealCoords(coordMap);
      return;
    }

    // Geocode remaining deals client-side as fallback
    Promise.all(
      needsGeocoding.map(async (deal) => {
        const coords = await geocodeAddress(deal.address);
        return { id: deal.id, coords };
      }),
    ).then((results) => {
      results.forEach(({ id, coords }) => {
        if (coords) coordMap.set(id, coords);
      });
      setDealCoords(new Map(coordMap));
    });
  }, [isLoaded, apiKey, deals, geocodeAddress]);

  // ----- Build pins -----

  const pins = useMemo<DealPin[]>(
    () =>
      deals
        .filter((d) => dealCoords.has(d.id))
        .map((d) => ({
          id: d.id,
          position: dealCoords.get(d.id)!,
          deal: d,
          color: getScoreColor(d.dealScore),
        })),
    [deals, dealCoords],
  );

  // ----- Fit bounds on initial load -----

  useEffect(() => {
    if (!map || pins.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    pins.forEach((pin) => bounds.extend(pin.position));

    if (pins.length === 1) {
      map.setCenter(pins[0].position);
      map.setZoom(14);
    } else {
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    }
  }, [map, pins]);

  // ----- Pan to selected deal when it changes -----

  useEffect(() => {
    if (!map || selectedDealId == null) return;
    // Only pan when selectedDealId actually changes (not on re-renders)
    if (prevSelectedRef.current === selectedDealId) return;
    prevSelectedRef.current = selectedDealId;

    const coords = dealCoords.get(selectedDealId);
    if (coords) {
      map.panTo(coords);
      map.setZoom(14);
      setInfoWindowId(selectedDealId);
    }
  }, [map, selectedDealId, dealCoords]);

  const onLoad = useCallback((m: google.maps.Map) => setMap(m), []);
  const onUnmount = useCallback(() => setMap(null), []);

  const handlePinClick = (dealId: number) => {
    setInfoWindowId(dealId);
    onPinClick(dealId);
  };

  // ----- Render states -----

  if (!apiKey) {
    return (
      <div
        className="bg-card/50 border border-border/60 rounded-2xl p-8 flex flex-col items-center justify-center"
        style={{ height: '450px' }}
      >
        <MapPin className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">
          Add a Google Maps API key to enable the portfolio map
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className="bg-card/50 border border-border/60 rounded-2xl p-8 flex flex-col items-center justify-center"
        style={{ height: '450px' }}
      >
        <MapPin className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Unable to load Google Maps</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className="bg-card/50 border border-border/60 rounded-2xl p-8 flex flex-col items-center justify-center"
        style={{ height: '450px' }}
      >
        <MapPin className="h-8 w-8 text-muted-foreground mb-3 animate-pulse" />
        <p className="text-muted-foreground">Loading map&hellip;</p>
      </div>
    );
  }

  const selectedPinData = infoWindowId != null ? pins.find((p) => p.id === infoWindowId) : null;

  return (
    <div>
      <div className="rounded-2xl overflow-hidden border border-border/60">
        <GoogleMap
          mapContainerStyle={containerStyle}
          options={{
            styles: darkMapStyles,
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          }}
          onLoad={onLoad}
          onUnmount={onUnmount}
        >
          {pins.map((pin) => (
            <Marker
              key={pin.id}
              position={pin.position}
              icon={createScoreMarkerIcon(pin.color, pin.deal.dealScore)}
              onClick={() => handlePinClick(pin.id)}
              title={pin.deal.name}
            />
          ))}

          {selectedPinData && (
            <InfoWindow
              position={selectedPinData.position}
              onCloseClick={() => setInfoWindowId(null)}
            >
              <div className="p-2 min-w-[200px]">
                <h3 className="font-bold text-sm mb-2 text-gray-900">
                  {selectedPinData.deal.name}
                </h3>
                <div className="text-xs text-gray-700 space-y-1">
                  {selectedPinData.deal.submarket && (
                    <div>Submarket: {selectedPinData.deal.submarket}</div>
                  )}
                  {selectedPinData.deal.units > 0 && (
                    <div>Units: {selectedPinData.deal.units.toLocaleString()}</div>
                  )}
                  <div>Deal Value: {formatDealValue(selectedPinData.deal.dealValue)}</div>
                  {selectedPinData.deal.dealScore != null && (
                    <div>Score: {Math.round(selectedPinData.deal.dealScore)}</div>
                  )}
                </div>
                <button
                  onClick={() => navigate(`/library/${selectedPinData.deal.id}`)}
                  className="mt-2 text-xs font-semibold text-purple-600 hover:text-purple-800 transition-colors"
                >
                  View Analysis &rarr;
                </button>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: SCORE_COLORS.high }}
          />
          <span>75+</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: SCORE_COLORS.medium }}
          />
          <span>65-74</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: SCORE_COLORS.low }}
          />
          <span>&lt;65</span>
        </div>
      </div>
    </div>
  );
};
