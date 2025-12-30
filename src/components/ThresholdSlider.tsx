interface ThresholdSliderProps {
  threshold: number;
  onThresholdChange: (value: number) => void;
  opacity: number;
  onOpacityChange: (value: number) => void;
}

export default function ThresholdSlider({
  threshold,
  onThresholdChange,
  opacity,
  onOpacityChange,
}: ThresholdSliderProps) {
  return (
    <div className="space-y-3">
      {/* Threshold slider */}
      <div>
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Threshold</span>
          <span>{threshold.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={threshold}
          onChange={(e) => onThresholdChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <div className="text-xs text-gray-400 mt-0.5">
          Pixels below threshold are hidden
        </div>
      </div>

      {/* Opacity slider */}
      <div>
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Opacity</span>
          <span>{Math.round(opacity * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={opacity}
          onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>
    </div>
  );
}
