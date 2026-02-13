import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GoogleMap, Marker, InfoWindow, useLoadScript } from '@react-google-maps/api';
import { MapPin } from 'lucide-react';
import type { RentCompItem, BOVPricingTier } from '../../types/property';
import { fmtCapRate } from '../../utils/formatUtils';

interface CompMapProps {
  address: string;
  propertyName: string;
  rentComps?: RentCompItem[];
  salesComps?: BOVPricingTier[];
}

interface MapPin {
  id: string;
  type: 'subject' | 'rent' | 'sales';
  position: { lat: number; lng: number };
  name: string;
  details: {
    units?: number | null;
    avgRent?: number | null;
    rentPerSF?: number | null;
    salePrice?: number | null;
    pricePerUnit?: number | null;
    capRate?: number | null;
  };
}

interface GeocodedLocation {
  location: string;
  coordinates: { lat: number; lng: number } | null;
}

const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#4b6878" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#283d4a" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6f7d87" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2f3948" }],
  },
];

const containerStyle = {
  width: '100%',
  height: '400px',
};

const formatCurrency = (value: number | null | undefined): string => {
  if (value == null) return '—';
  return `$${value.toLocaleString()}`;
};

export const CompMap: React.FC<CompMapProps> = ({
  address,
  propertyName,
  rentComps = [],
  salesComps: _salesComps = [],
}) => {
  void _salesComps;
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || '',
  });

  const [subjectCoords, setSubjectCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geocodedRentComps, setGeocodedRentComps] = useState<GeocodedLocation[]>([]);
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  // Geocode the subject property address
  useEffect(() => {
    if (!isLoaded || !apiKey || !address) return;

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const location = results[0].geometry.location;
        setSubjectCoords({ lat: location.lat(), lng: location.lng() });
      } else {
        console.warn('Geocoding failed for subject property:', status);
      }
    });
  }, [isLoaded, apiKey, address]);

  // Geocode rent comp locations
  useEffect(() => {
    if (!isLoaded || !apiKey || rentComps.length === 0) return;

    const geocoder = new google.maps.Geocoder();
    const locations = rentComps
      .filter((comp, idx, arr) => {
        // Only geocode unique locations
        return comp.location && arr.findIndex(c => c.location === comp.location) === idx;
      })
      .map(comp => comp.location!);

    const geocodePromises = locations.map(location =>
      new Promise<GeocodedLocation>((resolve) => {
        geocoder.geocode({ address: location }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            const loc = results[0].geometry.location;
            resolve({
              location,
              coordinates: { lat: loc.lat(), lng: loc.lng() },
            });
          } else {
            resolve({ location, coordinates: null });
          }
        });
      })
    );

    Promise.all(geocodePromises).then(setGeocodedRentComps);
  }, [isLoaded, apiKey, rentComps]);

  // Build map pins from all data
  const mapPins = useMemo<MapPin[]>(() => {
    const pins: MapPin[] = [];

    // Add subject property
    if (subjectCoords) {
      pins.push({
        id: 'subject',
        type: 'subject',
        position: subjectCoords,
        name: propertyName,
        details: {},
      });
    }

    // Add rent comps
    const locationMap = new Map(
      geocodedRentComps.map(gl => [gl.location, gl.coordinates])
    );

    rentComps.forEach((comp, idx) => {
      if (!comp.location) return;
      const coords = locationMap.get(comp.location);
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

    // Add sales comps (from BOV pricing tiers if available)
    // Note: BOV pricing tiers don't have location data, so we'll skip for now
    // This can be enhanced if location data becomes available

    return pins;
  }, [subjectCoords, geocodedRentComps, rentComps, propertyName]);

  // Fit bounds when pins are loaded
  useEffect(() => {
    if (!map || mapPins.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    mapPins.forEach(pin => bounds.extend(pin.position));
    map.fitBounds(bounds);

    // Add some padding
    const padding = { top: 50, right: 50, bottom: 50, left: 50 };
    map.fitBounds(bounds, padding);
  }, [map, mapPins]);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const getMarkerIcon = (type: 'subject' | 'rent' | 'sales'): google.maps.Symbol => {
    const colors = {
      subject: '#a855f7', // Purple
      rent: '#3b82f6',    // Blue
      sales: '#22c55e',   // Green
    };

    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: colors[type],
      fillOpacity: 0.9,
      strokeColor: '#ffffff',
      strokeWeight: 2,
      scale: 10,
    };
  };

  // Show placeholder if no API key
  if (!apiKey) {
    return (
      <div className="bg-card/30 border-border/40 border-dashed rounded-2xl p-8 text-center border">
        <MapPin className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">
          Add a Google Maps API key to enable the interactive map
        </p>
        <p className="text-xs text-muted-foreground/60 mt-2">
          Set VITE_GOOGLE_MAPS_API_KEY in your .env file
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-card/30 border-border/40 border-dashed rounded-2xl p-8 text-center border">
        <MapPin className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">
          Error loading Google Maps
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="bg-card/30 border-border/40 border-dashed rounded-2xl p-8 text-center border">
        <MapPin className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3 animate-pulse" />
        <p className="text-muted-foreground text-sm">
          Loading map...
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-border/60">
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
            icon={getMarkerIcon(pin.type)}
            onClick={() => setSelectedPin(pin.id)}
            title={pin.name}
          />
        ))}

        {selectedPin && mapPins.find(p => p.id === selectedPin) && (
          <InfoWindow
            position={mapPins.find(p => p.id === selectedPin)!.position}
            onCloseClick={() => setSelectedPin(null)}
          >
            <div className="p-2 min-w-[200px]">
              {(() => {
                const pin = mapPins.find(p => p.id === selectedPin)!;
                return (
                  <div>
                    <h3 className="font-bold text-sm mb-2 text-gray-900">
                      {pin.name}
                    </h3>
                    <div className="text-xs text-gray-700 space-y-1">
                      {pin.type === 'subject' && (
                        <div className="flex items-center gap-1">
                          <span className="inline-block w-2 h-2 rounded-full bg-purple-500"></span>
                          <span className="font-semibold">Subject Property</span>
                        </div>
                      )}
                      {pin.type === 'rent' && (
                        <>
                          <div className="flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                            <span className="font-semibold">Rent Comp</span>
                          </div>
                          {pin.details.units != null && (
                            <div>Units: {pin.details.units.toLocaleString()}</div>
                          )}
                          {pin.details.avgRent != null && (
                            <div>Avg Rent: {formatCurrency(pin.details.avgRent)}</div>
                          )}
                          {pin.details.rentPerSF != null && (
                            <div>Rent/SF: ${pin.details.rentPerSF.toFixed(2)}</div>
                          )}
                        </>
                      )}
                      {pin.type === 'sales' && (
                        <>
                          <div className="flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                            <span className="font-semibold">Sales Comp</span>
                          </div>
                          {pin.details.salePrice != null && (
                            <div>Sale Price: {formatCurrency(pin.details.salePrice)}</div>
                          )}
                          {pin.details.pricePerUnit != null && (
                            <div>Price/Unit: {formatCurrency(pin.details.pricePerUnit)}</div>
                          )}
                          {pin.details.capRate != null && (
                            <div>Cap Rate: {fmtCapRate(pin.details.capRate)}</div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
};
