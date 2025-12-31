import type { HoverInfo } from '../types';

interface HoverTooltipProps {
  hoverInfo: HoverInfo | null;
}

export default function HoverTooltip({ hoverInfo }: HoverTooltipProps) {
  // Hide tooltip for null or masked pixels (score < 0)
  if (!hoverInfo || hoverInfo.score < 0) {
    return null;
  }

  return (
    <div
      className="fixed pointer-events-none bg-white rounded-lg shadow-lg px-3 py-2 text-sm font-mono z-50"
      style={{
        left: hoverInfo.x + 12,
        top: hoverInfo.y + 12,
      }}
    >
      <span className="text-gray-600">Similarity score: </span>
      <span className="text-gray-900 font-semibold">
        {hoverInfo.score.toFixed(4)}
      </span>
    </div>
  );
}
