import { useEffect, useRef, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { BitmapLayer } from '@deck.gl/layers';
import type { SimilarityResult, HoverInfo } from '../types';
import { scoresToRGBA } from '../utils/colormap';
import type { PickingInfo } from '@deck.gl/core';

interface ResultsOverlayProps {
  map: maplibregl.Map | null;
  similarityResult: SimilarityResult | null;
  threshold: number;
  opacity: number;
  onHover: (info: HoverInfo | null) => void;
}

export default function ResultsOverlay({
  map,
  similarityResult,
  threshold,
  opacity,
  onHover,
}: ResultsOverlayProps) {
  const overlayRef = useRef<MapboxOverlay | null>(null);

  // Create the RGBA image data from similarity scores
  const imageData = useMemo(() => {
    if (!similarityResult) return null;

    const { scores, width, height } = similarityResult;
    const rgba = scoresToRGBA(scores, width, height, threshold, opacity);

    return {
      data: rgba,
      width,
      height,
    };
  }, [similarityResult, threshold, opacity]);

  // Create deck.gl layer
  const layers = useMemo(() => {
    if (!imageData || !similarityResult) return [];

    const { bounds } = similarityResult;

    // Create ImageData object for BitmapLayer
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];

    const imgData = ctx.createImageData(imageData.width, imageData.height);
    imgData.data.set(imageData.data);
    ctx.putImageData(imgData, 0, 0);

    return [
      new BitmapLayer({
        id: 'similarity-heatmap',
        // Bounding box corners: [minLng, minLat] to [maxLng, maxLat]
        bounds: [bounds.minLng, bounds.minLat, bounds.maxLng, bounds.maxLat],
        image: canvas,
        // Nearest neighbor interpolation for crisp pixels
        textureParameters: {
          minFilter: 'nearest',
          magFilter: 'nearest',
        },
        pickable: true,
        onHover: (info: PickingInfo) => {
          if (!info.coordinate || !similarityResult) {
            onHover(null);
            return;
          }

          const [lng, lat] = info.coordinate;
          const { width, height, scores } = similarityResult;

          // Convert lng/lat to pixel index
          const x = Math.floor((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng) * width);
          const y = Math.floor((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat) * height);

          // Bounds check
          if (x < 0 || x >= width || y < 0 || y >= height) {
            onHover(null);
            return;
          }

          const score = scores[y * width + x];
          onHover({ x: info.x, y: info.y, score });
        },
      }),
    ];
  }, [imageData, similarityResult, onHover]);

  // Initialize the deck.gl overlay once when map is available
  useEffect(() => {
    if (!map) return;

    // Create overlay only once
    overlayRef.current = new MapboxOverlay({
      interleaved: true,
      layers: [],
    });
    map.addControl(overlayRef.current as unknown as maplibregl.IControl);

    return () => {
      if (overlayRef.current && map) {
        try {
          map.removeControl(overlayRef.current as unknown as maplibregl.IControl);
        } catch (e) {
          // Map may have been destroyed - log for debugging but don't crash
          console.debug('Failed to remove overlay control (map may be destroyed):', e);
        }
        overlayRef.current = null;
      }
    };
  }, [map]);

  // Update layers when they change
  useEffect(() => {
    if (overlayRef.current) {
      overlayRef.current.setProps({ layers });
    }
  }, [layers]);

  // This component doesn't render anything directly
  return null;
}
