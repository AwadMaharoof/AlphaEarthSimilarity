import { useState, useCallback, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import Map from './components/Map'
import ControlPanel from './components/ControlPanel'
import ReferenceMarker from './components/ReferenceMarker'
import ResultsOverlay from './components/ResultsOverlay'
import ThresholdSlider from './components/ThresholdSlider'
import { useBoundingBox } from './hooks/useBoundingBox'
import { useCOGLoader } from './hooks/useCOGLoader'
import { useSimilarity } from './hooks/useSimilarity'
import type { AppState, BoundingBox } from './types'

function App() {
  const [appState, setAppState] = useState<AppState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  // Visualization settings
  const [threshold, setThreshold] = useState(0.7)
  const [binaryMask, setBinaryMask] = useState(false)
  const [opacity, setOpacity] = useState(0.8)

  const {
    boundingBox,
    setBoundingBox,
    validationError,
    isValid,
  } = useBoundingBox()

  const {
    loadEmbeddings,
    embeddingData,
    currentTile,
  } = useCOGLoader()

  const {
    referencePixel,
    similarityResult,
    selectReferencePixel,
    clearReference,
    isCalculating,
  } = useSimilarity()

  const handleBoundingBoxChange = useCallback((box: BoundingBox | null) => {
    setBoundingBox(box)
    clearReference() // Clear any previous reference when box changes
    if (box) {
      setAppState('drawing')
    } else {
      setAppState('idle')
    }
    setErrorMessage(null)
  }, [setBoundingBox, clearReference])

  const handleLoadEmbeddings = useCallback(async () => {
    if (!boundingBox || !isValid) return

    setAppState('loading')
    setErrorMessage(null)

    try {
      const data = await loadEmbeddings(boundingBox)
      console.log('Loaded embeddings:', {
        width: data.width,
        height: data.height,
        totalPixels: data.width * data.height,
        validPixels: data.mask.filter(Boolean).length,
      })
      setAppState('ready')
    } catch (error) {
      setAppState('error')
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load embeddings')
    }
  }, [boundingBox, isValid, loadEmbeddings])

  const handleMapClick = useCallback((lng: number, lat: number) => {
    if (!embeddingData || !currentTile) return

    setAppState('calculating')
    setErrorMessage(null)

    const result = selectReferencePixel(lng, lat, embeddingData, currentTile)

    if (result.success) {
      console.log('Similarity calculated:', {
        referenceLocation: { lng, lat },
      })
      setAppState('ready')
    } else {
      setAppState('ready') // Stay in ready state to allow retry
      setErrorMessage(result.error || 'Failed to select reference pixel')
    }
  }, [embeddingData, currentTile, selectReferencePixel])

  // Determine if click is enabled (only when embeddings are loaded)
  const isClickEnabled = appState === 'ready' && embeddingData !== null && !isCalculating

  return (
    <div className="h-full flex flex-col">
      <Map
        onBoundingBoxChange={handleBoundingBoxChange}
        boundingBox={boundingBox}
        onMapClick={handleMapClick}
        isClickEnabled={isClickEnabled}
        mapRef={mapRef}
      />
      <ReferenceMarker
        map={mapRef.current}
        referencePixel={referencePixel}
      />
      <ResultsOverlay
        map={mapRef.current}
        similarityResult={similarityResult}
        threshold={threshold}
        binaryMask={binaryMask}
        opacity={opacity}
      />
      <ControlPanel
        appState={appState}
        boundingBox={boundingBox}
        isValid={isValid}
        validationError={validationError}
        errorMessage={errorMessage}
        onLoadEmbeddings={handleLoadEmbeddings}
        referencePixel={referencePixel}
        similarityResult={similarityResult}
      />
      {/* Threshold controls - only show when similarity results are available */}
      {similarityResult && (
        <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 w-64">
          <div className="text-sm font-medium text-gray-700 mb-3">Visualization</div>
          <ThresholdSlider
            threshold={threshold}
            onThresholdChange={setThreshold}
            binaryMask={binaryMask}
            onBinaryMaskChange={setBinaryMask}
            opacity={opacity}
            onOpacityChange={setOpacity}
          />
        </div>
      )}
    </div>
  )
}

export default App
