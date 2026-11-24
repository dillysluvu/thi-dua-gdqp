import { describe, expect, it, vi } from 'vitest';
import { makeDefaultRecord } from '../courseStore';
import { normalizeStudents } from '../students';

vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined
});

const { selectFilteredStudents, selectStudentStats } = await import('./useAppStore');

const record = {
  ...makeDefaultRecord(),
  students: normalizeStudents([
    {
      id: '1',
      name: 'Nguyễn Văn A',
      code: 'SV01',
      cccd: '001208000001',
      hometown: 'Hà Nội',
      className: 'AT23A',
      phone: '0901'
    },
    {
      id: '2',
      name: 'Trần Thị B',
      code: 'SV02',
      cccd: '',
      hometown: '',
      className: '',
      phone: ''
    }
  ])
};

const baseState = {
  record,
  studentSearch: '',
  studentBuilding: 'ALL',
  studentRoom: 'ALL',
  studentPlatoon: 'ALL',
  studentTieuDoi: 'ALL',
  studentDaiDoi: 'ALL',
  studentMissing: 'ALL' as const
};

describe('selectFilteredStudents', () => {
  it('tìm được theo CCCD, quê quán và lớp', () => {
    expect(selectFilteredStudents({ ...baseState, studentSearch: '001208000001' })).toHaveLength(1);
    expect(selectFilteredStudents({ ...baseState, studentSearch: 'hà nội' })[0].code).toBe('SV01');
    expect(selectFilteredStudents({ ...baseState, studentSearch: 'at23a' })[0].code).toBe('SV01');
  });

  it('lọc sinh viên thiếu CCCD hoặc quê quán', () => {
    expect(selectFilteredStudents({ ...baseState, studentMissing: 'cccd' }).map(student => student.code)).toEqual(['SV02']);
    expect(selectFilteredStudents({ ...baseState, studentMissing: 'hometown' }).map(student => student.code)).toEqual(['SV02']);
  });

  it('thống kê số lượng thiếu CCCD và quê quán', () => {
    const stats = selectStudentStats(record);
    expect(stats.missingCccd).toBe(1);
    expect(stats.missingHometown).toBe(1);
  });
});
