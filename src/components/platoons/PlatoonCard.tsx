import type { CSSProperties } from 'react';
import { Building2, DoorOpen, Pencil, StickyNote } from 'lucide-react';
import type { PlatoonItem, ScoreField } from '../../lib/record';
import { formatNum } from '../../utils';
import { unitCode, unitFull } from '../../lib/units';
import { ScoreRing } from '../ui/ScoreRing';

interface PlatoonCardProps {
  item: PlatoonItem;
  baseScore: number;
  locked: boolean;
  onGrade: () => void;
  onQuickDeduct: (field: ScoreField, value: number) => void;
}

const QUICK_ACTIONS: Array<{ field: ScoreField; value: number; label: string }> = [
  { field: 'nvvs', value: -0.5, label: 'VS -0,5' },
  { field: 'leTiet', value: -0.2, label: 'LT -0,2' },
  { field: 'hocTap', value: -0.1, label: 'HT -0,1' }
];

export function PlatoonCard({ item, baseScore, locked, onGrade, onQuickDeduct }: PlatoonCardProps) {
  const hasDeduction = item.hocTap !== 0 || item.renLuyen !== 0 || item.nvvs !== 0 || item.leTiet !== 0;
  const rankClass = item.rank <= 3 ? `rank-${item.rank}` : '';

  return (
    <article className={`platoon-card ${item.totalScore < baseScore ? 'has-deduction' : ''}`}>
      <button type="button" className="platoon-card-main" onClick={onGrade} aria-label={`Chấm điểm ${unitFull('trungDoi', item.id)}`}>
        <span className="platoon-number" title={unitFull('trungDoi', item.id)}>
          {unitCode('trungDoi', item.id)}
          {item.daiDoi ? <small className="unit-company-code" title={unitFull('daiDoi', item.daiDoi)}> · {unitCode('daiDoi', item.daiDoi)}</small> : null}
        </span>
        <span className={`rank-badge ${rankClass}`}>Hạng {item.rank}</span>
        <ScoreRing score={item.totalScore} base={baseScore} size="md" label="điểm" />
      </button>

      <div className="platoon-meta">
        <span><Building2 size={14} /> {item.building || 'Chưa xếp tòa'}</span>
        <span><DoorOpen size={14} /> {item.rooms || 'Chưa xếp phòng'}</span>
        <span className="quan-so">{item.quanSo || '—'}</span>
      </div>

      <div className="score-bars" aria-hidden="true">
        <span className="score-bar bar-ht" style={{ '--bar': `${Math.min(100, Math.abs(Number(item.hocTap)) * 120)}%` } as CSSProperties} title={`Học tập ${formatNum(item.hocTap)}`} />
        <span className="score-bar bar-rl" style={{ '--bar': `${Math.min(100, Math.abs(Number(item.renLuyen)) * 120)}%` } as CSSProperties} title={`Rèn luyện ${formatNum(item.renLuyen)}`} />
        <span className="score-bar bar-nvvs" style={{ '--bar': `${Math.min(100, Math.abs(Number(item.nvvs)) * 120)}%` } as CSSProperties} title={`NVVS ${formatNum(item.nvvs)}`} />
        <span className="score-bar bar-lt" style={{ '--bar': `${Math.min(100, Math.abs(Number(item.leTiet)) * 120)}%` } as CSSProperties} title={`Lễ tiết ${formatNum(item.leTiet)}`} />
      </div>

      {item.note ? (
        <div className="platoon-note" title={item.note}>
          <StickyNote size={13} />
          <span>{item.note}</span>
        </div>
      ) : null}

      <div className="platoon-actions">
        {locked ? (
          <span className="locked-hint">Đã khóa sổ</span>
        ) : (
          <>
            {QUICK_ACTIONS.map(action => (
              <button
                key={action.field}
                type="button"
                className={`quick-chip quick-${action.field}`}
                onClick={() => onQuickDeduct(action.field, action.value)}
                title={`Trừ ${Math.abs(action.value)} điểm ${action.label}`}
              >
                {action.label}
              </button>
            ))}
            <button type="button" className="quick-chip quick-edit" onClick={onGrade}>
              <Pencil size={13} /> Chấm
            </button>
          </>
        )}
      </div>

      {hasDeduction ? <span className="deduction-flag" aria-label="Có điểm trừ" /> : null}
    </article>
  );
}
