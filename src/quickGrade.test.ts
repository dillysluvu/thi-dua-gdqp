import { describe, expect, it } from 'vitest';
import { filterQuickGradeItems } from './quickGrade';

const items = [
    { id: 12, building: 'Toà C7', rooms: 'P. 701, 702', note: 'Đi trễ', totalScore: 47.5 },
    { id: 2, building: 'Toà C8', rooms: 'P. 503', note: '', totalScore: 50 },
    { id: 35, building: 'Toà C9', rooms: 'P. 1201', note: 'Quên thẻ', totalScore: 49 },
    { id: 1, building: 'Toà C7', rooms: 'P. 101', note: '', totalScore: 50 }
];

describe('filterQuickGradeItems', () => {
    it('sắp xếp theo số trung đội và trả về tất cả', () => {
        expect(filterQuickGradeItems(items, { baseScore: 50 }).map(item => item.id)).toEqual([1, 2, 12, 35]);
    });

    it('tìm theo số trung đội, phòng, tòa và ghi chú', () => {
        expect(filterQuickGradeItems(items, { query: 'td12', baseScore: 50 }).map(item => item.id)).toEqual([12]);
        expect(filterQuickGradeItems(items, { query: '503', baseScore: 50 }).map(item => item.id)).toEqual([2]);
        expect(filterQuickGradeItems(items, { query: 'c9', baseScore: 50 }).map(item => item.id)).toEqual([35]);
        expect(filterQuickGradeItems(items, { query: 'the', baseScore: 50 }).map(item => item.id)).toEqual([35]);
    });

    it('lọc trung đội đã trừ điểm hoặc còn điểm gốc', () => {
        expect(filterQuickGradeItems(items, { filter: 'deducted', baseScore: 50 }).map(item => item.id)).toEqual([12, 35]);
        expect(filterQuickGradeItems(items, { filter: 'clean', baseScore: 50 }).map(item => item.id)).toEqual([1, 2]);
    });

    it('lọc trung đội có ghi chú', () => {
        expect(filterQuickGradeItems(items, { filter: 'note', baseScore: 50 }).map(item => item.id)).toEqual([12, 35]);
    });
});
