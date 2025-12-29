export const CONFIG = {
  // Basemap
  BASEMAP_URL: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',

  // COG Index
  COG_INDEX_URL: 'https://data.source.coop/tge-labs/aef/v1/annual/aef_index.csv',

  // Constraints
  MAX_BOX_SIZE_KM: 5,
  EMBEDDING_BANDS: 64,

  // Default map view
  DEFAULT_CENTER: [-122.4, 37.8] as [number, number],  // San Francisco
  DEFAULT_ZOOM: 10,

  // Year filter
  TARGET_YEAR: '2024',
} as const;
