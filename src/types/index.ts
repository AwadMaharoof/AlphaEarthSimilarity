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

export type AppState = 'idle' | 'drawing' | 'loading' | 'ready' | 'calculating' | 'error';

export type RGB = [number, number, number];
export type ColorStop = [number, RGB];
