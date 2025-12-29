import { useState, useCallback } from 'react'
import Map from './components/Map'
import ControlPanel from './components/ControlPanel'
import { useBoundingBox } from './hooks/useBoundingBox'
import { useCOGLoader } from './hooks/useCOGLoader'
import type { AppState, BoundingBox } from './types'

function App() {
  const [appState, setAppState] = useState<AppState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const {
    boundingBox,
    setBoundingBox,
    validationError,
    isValid,
  } = useBoundingBox()

  const {
    loadEmbeddings,
    embeddingData: _embeddingData, // Will be used in Phase 3
    currentTile: _currentTile, // Will be used in Phase 3
    isLoading: _isCOGLoading, // Will be used for UI feedback
  } = useCOGLoader()

  const handleBoundingBoxChange = useCallback((box: BoundingBox | null) => {
    setBoundingBox(box)
    if (box) {
      setAppState('drawing')
    } else {
      setAppState('idle')
    }
    setErrorMessage(null)
  }, [setBoundingBox])

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

  return (
    <div className="h-full flex flex-col">
      <Map
        onBoundingBoxChange={handleBoundingBoxChange}
        boundingBox={boundingBox}
      />
      <ControlPanel
        appState={appState}
        boundingBox={boundingBox}
        isValid={isValid}
        validationError={validationError}
        errorMessage={errorMessage}
        onLoadEmbeddings={handleLoadEmbeddings}
      />
    </div>
  )
}

export default App
