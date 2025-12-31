import { useState, useCallback, useRef, useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import Map, { DrawControls } from './components/Map'
import WizardPanel from './components/WizardPanel'
import InfoWidget from './components/InfoWidget'
import ReferenceMarker from './components/ReferenceMarker'
import ResultsOverlay from './components/ResultsOverlay'
import HoverTooltip from './components/HoverTooltip'
import { useBoundingBox } from './hooks/useBoundingBox'
import { useCOGLoader } from './hooks/useCOGLoader'
import { useSimilarity } from './hooks/useSimilarity'
import { useDebounce } from './hooks/useDebounce'
import { useWizard } from './hooks/useWizard'
import type { BoundingBox, HoverInfo } from './types'

function App() {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const drawControlsRef = useRef<DrawControls | null>(null)

  // Wizard state
  const {
    state: wizardState,
    setMode,
    setSize,
    areaSelected,
    loadingStarted,
    dataLoaded,
    referenceSelected,
    setError,
    clearError,
    back,
    reset,
  } = useWizard()

  // Visualization settings
  const [threshold, setThreshold] = useState(0.7)
  const [opacity, setOpacity] = useState(0.8)
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null)

  // Debounce threshold to avoid excessive re-renders during slider drag
  const debouncedThreshold = useDebounce(threshold, 50)

  const {
    boundingBox,
    setBoundingBox,
    validationError,
  } = useBoundingBox()

  const {
    loadEmbeddings,
    embeddingData,
    currentTile,
    loadingProgress,
    isLoading,
    clearEmbeddings,
  } = useCOGLoader()

  const {
    referencePixel,
    similarityResult,
    selectReferencePixel,
    clearReference,
    initWorker,
  } = useSimilarity()

  // Initialize worker when embeddings are loaded
  useEffect(() => {
    if (embeddingData) {
      initWorker(embeddingData)
    }
  }, [embeddingData, initWorker])

  // Handle area selection (both click-to-place and draw modes)
  const handleBoundingBoxChange = useCallback((box: BoundingBox | null) => {
    setBoundingBox(box)
    clearError()

    if (box && wizardState.step === 1) {
      // Auto-advance to step 2 when area is selected
      areaSelected()
      // Lock the drawn polygon so it can't be edited
      if (wizardState.areaMode === 'draw' && drawControlsRef.current) {
        drawControlsRef.current.lockDrawing()
      }
    }
  }, [setBoundingBox, clearError, wizardState.step, wizardState.areaMode, areaSelected])

  // Handle loading embeddings
  const handleLoadEmbeddings = useCallback(async () => {
    if (!boundingBox) return

    loadingStarted()

    try {
      await loadEmbeddings(boundingBox)
      dataLoaded()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load embeddings')
    }
  }, [boundingBox, loadEmbeddings, loadingStarted, dataLoaded, setError])

  // Handle reference pixel selection
  const handleMapClick = useCallback((lng: number, lat: number) => {
    if (!embeddingData || !currentTile || wizardState.step !== 3) return

    const result = selectReferencePixel(lng, lat, embeddingData, currentTile)

    if (result.success) {
      referenceSelected()
    } else {
      setError(result.error || 'Failed to select reference pixel')
    }
  }, [embeddingData, currentTile, wizardState.step, selectReferencePixel, referenceSelected, setError])

  // Handle back button
  const handleBack = useCallback(() => {
    if (wizardState.step === 4) {
      // Go back to step 3 (select new reference)
      clearReference()
    } else if (wizardState.step === 2) {
      // Go back to step 1 (area selection) - clear the bounding box
      setBoundingBox(null)
    }
    back()
  }, [wizardState.step, clearReference, setBoundingBox, back])

  // Handle reset (start over)
  const handleReset = useCallback(() => {
    setBoundingBox(null)
    clearReference()
    clearEmbeddings()
    reset()
  }, [setBoundingBox, clearReference, clearEmbeddings, reset])

  // Handle hover over similarity heatmap
  const handleHover = useCallback((info: HoverInfo | null) => {
    setHoverInfo(info)
  }, [])

  // Determine click states
  const isAreaSelectionEnabled = wizardState.step === 1
  const isReferenceSelectionEnabled = wizardState.step === 3 && embeddingData !== null

  return (
    <div className="h-full flex flex-col">
      <Map
        onBoundingBoxChange={handleBoundingBoxChange}
        boundingBox={boundingBox}
        onMapClick={handleMapClick}
        isClickEnabled={isReferenceSelectionEnabled}
        mapRef={mapRef}
        drawControlsRef={drawControlsRef}
        areaMode={wizardState.areaMode}
        areaSize={wizardState.areaSize}
        isAreaSelectionEnabled={isAreaSelectionEnabled}
      />
      <ReferenceMarker
        map={mapRef.current}
        referencePixel={referencePixel}
      />
      <ResultsOverlay
        map={mapRef.current}
        similarityResult={similarityResult}
        threshold={debouncedThreshold}
        opacity={opacity}
        onHover={handleHover}
      />
      <HoverTooltip hoverInfo={hoverInfo} />
      <WizardPanel
        wizard={wizardState}
        onSetMode={setMode}
        onSetSize={setSize}
        onBack={handleBack}
        onReset={handleReset}
        boundingBox={boundingBox}
        validationError={validationError}
        onLoadEmbeddings={handleLoadEmbeddings}
        loadingProgress={loadingProgress}
        isLoading={isLoading}
        referencePixel={referencePixel}
        similarityResult={similarityResult}
        threshold={threshold}
        onThresholdChange={setThreshold}
        opacity={opacity}
        onOpacityChange={setOpacity}
        drawControls={drawControlsRef.current}
      />
      <InfoWidget />
      {/* GitHub link */}
      <a
        href="https://github.com/AwadMaharoof/AlphaEarthSimilarity"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-2.5 hover:bg-gray-50 transition-colors z-10"
        aria-label="View on GitHub"
      >
        <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
          <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
        </svg>
      </a>
    </div>
  )
}

export default App
