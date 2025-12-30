import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import { CONFIG } from '../constants'
import type { BoundingBox } from '../types'

// Custom styles for MapLibre compatibility (fixes line-dasharray issue)
const drawStyles = [
  // Polygon fill
  {
    id: 'gl-draw-polygon-fill',
    type: 'fill',
    filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
    paint: {
      'fill-color': '#3bb2d0',
      'fill-outline-color': '#3bb2d0',
      'fill-opacity': 0.1,
    },
  },
  // Polygon outline stroke (active)
  {
    id: 'gl-draw-polygon-stroke-active',
    type: 'line',
    filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#3bb2d0',
      'line-width': 2,
    },
  },
  // Polygon outline stroke (static)
  {
    id: 'gl-draw-polygon-stroke-static',
    type: 'line',
    filter: ['all', ['==', '$type', 'Polygon'], ['==', 'mode', 'static']],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#404040',
      'line-width': 2,
    },
  },
  // Line stroke (active)
  {
    id: 'gl-draw-line-active',
    type: 'line',
    filter: ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#3bb2d0',
      'line-width': 2,
    },
  },
  // Vertex points
  {
    id: 'gl-draw-polygon-and-line-vertex-active',
    type: 'circle',
    filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
    paint: {
      'circle-radius': 5,
      'circle-color': '#fff',
      'circle-stroke-color': '#3bb2d0',
      'circle-stroke-width': 2,
    },
  },
  // Midpoint vertices
  {
    id: 'gl-draw-polygon-midpoint',
    type: 'circle',
    filter: ['all', ['==', 'meta', 'midpoint'], ['==', '$type', 'Point']],
    paint: {
      'circle-radius': 3,
      'circle-color': '#3bb2d0',
    },
  },
  // Point (active)
  {
    id: 'gl-draw-point-active',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'feature'], ['!=', 'mode', 'static']],
    paint: {
      'circle-radius': 6,
      'circle-color': '#3bb2d0',
    },
  },
]

interface MapProps {
  onBoundingBoxChange: (box: BoundingBox | null) => void
  boundingBox: BoundingBox | null
  onMapClick?: (lng: number, lat: number) => void
  isClickEnabled?: boolean
  mapRef?: React.MutableRefObject<maplibregl.Map | null>
}

export default function Map({
  onBoundingBoxChange,
  onMapClick,
  isClickEnabled = false,
  mapRef,
}: MapProps) {
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

  const handleMapClick = useCallback((e: maplibregl.MapMouseEvent) => {
    if (!isClickEnabled || !onMapClick) return
    onMapClick(e.lngLat.lng, e.lngLat.lat)
  }, [isClickEnabled, onMapClick])

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    // Initialize map
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: CONFIG.BASEMAP_URL,
      center: CONFIG.DEFAULT_CENTER,
      zoom: CONFIG.DEFAULT_ZOOM,
    })

    // Initialize draw control with custom styles for MapLibre compatibility
    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
      defaultMode: 'draw_polygon',
      styles: drawStyles,
    })

    // Add controls
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.current.addControl(draw.current as unknown as maplibregl.IControl, 'top-left')

    // Set up event listeners
    map.current.on('draw.create', handleDrawCreate)
    map.current.on('draw.update', handleDrawUpdate)
    map.current.on('draw.delete', handleDrawDelete)

    // Expose map instance if ref provided
    if (mapRef) {
      mapRef.current = map.current
    }

    return () => {
      if (mapRef) {
        mapRef.current = null
      }
      map.current?.remove()
      map.current = null
      draw.current = null
    }
  }, [handleDrawCreate, handleDrawUpdate, handleDrawDelete, mapRef])

  // Handle click events separately to manage enabled/disabled state
  useEffect(() => {
    if (!map.current) return

    map.current.on('click', handleMapClick)

    // Update cursor based on click enabled state
    if (isClickEnabled) {
      map.current.getCanvas().style.cursor = 'crosshair'
    } else {
      map.current.getCanvas().style.cursor = ''
    }

    return () => {
      map.current?.off('click', handleMapClick)
    }
  }, [handleMapClick, isClickEnabled])

  return (
    <div
      ref={mapContainer}
      className="flex-1 w-full"
    />
  )
}
