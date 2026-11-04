import { normalizeText } from './utils';

export type QuickGradeFilter = 'all' | 'deducted' | 'clean' | 'note';

export interface QuickGradeItemLike {
    id: number;
    building: string;
    rooms: string;
    note: string;
    totalScore: number;
    rank?: number;
}

export interface QuickGradeOptions {
    query?: string;
    filter?: QuickGradeFilter;
    baseScore?: number;
}

/**
 * Lọc danh sách trung đội cho bảng "Chấm riêng".
 * Tìm được theo số trung đội (12, td12, b12), phòng, tòa hoặc ghi chú.
 */
export function filterQuickGradeItems<T extends QuickGradeItemLike>(
    items: readonly T[],
    options: QuickGradeOptions = {}
): T[] {
    const query = normalizeText(options.query || '');
    const filter = options.filter || 'all';
    const baseScore = Number.isFinite(Number(options.baseScore)) ? Number(options.baseScore) : 0;
    const idMatch = /^(?:td|b)\s*(\d+)$/.exec(query);
    const numericQuery = /^\d+$/.test(query);
    const idQuery = idMatch ? Number(idMatch[1]) : (numericQuery ? Number(query) : null);

    return items
        .filter(item => {
            if (filter === 'deducted' && !(item.totalScore < baseScore)) return false;
            if (filter === 'clean' && item.totalScore < baseScore) return false;
            if (filter === 'note' && !String(item.note || '').trim()) return false;

            if (!query) return true;

            const itemIdMatch = idQuery !== null && idQuery === item.id;
            const roomTokens = normalizeText(item.rooms).split(/[,\s]+/).filter(Boolean);
            const roomMatch = roomTokens.includes(query);
            const buildingMatch = normalizeText(item.building).includes(query);
            const noteMatch = normalizeText(item.note).includes(query);

            return itemIdMatch || roomMatch || buildingMatch || noteMatch;
        })
        .sort((a, b) => a.id - b.id);
}
