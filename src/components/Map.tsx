import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import { CONFIG } from '../constants'
import type { BoundingBox } from '../types'

interface MapProps {
  onBoundingBoxChange: (box: BoundingBox | null) => void
  boundingBox: BoundingBox | null
}

export default function Map({ onBoundingBoxChange }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const draw = useRef<MapboxDraw | null>(null)

  const extractBoundingBox = useCallback((feature: GeoJSON.Feature): BoundingBox | null => {
    if (feature.geometry.type !== 'Polygon') return null

    const coords = feature.geometry.coordinates[0]
    const lngs = coords.map(c => c[0])
    const lats = coords.map(c => c[1])

    return {
      minLng: Math.min(...lngs),
      minLat: Math.min(...lats),
      maxLng: Math.max(...lngs),
      maxLat: Math.max(...lats),
    }
  }, [])

  const handleDrawCreate = useCallback((e: { features: GeoJSON.Feature[] }) => {
    // Only keep the latest drawn feature
    const allFeatures = draw.current?.getAll()
    if (allFeatures && allFeatures.features.length > 1) {
      const idsToDelete = allFeatures.features
        .slice(0, -1)
        .map(f => f.id)
        .filter((id): id is string => typeof id === 'string')
      if (idsToDelete.length > 0) {
        draw.current?.delete(idsToDelete)
      }
    }

    const feature = e.features[0]
    if (feature) {
      const box = extractBoundingBox(feature)
      onBoundingBoxChange(box)
    }
  }, [extractBoundingBox, onBoundingBoxChange])

  const handleDrawUpdate = useCallback((e: { features: GeoJSON.Feature[] }) => {
    const feature = e.features[0]
    if (feature) {
      const box = extractBoundingBox(feature)
      onBoundingBoxChange(box)
    }
  }, [extractBoundingBox, onBoundingBoxChange])

  const handleDrawDelete = useCallback(() => {
    onBoundingBoxChange(null)
  }, [onBoundingBoxChange])

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    // Initialize map
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: CONFIG.BASEMAP_URL,
      center: CONFIG.DEFAULT_CENTER,
      zoom: CONFIG.DEFAULT_ZOOM,
    })

    // Initialize draw control
    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
      defaultMode: 'draw_polygon',
    })

    // Add controls
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.current.addControl(draw.current as unknown as maplibregl.IControl, 'top-left')

    // Set up event listeners
    map.current.on('draw.create', handleDrawCreate)
    map.current.on('draw.update', handleDrawUpdate)
    map.current.on('draw.delete', handleDrawDelete)

    return () => {
      map.current?.remove()
      map.current = null
      draw.current = null
    }
  }, [handleDrawCreate, handleDrawUpdate, handleDrawDelete])

  return (
    <div
      ref={mapContainer}
      className="flex-1 w-full"
    />
  )
}
