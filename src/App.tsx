import { useState, useCallback } from 'react'
import Map from './components/Map'
import ControlPanel from './components/ControlPanel'
import { useBoundingBox } from './hooks/useBoundingBox'
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
      // TODO: Implement in Phase 2
      console.log('Loading embeddings for:', boundingBox)

      // Simulate loading for now
      await new Promise(resolve => setTimeout(resolve, 1000))

      setAppState('ready')
    } catch (error) {
      setAppState('error')
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load embeddings')
    }
  }, [boundingBox, isValid])

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
