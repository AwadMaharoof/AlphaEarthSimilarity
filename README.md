# AlphaEarth Similarity Search

A browser-based tool for finding visually similar features in satellite imagery using [AlphaEarth embeddings](https://arxiv.org/abs/2507.22291) — all client-side, no backend required.


## Tech Stack

- **Build**: Vite
- **UI**: React
- **Map**: MapLibre GL JS + Carto basemap
- **Drawing**: @mapbox/mapbox-gl-draw
- **COG Loading**: geotiff.js
- **Compute**: Typed Arrays (CPU)

## Data Source

Embeddings are loaded from [TGE Labs AlphaEarth dataset](https://source.coop/tge-labs/aef) on Source Cooperative:
- 64-dimensional embeddings per 10m pixel
- Cloud-Optimized GeoTIFF (COG) format
- Global coverage, 2018-2024

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## License

MIT
