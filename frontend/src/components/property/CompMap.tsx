import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GoogleMap, Marker, InfoWindow, useLoadScript } from '@react-google-maps/api';
import { MapPin } from 'lucide-react';
import type { RentCompItem, BOVPricingTier } from '../../types/property';
import { fmtCapRate } from '../../utils/formatUtils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompMapProps {
  address: string;
  propertyName: string;
  totalUnits?: number;
  rentComps?: RentCompItem[];
  salesComps?: BOVPricingTier[];
}

interface CompMapPin {
  id: string;
  type: 'subject' | 'rent' | 'sales';
  position: { lat: number; lng: number };
  name: string;
  address?: string;
  details: {
    totalUnits?: number | null;
    units?: number | null;
    avgRent?: number | null;
    rentPerSF?: number | null;
    salePrice?: number | null;
    pricePerUnit?: number | null;
    capRate?: number | null;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LIBRARIES: ('places')[] = ['places'];

const darkMapStyles: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8B8B9E" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#2d2d44" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2d2d44" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1a1a2e" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f0f23" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1e1e35" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#1e1e35" }] },
];

const containerStyle = {
  width: '100%',
  height: '400px',
};

const PIN_COLORS = {
  subject: '#8B5CF6',
  rent: '#3B82F6',
  sales: '#10B981',
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatCurrency = (value: number | null | undefined): string => {
  if (value == null) return '—';
  return `$${value.toLocaleString()}`;
};

const createMarkerIcon = (color: string) => ({
  url: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="${color}"/>
      <circle cx="16" cy="16" r="6" fill="white"/>
    </svg>
  `)}`,
  scaledSize: new google.maps.Size(32, 40),
  anchor: new google.maps.Point(16, 40),
});

/**
 * Extract a rough city/state suffix from a full street address.
 * E.g. "123 Main St, Atlanta, GA 30301" → ", Atlanta, GA"
 */
const extractCityState = (fullAddress: string): string => {
  const parts = fullAddress.split(',').map(p => p.trim());
  if (parts.length >= 3) {
    // Take the last two meaningful parts (city, state+zip)
    return `, ${parts.slice(1).join(', ')}`;
  }
  if (parts.length === 2) {
    return `, ${parts[1]}`;
  }
  return '';
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CompMap: React.FC<CompMapProps> = ({
  address,
  propertyName,
  totalUnits,
  rentComps = [],
  salesComps = [],
}) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || '',
    version: '3.55',
    libraries: LIBRARIES,
  });

  const [subjectCoords, setSubjectCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [subjectFailed, setSubjectFailed] = useState(false);
  const [compCoords, setCompCoords] = useState<Map<string, { lat: number; lng: number }>>(new Map());
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  // Geocoding cache – persists across re-renders, avoids redundant API calls
  const geocodeCache = useRef<Map<string, { lat: number; lng: number } | null>>(new Map());

  // Track which locations we've already started processing (to avoid duplicates)
  const processingLocations = useRef<Set<string>>(new Set());

  /**
   * Geocode a single address string with caching (for subject property only).
   * Returns null if geocoding fails.
   */
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

  /**
   * Geocode using Places API findPlaceFromQuery (for rent comps).
   * Returns null if geocoding fails.
   */
  const geocodePlacesAPI = useCallback(
    (query: string, mapInstance: google.maps.Map): Promise<{ lat: number; lng: number } | null> => {
      const cached = geocodeCache.current.get(query);
      if (cached !== undefined) return Promise.resolve(cached);

      return new Promise((resolve) => {
        const service = new google.maps.places.PlacesService(mapInstance);
        service.findPlaceFromQuery(
          {
            query: query,
            fields: ['geometry', 'name', 'formatted_address'],
          },
          (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results?.[0]?.geometry?.location) {
              const location = results[0].geometry.location;
              const coords = { lat: location.lat(), lng: location.lng() };
              geocodeCache.current.set(query, coords);
              resolve(coords);
            } else {
              geocodeCache.current.set(query, null);
              resolve(null);
            }
          }
        );
      });
    },
    [],
  );

  /**
   * Calculate distance between two lat/lng points using Haversine formula.
   * Returns distance in miles.
   */
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Geocode the subject property address
  useEffect(() => {
    if (!isLoaded || !apiKey || !address) return;

    geocodeAddress(address).then((coords) => {
      if (coords) {
        setSubjectCoords(coords);
        setSubjectFailed(false);
      } else {
        setSubjectFailed(true);
      }
    });
  }, [isLoaded, apiKey, address, geocodeAddress]);

  // Geocode rent comp locations using Places API
  useEffect(() => {
    if (!isLoaded || !apiKey || !map || !subjectCoords || rentComps.length === 0) return;

    const citySuffix = extractCityState(address);

    // Find locations that haven't been processed yet
    const locationsToProcess = rentComps
      .filter((comp) => comp.location && !processingLocations.current.has(comp.location))
      .map((comp) => ({
        location: comp.location!,
        comp_name: comp.comp_name,
      }));

    if (locationsToProcess.length === 0) return;

    // Mark as processing to avoid duplicates
    locationsToProcess.forEach(({ location }) => processingLocations.current.add(location));

    // Process sequentially to avoid rate limits
    (async () => {
      for (const { location, comp_name } of locationsToProcess) {
        // Build query: prefer comp_name, fall back to location
        const searchName = comp_name || location;
        const query = `${searchName} apartments${citySuffix}`;

        const coords = await geocodePlacesAPI(query, map);

        // Validate distance from subject (< 50 miles)
        if (coords) {
          const distance = calculateDistance(
            subjectCoords.lat,
            subjectCoords.lng,
            coords.lat,
            coords.lng
          );

          if (distance <= 50) {
            // Update state progressively (pins appear one by one)
            setCompCoords((prev) => new Map(prev).set(location, coords));
          }
        }

        // Rate limiting: 100ms delay between requests
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    })();
  }, [isLoaded, apiKey, map, subjectCoords, rentComps, address, geocodePlacesAPI, calculateDistance]);

  // Geocode sales comps (from address or tier_label if available)
  useEffect(() => {
    if (!isLoaded || !apiKey || salesComps.length === 0) return;

    const citySuffix = extractCityState(address);

    // BOVPricingTier doesn't have a dedicated address field, but tier_label
    // sometimes contains a location-like name. Try geocoding those.
    const compEntries = salesComps
      .map((comp) => {
        const geocodeStr = comp.tier_label;
        return geocodeStr ? { key: `sales-${comp.pricing_tier_id}`, query: geocodeStr } : null;
      })
      .filter((e): e is { key: string; query: string } => e != null);

    if (compEntries.length === 0) return;

    Promise.all(
      compEntries.map(async ({ key, query }) => {
        let coords = await geocodeAddress(query + citySuffix);
        if (!coords) coords = await geocodeAddress(query);
        return [key, coords] as const;
      }),
    ).then((results) => {
      const newMap = new Map<string, { lat: number; lng: number }>();
      for (const [key, coords] of results) {
        if (coords) newMap.set(key, coords);
      }
      if (newMap.size > 0) {
        setCompCoords((prev) => {
          const merged = new Map(prev);
          newMap.forEach((v, k) => merged.set(k, v));
          return merged;
        });
      }
    });
  }, [isLoaded, apiKey, salesComps, address, geocodeAddress]);

  // Build map pins from all data
  const mapPins = useMemo<CompMapPin[]>(() => {
    const pins: CompMapPin[] = [];

    // Subject property
    if (subjectCoords) {
      pins.push({
        id: 'subject',
        type: 'subject',
        position: subjectCoords,
        name: propertyName,
        address,
        details: { totalUnits },
      });
    }

    // Rent comps
    (rentComps || []).forEach((comp, idx) => {
      if (!comp.location) return;
      const coords = compCoords.get(comp.location);
      if (!coords) return;

      pins.push({
        id: `rent-${idx}`,
        type: 'rent',
        position: coords,
        name: comp.comp_name || 'Unknown',
        details: {
          units: comp.num_units,
          avgRent: comp.in_place_rent,
          rentPerSF: comp.in_place_rent_psf,
        },
      });
    });

    // Sales comps
    (salesComps || []).forEach((comp) => {
      const key = `sales-${comp.pricing_tier_id}`;
      const coords = compCoords.get(key);
      if (!coords) return;

      const topCapRate = comp.cap_rates?.[0]?.cap_rate_value ?? null;

      pins.push({
        id: key,
        type: 'sales',
        position: coords,
        name: comp.tier_label || 'Sales Comp',
        details: {
          salePrice: comp.pricing,
          pricePerUnit: comp.price_per_unit,
          capRate: topCapRate,
        },
      });
    });

    return pins;
  }, [subjectCoords, compCoords, rentComps, salesComps, propertyName, address, totalUnits]);

  // Fit bounds when pins change
  useEffect(() => {
    if (!map || mapPins.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    mapPins.forEach((pin) => bounds.extend(pin.position));

    if (mapPins.length === 1) {
      map.setCenter(mapPins[0].position);
      map.setZoom(14);
    } else {
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    }
  }, [map, mapPins]);

  const onLoad = useCallback((m: google.maps.Map) => {
    setMap(m);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // ------------------------------------------------------------------
  // Render states
  // ------------------------------------------------------------------

  // No API key → placeholder
  if (!apiKey) {
    return (
      <div className="bg-card/50 border border-border/60 rounded-2xl p-8 text-center">
        <MapPin className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">
          Add a Google Maps API key to enable the interactive map
        </p>
      </div>
    );
  }

  // Script load error
  if (loadError) {
    return (
      <div className="bg-card/50 border border-border/60 rounded-2xl p-8 text-center">
        <MapPin className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Unable to load Google Maps</p>
      </div>
    );
  }

  // Loading
  if (!isLoaded) {
    return (
      <div className="bg-card/50 border border-border/60 rounded-2xl p-8 text-center">
        <MapPin className="mx-auto h-8 w-8 text-muted-foreground mb-3 animate-pulse" />
        <p className="text-muted-foreground">Loading map…</p>
      </div>
    );
  }

  // Subject geocoding failed
  if (subjectFailed && mapPins.length === 0) {
    return (
      <div className="bg-card/50 border border-border/60 rounded-2xl p-8 text-center">
        <MapPin className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Unable to load map for this address</p>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Map
  // ------------------------------------------------------------------

  const selectedPinData = selectedPin ? mapPins.find((p) => p.id === selectedPin) : null;

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
          {mapPins.map((pin) => (
            <Marker
              key={pin.id}
              position={pin.position}
              icon={createMarkerIcon(PIN_COLORS[pin.type])}
              onClick={() => setSelectedPin(pin.id)}
              title={pin.name}
            />
          ))}

          {selectedPinData && (
            <InfoWindow
              position={selectedPinData.position}
              onCloseClick={() => setSelectedPin(null)}
            >
              <div className="p-2 min-w-[200px]">
                <h3 className="font-bold text-sm mb-2 text-gray-900">
                  {selectedPinData.name}
                </h3>
                <div className="text-xs text-gray-700 space-y-1">
                  {selectedPinData.type === 'subject' && (
                    <>
                      <div className="flex items-center gap-1">
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: PIN_COLORS.subject }}
                        />
                        <span className="font-semibold">Subject Property</span>
                      </div>
                      {selectedPinData.address && (
                        <div>{selectedPinData.address}</div>
                      )}
                      {selectedPinData.details.totalUnits != null && (
                        <div>Total Units: {selectedPinData.details.totalUnits.toLocaleString()}</div>
                      )}
                    </>
                  )}

                  {selectedPinData.type === 'rent' && (
                    <>
                      <div className="flex items-center gap-1">
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: PIN_COLORS.rent }}
                        />
                        <span className="font-semibold">Rent Comp</span>
                      </div>
                      {selectedPinData.details.units != null && (
                        <div>Units: {selectedPinData.details.units.toLocaleString()}</div>
                      )}
                      {selectedPinData.details.avgRent != null && (
                        <div>Avg Rent: {formatCurrency(selectedPinData.details.avgRent)}</div>
                      )}
                      {selectedPinData.details.rentPerSF != null && (
                        <div>Rent/SF: ${selectedPinData.details.rentPerSF.toFixed(2)}</div>
                      )}
                    </>
                  )}

                  {selectedPinData.type === 'sales' && (
                    <>
                      <div className="flex items-center gap-1">
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: PIN_COLORS.sales }}
                        />
                        <span className="font-semibold">Sales Comp</span>
                      </div>
                      {selectedPinData.details.salePrice != null && (
                        <div>Sale Price: {formatCurrency(selectedPinData.details.salePrice)}</div>
                      )}
                      {selectedPinData.details.pricePerUnit != null && (
                        <div>Price/Unit: {formatCurrency(selectedPinData.details.pricePerUnit)}</div>
                      )}
                      {selectedPinData.details.capRate != null && (
                        <div>Cap Rate: {fmtCapRate(selectedPinData.details.capRate)}</div>
                      )}
                    </>
                  )}
                </div>
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
            style={{ backgroundColor: PIN_COLORS.subject }}
          />
          <span>Subject</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: PIN_COLORS.rent }}
          />
          <span>Rent Comps</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: PIN_COLORS.sales }}
          />
          <span>Sales Comps</span>
        </div>
      </div>
    </div>
  );
};
