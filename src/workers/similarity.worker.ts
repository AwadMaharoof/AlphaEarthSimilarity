// Message types for worker communication

type InitMessage = {
  type: 'init'
  embeddings: Float32Array
  mask: Uint8Array
  polygonMask: Uint8Array | null
  width: number
  height: number
}

type CalculateMessage = {
  type: 'calculate'
  refVector: Float32Array
  requestId: number
}

type WorkerMessage = InitMessage | CalculateMessage

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'result'; scores: Float32Array; requestId: number }
  | { type: 'error'; message: string; requestId?: number }

// Worker state
let embeddings: Float32Array | null = null
let mask: Uint8Array | null = null
let polygonMask: Uint8Array | null = null
let width = 0
let height = 0

/**
 * Calculate similarity between reference vector and all pixels using dot product.
 * Since embeddings are pre-normalized to unit length, dot product = cosine similarity.
 */
function calculateSimilarityScores(refVector: Float32Array): Float32Array {
  if (!embeddings || !mask) {
    throw new Error('Worker not initialized')
  }

  const numPixels = width * height
  const bands = 64
  const scores = new Float32Array(numPixels)

  for (let pixelIdx = 0; pixelIdx < numPixels; pixelIdx++) {
    // Skip pixels outside polygon or masked by data
    // mask uses 1 = valid, 0 = invalid
    if (mask[pixelIdx] === 0 || (polygonMask && polygonMask[pixelIdx] === 0)) {
      scores[pixelIdx] = -1 // Mark as invalid
      continue
    }

    const baseIdx = pixelIdx * bands
    let dotProduct = 0

    // Dot product (vectors are pre-normalized to unit length)
    for (let band = 0; band < bands; band++) {
      dotProduct += embeddings[baseIdx + band] * refVector[band]
    }

    scores[pixelIdx] = dotProduct
  }

  return scores
}

// Message handler
self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const message = e.data

  if (message.type === 'init') {
    // Store embeddings and masks
    embeddings = message.embeddings
    mask = message.mask
    polygonMask = message.polygonMask
    width = message.width
    height = message.height

    self.postMessage({ type: 'ready' } as WorkerResponse)
  } else if (message.type === 'calculate') {
    try {
      const scores = calculateSimilarityScores(message.refVector)

      // Transfer scores back (zero-copy)
      self.postMessage(
        {
          type: 'result',
          scores,
          requestId: message.requestId,
        } as WorkerResponse,
        { transfer: [scores.buffer] }
      )
    } catch (err) {
      self.postMessage({
        type: 'error',
        message: err instanceof Error ? err.message : 'Calculation failed',
        requestId: message.requestId,
      } as WorkerResponse)
    }
  }
}
