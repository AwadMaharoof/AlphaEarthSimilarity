import { useState, useCallback, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import Map, { DrawControls } from './components/Map'
import WizardPanel from './components/WizardPanel'
import ReferenceMarker from './components/ReferenceMarker'
import ResultsOverlay from './components/ResultsOverlay'
import { useBoundingBox } from './hooks/useBoundingBox'
import { useCOGLoader } from './hooks/useCOGLoader'
import { useSimilarity } from './hooks/useSimilarity'
import { useDebounce } from './hooks/useDebounce'
import { useWizard } from './hooks/useWizard'
import type { BoundingBox } from './types'

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
  } = useSimilarity()

  // Handle area selection (both click-to-place and draw modes)
  const handleBoundingBoxChange = useCallback((box: BoundingBox | null) => {
    setBoundingBox(box)
    clearError()

    if (box && wizardState.step === 1) {
      // Auto-advance to step 2 when area is selected
      areaSelected()
    }
  }, [setBoundingBox, clearError, wizardState.step, areaSelected])

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
    }
    back()
  }, [wizardState.step, clearReference, back])

  // Handle reset (start over)
  const handleReset = useCallback(() => {
    setBoundingBox(null)
    clearReference()
    clearEmbeddings()
    reset()
  }, [setBoundingBox, clearReference, clearEmbeddings, reset])

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
      />
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
    </div>
  )
}

export default App
