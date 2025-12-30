export interface BoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface UTMCoord {
  easting: number;
  northing: number;
  zone: number;
  hemisphere: 'N' | 'S';
}

export interface PixelCoord {
  x: number;
  y: number;
}

export interface TileInfo {
  wkt: string;
  crs: string;
  url: string;
  year: string;
  utmZone: string;
  utmBounds: { minX: number; minY: number; maxX: number; maxY: number };
  lngLatBounds: BoundingBox;
}

export interface EmbeddingData {
  embeddings: Float32Array;  // W x H x 64
  width: number;
  height: number;
  bounds: BoundingBox;
  mask: boolean[];  // true = valid pixel
}

export interface ReferencePixel {
  lng: number;
  lat: number;
  pixelX: number;
  pixelY: number;
  vector: Float32Array;  // 64-dim embedding
}

export interface SimilarityResult {
  scores: Float32Array;  // W x H
  width: number;
  height: number;
  bounds: BoundingBox;
}


// Wizard types
export type WizardStep = 1 | 2 | 3 | 4;
export type AreaMode = 'click' | 'draw';
export type AreaSize = 2 | 4 | 6 | 8 | 10 | 15 | 20; // km

export interface WizardState {
  step: WizardStep;
  areaMode: AreaMode;
  areaSize: AreaSize;
  error: string | null;
}

export type WizardAction =
  | { type: 'SET_MODE'; mode: AreaMode }
  | { type: 'SET_SIZE'; size: AreaSize }
  | { type: 'AREA_SELECTED' }
  | { type: 'LOADING_STARTED' }
  | { type: 'DATA_LOADED' }
  | { type: 'REFERENCE_SELECTED' }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'BACK' }
  | { type: 'RESET' };

// Loading progress
export interface LoadingProgress {
  step: number;
  totalSteps: number;
  message: string;
}
