export interface PlatoonPreset {
  id: number;
  building: string;
  rooms: string;
  defaultQuanSo: string;
}

export interface PlatoonScore {
  quanSo?: string;
  hocTap?: number;
  renLuyen?: number;
  nvvs?: number;
  leTiet?: number;
}

export const PLATOONS_PRESET: PlatoonPreset[] = [
    // Toa C7: B1 - B14
    { id: 1, building: 'Toà C7', rooms: '503, 504, 505, 506', defaultQuanSo: '32/32' },
    { id: 2, building: 'Toà C7', rooms: '507, 508, 509, 510', defaultQuanSo: '30/31' },
    { id: 3, building: 'Toà C7', rooms: '511, 512, 412, 411', defaultQuanSo: '30/31' },
    { id: 4, building: 'Toà C7', rooms: '410, 409, 408, 407', defaultQuanSo: '30/31' },
    { id: 5, building: 'Toà C7', rooms: '406, 405, 404, 403', defaultQuanSo: '32/32' },
    { id: 6, building: 'Toà C7', rooms: '402, 401, 301, 302', defaultQuanSo: '32/32' },
    { id: 7, building: 'Toà C7', rooms: '303, 304, 305, 306', defaultQuanSo: '32/32' },
    { id: 8, building: 'Toà C7', rooms: '307, 308, 309, 310', defaultQuanSo: '28/28' },
    { id: 9, building: 'Toà C7', rooms: '311, 312, 212, 211', defaultQuanSo: '31/31' },
    { id: 10, building: 'Toà C7', rooms: '210, 209, 208, 207', defaultQuanSo: '31/32' },
    { id: 11, building: 'Toà C7', rooms: '206, 205, 204, 203', defaultQuanSo: '30/30' },
    { id: 12, building: 'Toà C7', rooms: '202, 201, 101, 102', defaultQuanSo: '30/30' },
    { id: 13, building: 'Toà C7', rooms: '103, 104, 105, 106', defaultQuanSo: '32/32' },
    { id: 14, building: 'Toà C7', rooms: '107, 108, 109, 110', defaultQuanSo: '32/32' },

    // Toa C8: B15 - B28
    { id: 15, building: 'Toà C8', rooms: '110, 109, 108, 107', defaultQuanSo: '31/31' },
    { id: 16, building: 'Toà C8', rooms: '106, 105, 104, 103, 102', defaultQuanSo: '38/38' },
    { id: 17, building: 'Toà C8', rooms: '101, 201, 202, 203', defaultQuanSo: '31/32' },
    { id: 18, building: 'Toà C8', rooms: '204, 205, 206, 207', defaultQuanSo: '32/32' },
    { id: 19, building: 'Toà C8', rooms: '208, 209, 210, 211', defaultQuanSo: '32/32' },
    { id: 20, building: 'Toà C8', rooms: '212, 312, 311, 310', defaultQuanSo: '32/32' },
    { id: 21, building: 'Toà C8', rooms: '309, 308, 307, 306', defaultQuanSo: '32/32' },
    { id: 22, building: 'Toà C8', rooms: '305, 304, 303, 302', defaultQuanSo: '32/32' },
    { id: 23, building: 'Toà C8', rooms: '301, 401, 402, 403', defaultQuanSo: '32/32' },
    { id: 24, building: 'Toà C8', rooms: '404, 405, 406, 407', defaultQuanSo: '32/32' },
    { id: 25, building: 'Toà C8', rooms: '408, 409, 410, 411', defaultQuanSo: '32/32' },
    { id: 26, building: 'Toà C8', rooms: '412, 512, 511, 510', defaultQuanSo: '30/30' },
    { id: 27, building: 'Toà C8', rooms: '509, 508, 507, 506', defaultQuanSo: '32/32' },
    { id: 28, building: 'Toà C8', rooms: '505, 504, 503, 502', defaultQuanSo: '29/30' },

    // Toa C9: B29 - B43
    { id: 29, building: 'Toà C9', rooms: '101, 102, 103, 104', defaultQuanSo: '32/32' },
    { id: 30, building: 'Toà C9', rooms: '105, 106, 107, 108', defaultQuanSo: '32/32' },
    { id: 31, building: 'Toà C9', rooms: '109, 110, 111, 112', defaultQuanSo: '32/32' },
    { id: 32, building: 'Toà C9', rooms: '212, 211, 210, 209', defaultQuanSo: '32/32' },
    { id: 33, building: 'Toà C9', rooms: '208, 207, 206, 205', defaultQuanSo: '30/30' },
    { id: 34, building: 'Toà C9', rooms: '204, 203, 202, 201', defaultQuanSo: '28/29' },
    { id: 35, building: 'Toà C9', rooms: '301, 302, 303, 304', defaultQuanSo: '30/30' },
    { id: 36, building: 'Toà C9', rooms: '305, 306, 307, 308', defaultQuanSo: '32/32' },
    { id: 37, building: 'Toà C9', rooms: '309, 310, 311, 312', defaultQuanSo: '32/32' },
    { id: 38, building: 'Toà C9', rooms: '412, 411, 410, 409', defaultQuanSo: '32/32' },
    { id: 39, building: 'Toà C9', rooms: '408, 407, 406, 405', defaultQuanSo: '31/31' },
    { id: 40, building: 'Toà C9', rooms: '404, 403, 402, 401', defaultQuanSo: '32/32' },
    { id: 41, building: 'Toà C9', rooms: '501, 502, 503, 504', defaultQuanSo: '32/32' },
    { id: 42, building: 'Toà C9', rooms: '505, 506, 507, 508', defaultQuanSo: '32/32' },
    { id: 43, building: 'Toà C9', rooms: '509, 510, 511, 512', defaultQuanSo: '32/32' },

    // Toa C6: B44 - B52
    { id: 44, building: 'Toà C6', rooms: '101, 102, 103, 104', defaultQuanSo: '32/32' },
    { id: 45, building: 'Toà C6', rooms: '105, 106, 107, 108', defaultQuanSo: '31/31' },
    { id: 46, building: 'Toà C6', rooms: '109, 110, 111, 112', defaultQuanSo: '29/29' },
    { id: 47, building: 'Toà C6', rooms: '212, 211, 210, 209', defaultQuanSo: '32/32' },
    { id: 48, building: 'Toà C6', rooms: '208, 207, 206, 205', defaultQuanSo: '30/30' },
    { id: 49, building: 'Toà C6', rooms: '204, 203, 202, 201', defaultQuanSo: '32/32' },
    { id: 50, building: 'Toà C6', rooms: '301, 302, 303, 304', defaultQuanSo: '30/30' },
    { id: 51, building: 'Toà C6', rooms: '305, 306, 307, 308', defaultQuanSo: '32/32' },
    { id: 52, building: 'Toà C6', rooms: '309, 310, 311, 312', defaultQuanSo: '30/30' },

    // Toa C2: B53 - B56
    { id: 53, building: 'Toà C2', rooms: '204, 203, 202, 201', defaultQuanSo: '32/32' },
    { id: 54, building: 'Toà C2', rooms: '301, 302, 303, 304', defaultQuanSo: '31/31' },
    { id: 55, building: 'Toà C2', rooms: '305, 306, 307, 308', defaultQuanSo: '32/32' },
    { id: 56, building: 'Toà C2', rooms: '309, 310, 311, 312', defaultQuanSo: '32/32' }
];

export const PHOTO_SAMPLE_DATA: Record<number, Partial<PlatoonScore>> = {
    1:  { quanSo: '32/32', nvvs: -0.5 },
    2:  { quanSo: '30/31', hocTap: -0.1, nvvs: -1.1 },
    3:  { quanSo: '30/31', hocTap: -0.1, nvvs: -0.8, leTiet: -0.2 },
    4:  { quanSo: '30/31', nvvs: -0.5, leTiet: -0.2 },
    5:  { quanSo: '32/32', nvvs: -0.7, leTiet: -0.1 },
    6:  { quanSo: '32/32', nvvs: -0.5 },
    7:  { quanSo: '32/32', nvvs: -1.1 },
    8:  { quanSo: '28/28', nvvs: -0.4, leTiet: -0.1 },
    9:  { quanSo: '31/31', nvvs: -0.4, leTiet: -0.2 },
    10: { quanSo: '31/32', hocTap: -0.1, nvvs: -1.7 },
    11: { quanSo: '30/30', nvvs: -1.4 },
    12: { quanSo: '30/30', nvvs: -0.8 },
    13: { quanSo: '32/32', nvvs: -1.5 },
    14: { quanSo: '32/32', nvvs: -1.3 },
    15: { quanSo: '31/31', nvvs: -0.4 },
    16: { quanSo: '38/38', nvvs: -0.7 },
    17: { quanSo: '31/32', hocTap: -0.1 },
    18: { quanSo: '32/32', nvvs: -0.1 },
    19: { quanSo: '32/32', nvvs: -0.4 },
    20: { quanSo: '32/32' },
    21: { quanSo: '32/32', leTiet: -0.1 },
    22: { quanSo: '32/32' },
    23: { quanSo: '32/32' },
    24: { quanSo: '32/32' },
    25: { quanSo: '32/32' },
    26: { quanSo: '30/30', leTiet: -0.1 },
    27: { quanSo: '32/32' },
    28: { quanSo: '29/30', hocTap: -0.1, nvvs: -0.1 },
    29: { quanSo: '32/32', nvvs: -1.1 },
    30: { quanSo: '32/32', nvvs: -1.0 },
    31: { quanSo: '32/32', nvvs: -0.6 },
    32: { quanSo: '32/32', nvvs: -0.7 },
    33: { quanSo: '30/30', nvvs: -0.6 },
    34: { quanSo: '28/29', hocTap: -0.1, nvvs: -0.6 },
    35: { quanSo: '30/30', nvvs: -0.9 },
    36: { quanSo: '32/32', nvvs: -0.5 },
    37: { quanSo: '32/32', nvvs: -0.4 },
    38: { quanSo: '32/32', nvvs: -1.0 },
    39: { quanSo: '31/31', nvvs: -0.7 },
    40: { quanSo: '32/32', renLuyen: -1.3, nvvs: -0.8 }
};

export const DEFAULT_META = {
    courseName: 'K337',
    unitName: 'Trung Tâm GDQP&AN',
    baseScore: 50,
    ngay: 21,
    thang: 10,
    nam: 2026
};

export const SHEET_ALIASES: Record<string, string[]> = {
    id: ['td', 'stt', 'so td', 'trung doi', 'id', 'tt', 'so thu tu'],
    building: ['toa', 'toa nha', 'nha', 'building', 'day nha'],
    rooms: ['phong', 'phong o', 'room', 'so phong'],
    quanSo: ['quan so', 'qs', 'quan so ngay', 'quan so hang ngay'],
    hocTap: ['hoc tap', 'ht'],
    renLuyen: ['ren luyen', 'rl', 'ky luat'],
    nvvs: ['nvvs', 'noi vu ve sinh'],
    leTiet: ['le tiet', 'lt', 'tac phong'],
    note: ['ghi chu', 'note', 'ly do', 'ly do tru diem']
};

export const SHEET_PREVIEW_COLUMNS: Array<[string, string]> = [
    ['id', 'TĐ'],
    ['building', 'Tòa'],
    ['rooms', 'Phòng'],
    ['quanSo', 'Quân số'],
    ['hocTap', 'Học tập'],
    ['renLuyen', 'Rèn luyện'],
    ['nvvs', 'NVVS'],
    ['leTiet', 'Lễ tiết'],
    ['note', 'Ghi chú']
];
