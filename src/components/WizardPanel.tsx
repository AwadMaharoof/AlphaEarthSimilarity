import type { BoundingBox, ReferencePixel, SimilarityResult, LoadingProgress, WizardState, AreaMode, AreaSize } from '../types'
import type { DrawControls } from './Map'
import { STEP_TITLES } from '../hooks/useWizard'
import ThresholdSlider from './ThresholdSlider'

// Viridis gradient CSS (matches colormap.ts stops)
const VIRIDIS_GRADIENT = 'linear-gradient(to right, rgb(68, 1, 84), rgb(59, 82, 139), rgb(33, 145, 140), rgb(94, 201, 98), rgb(253, 231, 37))';

interface WizardPanelProps {
  wizard: WizardState
  onSetMode: (mode: AreaMode) => void
  onSetSize: (size: AreaSize) => void
  onBack: () => void
  onReset: () => void
  boundingBox: BoundingBox | null
  validationError: string | null
  onLoadEmbeddings: () => void
  loadingProgress: LoadingProgress | null
  isLoading: boolean
  referencePixel: ReferencePixel | null
  similarityResult: SimilarityResult | null
  threshold: number
  onThresholdChange: (value: number) => void
  binaryMask: boolean
  onBinaryMaskChange: (value: boolean) => void
  opacity: number
  onOpacityChange: (value: number) => void
  drawControls: DrawControls | null
}

const SIZE_OPTIONS: AreaSize[] = [1, 2, 4]

export default function WizardPanel({
  wizard,
  onSetMode,
  onSetSize,
  onBack,
  onReset,
  boundingBox,
  validationError,
  onLoadEmbeddings,
  loadingProgress,
  isLoading,
  referencePixel,
  similarityResult,
  threshold,
  onThresholdChange,
  binaryMask,
  onBinaryMaskChange,
  opacity,
  onOpacityChange,
  drawControls,
}: WizardPanelProps) {
  const { step, areaMode, areaSize, error } = wizard

  // Calculate similarity stats
  const similarityStats = similarityResult ? (() => {
    const validScores = Array.from(similarityResult.scores).filter(s => s >= 0)
    if (validScores.length === 0) return null
    const max = Math.max(...validScores)
    const min = Math.min(...validScores)
    const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length
    const above07 = validScores.filter(s => s >= 0.7).length
    return { max, min, avg, above07, total: validScores.length }
  })() : null

  return (
    <div className="absolute top-4 left-4 right-4 sm:right-auto sm:max-w-sm bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Step header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-gray-900">
            Step {step} of 4
          </div>
          <div className="text-sm text-gray-600">
            {STEP_TITLES[step]}
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
          <div
            className="bg-blue-600 h-1 rounded-full transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="p-4">
        {/* Error display */}
        {(error || validationError) && (
          <div className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
            {error || validationError}
          </div>
        )}

        {/* Step 1: Select Area */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {areaMode === 'click'
                ? 'Click on the map to place a square area of interest.'
                : 'Use the drawing tools to outline a custom area.'}
            </p>

            {/* Mode toggle */}
            <div>
              <div className="text-xs text-gray-500 mb-2">Selection mode</div>
              <div className="flex rounded-lg overflow-hidden border border-gray-300">
                <button
                  onClick={() => onSetMode('click')}
                  className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                    areaMode === 'click'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Click to place
                </button>
                <button
                  onClick={() => onSetMode('draw')}
                  className={`flex-1 px-3 py-2 text-sm font-medium border-l border-gray-300 transition-colors ${
                    areaMode === 'draw'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Custom draw
                </button>
              </div>
            </div>

            {/* Size selector (only for click mode) */}
            {areaMode === 'click' && (
              <div>
                <div className="text-xs text-gray-500 mb-2">Area size</div>
                <div className="flex rounded-lg overflow-hidden border border-gray-300">
                  {SIZE_OPTIONS.map((size) => (
                    <button
                      key={size}
                      onClick={() => onSetSize(size)}
                      className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                        size !== SIZE_OPTIONS[0] ? 'border-l border-gray-300' : ''
                      } ${
                        areaSize === size
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {size}km
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Clear button (only for draw mode when shape exists) */}
            {areaMode === 'draw' && boundingBox && (
              <button
                onClick={() => drawControls?.clearDrawing()}
                className="w-full py-2 px-3 text-sm font-medium bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors"
              >
                Clear & Redraw
              </button>
            )}

            {/* Bounding box info */}
            {boundingBox && (
              <div className="text-xs text-gray-600 font-mono bg-gray-50 p-2 rounded">
                <div>SW: {boundingBox.minLat.toFixed(4)}, {boundingBox.minLng.toFixed(4)}</div>
                <div>NE: {boundingBox.maxLat.toFixed(4)}, {boundingBox.maxLng.toFixed(4)}</div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Load Data */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Ready to load satellite embedding data for the selected area.
            </p>

            {/* Bounding box summary */}
            {boundingBox && (
              <div className="text-xs text-gray-600 font-mono bg-gray-50 p-2 rounded">
                <div>SW: {boundingBox.minLat.toFixed(4)}, {boundingBox.minLng.toFixed(4)}</div>
                <div>NE: {boundingBox.maxLat.toFixed(4)}, {boundingBox.maxLng.toFixed(4)}</div>
              </div>
            )}

            {/* Loading progress */}
            {loadingProgress && (
              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{loadingProgress.message}</span>
                  <span>{loadingProgress.step}/{loadingProgress.totalSteps}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${(loadingProgress.step / loadingProgress.totalSteps) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Load button */}
            <button
              onClick={onLoadEmbeddings}
              disabled={isLoading}
              className={`w-full py-2 px-4 rounded font-medium transition-colors ${
                isLoading
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
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
        )}

        {/* Step 3: Select Reference */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Click on any pixel in the selected area to find similar features.
            </p>

            <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded border border-blue-200">
              The heatmap will show how similar each pixel is to your selected reference.
            </div>
          </div>
        )}

        {/* Step 4: Explore Results */}
        {step === 4 && (
          <div className="space-y-4">
            {/* Reference pixel info */}
            {referencePixel && (
              <div className="text-xs text-gray-600 bg-green-50 p-2 rounded border border-green-200">
                <div className="font-medium text-green-800 mb-1">Reference Pixel</div>
                <div>Location: {referencePixel.lat.toFixed(5)}, {referencePixel.lng.toFixed(5)}</div>
              </div>
            )}

            {/* Similarity stats */}
            {similarityStats && (
              <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded border border-blue-200">
                <div className="font-medium text-blue-800 mb-1">Similarity Scores</div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                  <span className="text-gray-500">Range:</span>
                  <span>{similarityStats.min.toFixed(3)} – {similarityStats.max.toFixed(3)}</span>
                  <span className="text-gray-500">Average:</span>
                  <span>{similarityStats.avg.toFixed(3)}</span>
                  <span className="text-gray-500">High similarity:</span>
                  <span>{similarityStats.above07.toLocaleString()} pixels</span>
                </div>
              </div>
            )}

            {/* Color legend */}
            <div>
              <div className="text-xs text-gray-600 mb-1">Similarity</div>
              <div
                className="h-3 rounded"
                style={{ background: VIRIDIS_GRADIENT }}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-0.5">
                <span>Low</span>
                <span>High</span>
              </div>
            </div>

            {/* Threshold controls */}
            <ThresholdSlider
              threshold={threshold}
              onThresholdChange={onThresholdChange}
              binaryMask={binaryMask}
              onBinaryMaskChange={onBinaryMaskChange}
              opacity={opacity}
              onOpacityChange={onOpacityChange}
            />

            {/* Select new reference button */}
            <button
              onClick={onBack}
              className="w-full py-2 px-4 rounded font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            >
              Select New Reference
            </button>
          </div>
        )}
      </div>

      {/* Footer with back/reset buttons */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-between">
        {step > 1 && step < 4 ? (
          <button
            onClick={onBack}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            &larr; Back
          </button>
        ) : (
          <div />
        )}
        {step > 1 && (
          <button
            onClick={onReset}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Start Over
          </button>
        )}
      </div>
    </div>
  )
}
