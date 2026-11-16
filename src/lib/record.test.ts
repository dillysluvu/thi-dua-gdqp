import { describe, expect, it } from 'vitest';
import { parsePlatoonConfig, platoonsToText } from './record';

describe('record unit config', () => {
  it('đọc cột đại đội (c) tùy chọn và tự suy ra khi trống', () => {
    const parsed = parsePlatoonConfig([
      '1 | Toà C7 | 503, 504 | 32/32 | 3',
      '2 | Toà C7 | 505, 506 | 30/31'
    ].join('\n'));

    expect(parsed.errors).toEqual([]);
    expect(parsed.items[0]).toMatchObject({ id: 1, daiDoi: '3' });
    expect(parsed.items[1].daiDoi).toBe('1');
  });

  it('xuất cột c, tự suy ra từ b nếu chưa có', () => {
    const text = platoonsToText([
      { id: 1, building: 'Toà C7', rooms: '503', quanSo: '32/32', daiDoi: '3' },
      { id: 5, building: 'Toà C7', rooms: '504', quanSo: '30/31' }
    ]);
    expect(text.split('\n')[0]).toBe('1 | Toà C7 | 503 | 32/32 | 3');
    expect(text.split('\n')[1]).toBe('5 | Toà C7 | 504 | 30/31 | 2');
  });
});
