interface MMRSliderProps {
  lambda: number;
  onChange: (lambda: number) => void;
}

export function MMRSlider({ lambda, onChange }: MMRSliderProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="eyebrow text-text-faint">Relevance ↔ Diversity (λ)</span>
        <span className="tabular text-sm font-medium text-marquee">{lambda.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={lambda}
        onChange={(e) => onChange(Number(e.target.value))}
        className="reel-slider w-full"
        aria-label="MMR lambda: trade off relevance against diversity"
      />
      <div className="flex justify-between text-xs text-text-faint">
        <span>More diverse</span>
        <span>More relevant</span>
      </div>
      <p className="text-xs text-text-faint">
        Re-ranks instantly, no model call, just the live MMR loop over already-scored
        candidates. λ=0.50 is the sweet spot found in the original notebook sweep.
      </p>
    </div>
  );
}
