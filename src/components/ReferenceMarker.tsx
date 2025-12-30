import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { ReferencePixel } from '../types';

interface ReferenceMarkerProps {
  map: maplibregl.Map | null;
  referencePixel: ReferencePixel | null;
}

export default function ReferenceMarker({ map, referencePixel }: ReferenceMarkerProps) {
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    // Clean up existing marker
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    // Don't create marker if no map or reference pixel
    if (!map || !referencePixel) {
      return;
    }

    // Create marker element
    const el = document.createElement('div');
    el.className = 'reference-marker';
    el.style.width = '20px';
    el.style.height = '20px';
    el.style.borderRadius = '50%';
    el.style.backgroundColor = '#ef4444';
    el.style.border = '3px solid white';
    el.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
    el.style.cursor = 'pointer';

    // Create and add marker
    markerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([referencePixel.lng, referencePixel.lat])
      .addTo(map);

    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
  }, [map, referencePixel]);

  // This component doesn't render anything directly
  return null;
}
