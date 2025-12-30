import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import { CONFIG } from '../constants'
import { createSquareBbox } from '../utils/coordinates'
import type { BoundingBox, AreaMode, AreaSize } from '../types'

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

// Source and layer IDs for click-to-place square
const SQUARE_SOURCE_ID = 'click-square-source'
const SQUARE_FILL_LAYER_ID = 'click-square-fill'
const SQUARE_OUTLINE_LAYER_ID = 'click-square-outline'

export interface DrawControls {
  startDrawing: () => void
  clearDrawing: () => void
}

interface MapProps {
  onBoundingBoxChange: (box: BoundingBox | null) => void
  boundingBox: BoundingBox | null
  onMapClick?: (lng: number, lat: number) => void
  isClickEnabled?: boolean
  mapRef?: React.MutableRefObject<maplibregl.Map | null>
  drawControlsRef?: React.MutableRefObject<DrawControls | null>
  areaMode: AreaMode
  areaSize: AreaSize
  isAreaSelectionEnabled: boolean
}

/**
 * Convert bounding box to GeoJSON polygon
 */
function bboxToGeoJSON(bbox: BoundingBox): GeoJSON.Feature<GeoJSON.Polygon> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [bbox.minLng, bbox.minLat],
        [bbox.maxLng, bbox.minLat],
        [bbox.maxLng, bbox.maxLat],
        [bbox.minLng, bbox.maxLat],
        [bbox.minLng, bbox.minLat],
      ]],
    },
  }
}

export default function Map({
  onBoundingBoxChange,
  boundingBox,
  onMapClick,
  isClickEnabled = false,
  mapRef,
  drawControlsRef,
  areaMode,
  areaSize,
  isAreaSelectionEnabled,
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const draw = useRef<MapboxDraw | null>(null)
  const squareLayersAdded = useRef(false)

  // Use refs to always have access to latest callbacks without re-registering listeners
  const onBoundingBoxChangeRef = useRef(onBoundingBoxChange)
  const onMapClickRef = useRef(onMapClick)
  const isClickEnabledRef = useRef(isClickEnabled)
  const areaModeRef = useRef(areaMode)
  const areaSizeRef = useRef(areaSize)
  const isAreaSelectionEnabledRef = useRef(isAreaSelectionEnabled)

  // Keep refs in sync with props
  useEffect(() => {
    onBoundingBoxChangeRef.current = onBoundingBoxChange
  }, [onBoundingBoxChange])

  useEffect(() => {
    onMapClickRef.current = onMapClick
  }, [onMapClick])

  useEffect(() => {
    isClickEnabledRef.current = isClickEnabled
  }, [isClickEnabled])

  useEffect(() => {
    areaModeRef.current = areaMode
  }, [areaMode])

  useEffect(() => {
    areaSizeRef.current = areaSize
  }, [areaSize])

  useEffect(() => {
    isAreaSelectionEnabledRef.current = isAreaSelectionEnabled
  }, [isAreaSelectionEnabled])

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

  /**
   * Add GeoJSON source and layers for displaying click-to-place square
   */
  const ensureSquareLayers = useCallback(() => {
    if (!map.current || squareLayersAdded.current) return

    // Add empty source
    map.current.addSource(SQUARE_SOURCE_ID, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    })

    // Add fill layer
    map.current.addLayer({
      id: SQUARE_FILL_LAYER_ID,
      type: 'fill',
      source: SQUARE_SOURCE_ID,
      paint: {
        'fill-color': '#3bb2d0',
        'fill-opacity': 0.1,
      },
    })

    // Add outline layer
    map.current.addLayer({
      id: SQUARE_OUTLINE_LAYER_ID,
      type: 'line',
      source: SQUARE_SOURCE_ID,
      paint: {
        'line-color': '#3bb2d0',
        'line-width': 2,
      },
    })

    squareLayersAdded.current = true
  }, [])

  /**
   * Update the click-to-place square on the map
   */
  const updateSquareLayer = useCallback((bbox: BoundingBox | null) => {
    if (!map.current || !squareLayersAdded.current) return

    const source = map.current.getSource(SQUARE_SOURCE_ID) as maplibregl.GeoJSONSource
    if (!source) return

    if (bbox) {
      source.setData(bboxToGeoJSON(bbox))
    } else {
      source.setData({
        type: 'FeatureCollection',
        features: [],
      })
    }
  }, [])

  // Initialize map once on mount
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
      defaultMode: 'simple_select',
      styles: drawStyles,
    })

    // Add navigation control
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right')

    // Add draw control (initially hidden via CSS based on mode)
    map.current.addControl(draw.current as unknown as maplibregl.IControl, 'top-left')

    // Set up draw event listeners using refs to avoid stale closures
    map.current.on('draw.create', (e: { features: GeoJSON.Feature[] }) => {
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
      if (feature && areaModeRef.current === 'draw') {
        const box = extractBoundingBox(feature)
        onBoundingBoxChangeRef.current(box)
      }
    })

    map.current.on('draw.update', (e: { features: GeoJSON.Feature[] }) => {
      const feature = e.features[0]
      if (feature && areaModeRef.current === 'draw') {
        const box = extractBoundingBox(feature)
        onBoundingBoxChangeRef.current(box)
      }
    })

    map.current.on('draw.delete', () => {
      if (areaModeRef.current === 'draw') {
        onBoundingBoxChangeRef.current(null)
      }
    })

    // Set up click handler for both click-to-place and reference pixel selection
    map.current.on('click', (e: maplibregl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat

      // Handle click-to-place area selection
      if (isAreaSelectionEnabledRef.current && areaModeRef.current === 'click') {
        const bbox = createSquareBbox(lat, lng, areaSizeRef.current)
        onBoundingBoxChangeRef.current(bbox)
        return
      }

      // Handle reference pixel selection
      if (isClickEnabledRef.current && onMapClickRef.current) {
        onMapClickRef.current(lng, lat)
      }
    })

    // Add square layers when style loads
    map.current.on('style.load', () => {
      ensureSquareLayers()
    })

    // Also try adding immediately in case style already loaded
    if (map.current.isStyleLoaded()) {
      ensureSquareLayers()
    }

    // Expose map instance if ref provided
    if (mapRef) {
      mapRef.current = map.current
    }

    // Expose draw controls
    if (drawControlsRef) {
      drawControlsRef.current = {
        startDrawing: () => {
          if (draw.current) {
            draw.current.changeMode('draw_polygon')
          }
        },
        clearDrawing: () => {
          if (draw.current) {
            draw.current.deleteAll()
            onBoundingBoxChangeRef.current(null)
            // Restart drawing mode
            draw.current.changeMode('draw_polygon')
          }
        },
      }
    }

    // Hide the external draw controls - we control drawing from the wizard
    const hideDrawControls = () => {
      const drawControls = document.querySelector('.mapboxgl-ctrl-group.mapboxgl-ctrl') as HTMLElement
      if (drawControls) {
        drawControls.style.display = 'none'
      }
    }
    hideDrawControls()
    // Also hide after a short delay in case they appear later
    setTimeout(hideDrawControls, 100)

    return () => {
      if (mapRef) {
        mapRef.current = null
      }
      if (drawControlsRef) {
        drawControlsRef.current = null
      }
      map.current?.remove()
      map.current = null
      draw.current = null
      squareLayersAdded.current = false
    }
  }, [extractBoundingBox, mapRef, drawControlsRef, ensureSquareLayers])

  // Update square layer when boundingBox changes (for click mode)
  useEffect(() => {
    if (areaMode === 'click') {
      updateSquareLayer(boundingBox)
    }
  }, [boundingBox, areaMode, updateSquareLayer])

  // Handle mode switching
  useEffect(() => {
    if (areaMode === 'click' && draw.current) {
      draw.current.deleteAll()
    }
    if (areaMode === 'draw') {
      updateSquareLayer(null)
      // Auto-start drawing when switching to draw mode
      if (draw.current && isAreaSelectionEnabled) {
        draw.current.changeMode('draw_polygon')
      }
    }
  }, [areaMode, updateSquareLayer, isAreaSelectionEnabled])


  // Update cursor based on state
  useEffect(() => {
    if (!map.current) return

    if (isClickEnabled) {
      map.current.getCanvas().style.cursor = 'crosshair'
    } else if (isAreaSelectionEnabled && areaMode === 'click') {
      map.current.getCanvas().style.cursor = 'crosshair'
    } else {
      map.current.getCanvas().style.cursor = ''
    }
  }, [isClickEnabled, isAreaSelectionEnabled, areaMode])

  return (
    <div
      ref={mapContainer}
      className="flex-1 w-full"
    />
  )
}
