import { useState } from 'react'

export default function InfoWidget() {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div className="absolute bottom-10 right-4 max-w-sm z-10">
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
          <div className="p-4 text-sm text-gray-600 space-y-3">
            <p>
              Find visually similar features in satellite imagery using{' '}
              <a
                href="https://arxiv.org/abs/2507.22291"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-800 underline"
              >
                AlphaEarth embeddings
              </a>
              {' '}— 64-dimensional vectors that encode visual and semantic properties of 10m satellite pixels.
            </p>
            <p>
              Select an area, load embeddings from the{' '}
              <a
                href="https://source.coop/tge-labs/aef"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-800 underline"
              >
                TGE Labs dataset
              </a>
              , then click any pixel to compute{' '}
              <a
                href="https://developers.google.com/earth-engine/tutorials/community/satellite-embedding-05-similarity-search"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-800 underline"
              >
                cosine similarity
              </a>
              {' '}across the selected area.
            </p>
            <p className="text-xs text-gray-500 pt-1 border-t border-gray-100">
              All computation runs client-side in your browser. Embeddings by Google &amp; DeepMind (CC-BY 4.0).
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
