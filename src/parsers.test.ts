import { describe, expect, it } from 'vitest';
import { parseSheetText } from './parsers';

describe('parseSheetText', () => {
  it('đọc dữ liệu phân cách bằng tab', () => {
    const rows = parseSheetText('TĐ\tTòa\tPhòng\n1\tToà C7\t503');
    expect(rows).toEqual([
      ['TĐ', 'Tòa', 'Phòng'],
      ['1', 'Toà C7', '503']
    ]);
  });

  it('đọc dữ liệu phân cách bằng dấu phẩy có ngoặc kép', () => {
    const rows = parseSheetText('TĐ,Tòa,Ghi chú\n1,"Toà C7, dãy B","Đi muộn, thiếu nội vụ"');
    expect(rows[1]).toEqual(['1', 'Toà C7, dãy B', 'Đi muộn, thiếu nội vụ']);
  });

  it('đọc dữ liệu phân cách bằng dấu chấm phẩy', () => {
    const rows = parseSheetText('TĐ;Tòa;Phòng\n1;Toà C7;503');
    expect(rows).toEqual([
      ['TĐ', 'Tòa', 'Phòng'],
      ['1', 'Toà C7', '503']
    ]);
  });

  it('hỗ trợ dòng sep= và BOM', () => {
    const rows = parseSheetText('\uFEFFsep=;\nTĐ;Tòa\n1;Toà C7');
    expect(rows).toEqual([
      ['TĐ', 'Tòa'],
      ['1', 'Toà C7']
    ]);
  });

  it('bỏ qua dòng trống và giữ nội dung có xuống dòng trong ngoặc kép', () => {
    const rows = parseSheetText('TĐ,Ghi chú\n\n1,"Dòng 1\nDòng 2"');
    expect(rows).toEqual([
      ['TĐ', 'Ghi chú'],
      ['1', 'Dòng 1\nDòng 2']
    ]);
  });

  it('trả về mảng rỗng với dữ liệu rỗng', () => {
    expect(parseSheetText('')).toEqual([]);
  });
});
