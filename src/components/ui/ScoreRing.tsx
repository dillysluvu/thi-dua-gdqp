import type { CSSProperties } from 'react';
import { formatNum } from '../../utils';

interface ScoreRingProps {
  score: number;
  base: number;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export function ScoreRing({ score, base, size = 'md', label }: ScoreRingProps) {
  const safeBase = Number(base) || 50;
  const percent = Math.max(0, Math.min(100, (Number(score) / safeBase) * 100));
  const tone = percent >= 98 ? 'perfect' : percent >= 90 ? 'good' : percent >= 75 ? 'warn' : 'bad';
  return (
    <div
      className={`score-ring score-ring-${size} score-ring-${tone}`}
      style={{ '--ring-percent': `${percent}%` } as CSSProperties}
      aria-label={`${formatNum(score)} trên ${formatNum(base)} điểm`}
    >
      <div className="score-ring-inner">
        <strong>{formatNum(score)}</strong>
        {label ? <span>{label}</span> : null}
      </div>
    </div>
  );
}
