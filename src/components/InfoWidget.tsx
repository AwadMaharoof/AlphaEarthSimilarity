import { useState } from 'react'

export default function InfoWidget() {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div className="absolute top-4 right-4 max-w-xs z-10">
      {isOpen ? (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              AlphaEarth Similarity Search
            </h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Collapse info"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-4 text-sm text-gray-600 space-y-2">
            <p>
              Find visually similar features in satellite imagery using
              AI-powered embeddings from Google's AlphaEarth dataset.
            </p>
            <p>
              Select an area, load embeddings, then click any pixel to
              see a similarity heatmap across the region.
            </p>
            <p className="text-xs text-gray-500 pt-1">
              All computation runs in your browser — no data leaves your device.
            </p>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-white rounded-lg shadow-lg p-3 hover:bg-gray-50 transition-colors"
          aria-label="Show info"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      )}
    </div>
  )
}
