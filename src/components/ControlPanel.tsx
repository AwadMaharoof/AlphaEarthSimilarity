import type { AppState, BoundingBox } from '../types'

interface ControlPanelProps {
  appState: AppState
  boundingBox: BoundingBox | null
  isValid: boolean
  validationError: string | null
  errorMessage: string | null
  onLoadEmbeddings: () => void
}

const stateLabels: Record<AppState, string> = {
  idle: 'Draw a bounding box to get started',
  drawing: 'Bounding box selected',
  loading: 'Loading embeddings...',
  ready: 'Embeddings loaded - click on the map to select a reference pixel',
  calculating: 'Calculating similarity...',
  error: 'An error occurred',
}

export default function ControlPanel({
  appState,
  boundingBox,
  isValid,
  validationError,
  errorMessage,
  onLoadEmbeddings,
}: ControlPanelProps) {
  const isLoading = appState === 'loading' || appState === 'calculating'
  const canLoad = boundingBox && isValid && !isLoading

  return (
    <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-4 max-w-sm">
      {/* Status */}
      <div className="mb-3">
        <div className="text-sm font-medium text-gray-700">
          Status: <span className="text-gray-900">{stateLabels[appState]}</span>
        </div>
      </div>

      {/* Bounding box info */}
      {boundingBox && (
        <div className="mb-3 text-xs text-gray-600 font-mono bg-gray-50 p-2 rounded">
          <div>SW: {boundingBox.minLat.toFixed(4)}, {boundingBox.minLng.toFixed(4)}</div>
          <div>NE: {boundingBox.maxLat.toFixed(4)}, {boundingBox.maxLng.toFixed(4)}</div>
        </div>
      )}

      {/* Validation error */}
      {validationError && (
        <div className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded">
          {validationError}
        </div>
      )}

      {/* General error */}
      {errorMessage && (
        <div className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded">
          {errorMessage}
        </div>
      )}

      {/* Load button */}
      <button
        onClick={onLoadEmbeddings}
        disabled={!canLoad}
        className={`w-full py-2 px-4 rounded font-medium transition-colors ${
          canLoad
            ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
        }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading...
          </span>
        ) : (
          'Load Embeddings'
        )}
      </button>
    </div>
  )
}
