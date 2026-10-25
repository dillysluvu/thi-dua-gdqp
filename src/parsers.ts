import { readFileAsText } from './utils';

export interface SheetData {
  name: string;
  rows: string[][];
}

export interface ParsedWorkbook {
  sheets: SheetData[];
}

function detectDelimiter(text: string): string {
    const sample = String(text || '').split(/\r?\n/).slice(0, 6).join('\n');
    const candidates: Array<[string, number]> = [
        ['\t', (sample.match(/\t/g) || []).length],
        [';', (sample.match(/;/g) || []).length],
        [',', (sample.match(/,/g) || []).length]
    ];
    candidates.sort((a, b) => b[1] - a[1]);
    return candidates[0][1] > 0 ? candidates[0][0] : ',';
}

function parseDelimitedText(text: string, delimiter: string): string[][] {
    const source = String(text || '').replace(/^\uFEFF/, '');
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let index = 0; index < source.length; index++) {
        const character = source[index];

        if (inQuotes) {
            if (character === '"') {
                if (source[index + 1] === '"') {
                    field += '"';
                    index++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += character;
            }
            continue;
        }

        if (character === '"' && field === '') {
            inQuotes = true;
        } else if (character === delimiter) {
            row.push(field);
            field = '';
        } else if (character === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else if (character === '\r') {
            if (source[index + 1] === '\n') index++;
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else {
            field += character;
        }
    }

    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);

    return rows
        .map(cells => cells.map(cell => String(cell).trim()))
        .filter(cells => cells.some(cell => cell !== ''));
}

export function parseSheetText(text: string): string[][] {
    let source = String(text || '').replace(/^\uFEFF/, '');
    let delimiter = null;

    const separatorLine = source.match(/^sep=(.)\r?\n/i);
    if (separatorLine) {
        delimiter = separatorLine[1];
        source = source.slice(separatorLine[0].length);
    }

    if (!delimiter) delimiter = detectDelimiter(source);
    return parseDelimitedText(source, delimiter);
}

function colLettersToIndex(letters: string): number {
    let index = 0;
    String(letters || '').toUpperCase().split('').forEach(character => {
        const code = character.charCodeAt(0);
        if (code < 65 || code > 90) return;
        index = index * 26 + (code - 64);
    });
    return index - 1;
}

function findZipEntries(bytes: Uint8Array): Record<string, any> {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocdOffset = -1;
    const minOffset = Math.max(0, bytes.length - 65557);

    for (let offset = bytes.length - 22; offset >= minOffset; offset--) {
        if (view.getUint32(offset, true) === 0x06054b50) {
            eocdOffset = offset;
            break;
        }
    }

    if (eocdOffset < 0) {
        throw new Error('File .xlsx không hợp lệ (không tìm thấy cấu trúc ZIP).');
    }

    const entryCount = view.getUint16(eocdOffset + 10, true);
    let offset = view.getUint32(eocdOffset + 16, true);

    if (offset === 0xFFFFFFFF) {
        throw new Error('File .xlsx dùng định dạng ZIP64 chưa được hỗ trợ. Hãy lưu lại thành .csv.');
    }

    const entries = {};
    for (let index = 0; index < entryCount; index++) {
        if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) {
            throw new Error('File .xlsx không hợp lệ (central directory bị lỗi).');
        }

        const method = view.getUint16(offset + 10, true);
        const compressedSize = view.getUint32(offset + 20, true);
        const nameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const localOffset = view.getUint32(offset + 42, true);
        const name = new TextDecoder('utf-8').decode(bytes.slice(offset + 46, offset + 46 + nameLength));

        entries[name] = { method, compressedSize, localOffset };
        offset += 46 + nameLength + extraLength + commentLength;
    }

    return entries;
}

async function inflateRawBytes(bytes: Uint8Array): Promise<Uint8Array> {
    if (typeof DecompressionStream === 'undefined') {
        throw new Error('Trình duyệt chưa hỗ trợ đọc file .xlsx. Hãy lưu file thành .csv rồi nhập lại.');
    }

    try {
        const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (error) {
        throw new Error('Không giải nén được file .xlsx. Hãy thử lưu lại thành .csv.');
    }
}

async function readZipEntryBytes(bytes: Uint8Array, entry: any): Promise<Uint8Array> {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (entry.localOffset + 30 > bytes.length || view.getUint32(entry.localOffset, true) !== 0x04034b50) {
        throw new Error('File .xlsx không hợp lệ (local header bị lỗi).');
    }

    const nameLength = view.getUint16(entry.localOffset + 26, true);
    const extraLength = view.getUint16(entry.localOffset + 28, true);
    const dataOffset = entry.localOffset + 30 + nameLength + extraLength;
    const dataEnd = dataOffset + entry.compressedSize;

    if (dataEnd > bytes.length) {
        throw new Error('File .xlsx bị thiếu dữ liệu.');
    }

    const data = bytes.slice(dataOffset, dataEnd);
    if (entry.method === 0) return data;
    if (entry.method === 8) return inflateRawBytes(data);
    throw new Error('File .xlsx dùng kiểu nén chưa được hỗ trợ.');
}

async function readZipText(bytes: Uint8Array, entry: any): Promise<string> {
    const data = await readZipEntryBytes(bytes, entry);
    return new TextDecoder('utf-8').decode(data);
}

function parseSharedStringsXml(xml: string): string[] {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) {
        throw new Error('Không đọc được sharedStrings của file .xlsx.');
    }
    return Array.from(doc.getElementsByTagName('si')).map(node =>
        Array.from(node.getElementsByTagName('t')).map(textNode => textNode.textContent || '').join('')
    );
}

function parseWorksheetXml(xml: string, sharedStrings: string[]): string[][] {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) {
        throw new Error('Không đọc được sheet của file .xlsx.');
    }

    const rows = [];
    Array.from(doc.getElementsByTagName('row')).forEach((rowNode, fallbackIndex) => {
        const rowNumber = parseInt(rowNode.getAttribute('r'), 10);
        const rowIndex = Number.isFinite(rowNumber) && rowNumber > 0 ? rowNumber - 1 : fallbackIndex;
        const row = [];

        Array.from(rowNode.getElementsByTagName('c')).forEach((cellNode, fallbackCellIndex) => {
            const reference = cellNode.getAttribute('r') || '';
            const letters = (reference.match(/^[A-Z]+/i) || [])[0];
            const columnIndex = letters ? colLettersToIndex(letters) : fallbackCellIndex;
            const type = cellNode.getAttribute('t');
            let value = '';

            if (type === 'inlineStr') {
                value = Array.from(cellNode.getElementsByTagName('t')).map(node => node.textContent || '').join('');
            } else {
                const valueNode = cellNode.getElementsByTagName('v')[0];
                if (valueNode) {
                    if (type === 's') {
                        value = sharedStrings[parseInt(valueNode.textContent, 10)] || '';
                    } else {
                        value = valueNode.textContent || '';
                    }
                }
            }

            row[columnIndex] = value;
        });

        rows[rowIndex] = row;
    });

    for (let index = 0; index < rows.length; index++) {
        if (!rows[index]) rows[index] = [];
    }

    return rows.filter(row => row.some(cell => String(cell === undefined || cell === null ? '' : cell).trim() !== ''));
}

export async function parseXlsxSheets(bytes: Uint8Array): Promise<SheetData[]> {
    const entries = findZipEntries(bytes);
    if (!entries['xl/workbook.xml']) {
        throw new Error('Không phải file Excel .xlsx hợp lệ.');
    }

    const workbookXml = await readZipText(bytes, entries['xl/workbook.xml']);
    const workbookDoc = new DOMParser().parseFromString(workbookXml, 'application/xml');
    const sheetNodes = Array.from(workbookDoc.getElementsByTagName('sheet'));
    if (!sheetNodes.length) {
        throw new Error('Không tìm thấy worksheet trong file .xlsx.');
    }

    let relationships = [];
    if (entries['xl/_rels/workbook.xml.rels']) {
        try {
            const relationshipXml = await readZipText(bytes, entries['xl/_rels/workbook.xml.rels']);
            const relationshipDoc = new DOMParser().parseFromString(relationshipXml, 'application/xml');
            relationships = Array.from(relationshipDoc.getElementsByTagName('Relationship'));
        } catch (error) {
            console.warn('Không đọc được workbook relationships, dùng thứ tự sheet:', error);
        }
    }

    let sharedStrings = [];
    if (entries['xl/sharedStrings.xml']) {
        sharedStrings = parseSharedStringsXml(await readZipText(bytes, entries['xl/sharedStrings.xml']));
    }

    const sheets = [];
    for (let index = 0; index < sheetNodes.length; index++) {
        const sheetNode = sheetNodes[index];
        const name = sheetNode.getAttribute('name') || `Sheet ${index + 1}`;
        const relationshipId = sheetNode.getAttribute('r:id')
            || sheetNode.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
        let sheetPath = null;

        if (relationshipId) {
            const relationship = relationships.find(node => node.getAttribute('Id') === relationshipId);
            if (relationship) {
                let target = String(relationship.getAttribute('Target') || '').replace(/^\/+/, '');
                if (!target.startsWith('xl/')) target = 'xl/' + target;
                if (entries[target]) sheetPath = target;
            }
        }

        if (!sheetPath) {
            const fallback = `xl/worksheets/sheet${index + 1}.xml`;
            if (entries[fallback]) sheetPath = fallback;
        }
        if (!sheetPath) continue;

        try {
            const worksheetXml = await readZipText(bytes, entries[sheetPath]);
            sheets.push({ name, rows: parseWorksheetXml(worksheetXml, sharedStrings) });
        } catch (error) {
            console.warn(`Không đọc được sheet "${name}":`, error);
            sheets.push({ name, rows: [] });
        }
    }

    if (!sheets.length) {
        throw new Error('Không tìm thấy worksheet trong file .xlsx.');
    }

    return sheets;
}

export async function parseXlsxRows(bytes: Uint8Array): Promise<string[][]> {
    const sheets = await parseXlsxSheets(bytes);
    const sheet = sheets.find(item => item.rows.length);
    return sheet ? sheet.rows : [];
}

// ============================================================
// LEGACY EXCEL .XLS (OLE2 / BIFF8)
// ============================================================
function xlsReadU16(data: Uint8Array, offset: number): number {
    return (data[offset] | (data[offset + 1] << 8)) >>> 0;
}

function xlsReadU32(data: Uint8Array, offset: number): number {
    return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
}

function xlsReadDouble(data: Uint8Array, offset: number): number {
    return new DataView(data.buffer, data.byteOffset + offset, 8).getFloat64(0, true);
}

function xlsIsCfb(bytes: Uint8Array): boolean {
    return bytes.length >= 8
        && bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0
        && bytes[4] === 0xA1 && bytes[5] === 0xB1 && bytes[6] === 0x1A && bytes[7] === 0xE1;
}

function xlsIsZip(bytes: Uint8Array): boolean {
    return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4B
        && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07);
}

function xlsReadCfbStream(bytes: Uint8Array, startSector: number, size: number, fat: number[], sectorSize: number): Uint8Array {
    const out = new Uint8Array(size);
    let sector = startSector;
    let position = 0;
    const seen = new Set();

    while (position < size && sector < 0xFFFFFFFA) {
        if (seen.has(sector)) throw new Error('File .xls bị lỗi cấu trúc (chuỗi sector lặp).');
        seen.add(sector);
        if (sector >= fat.length) throw new Error('File .xls bị lỗi cấu trúc (sector ngoài phạm vi).');

        const offset = (sector + 1) * sectorSize;
        if (offset >= bytes.length) throw new Error('File .xls bị thiếu dữ liệu.');
        const take = Math.min(sectorSize, size - position, bytes.length - offset);
        out.set(bytes.subarray(offset, offset + take), position);
        position += take;
        sector = fat[sector];
    }

    if (position < size) throw new Error('File .xls bị thiếu dữ liệu stream.');
    return out;
}

function xlsReadCfbMiniStream(startSector: number, size: number, miniStream: Uint8Array, miniFat: number[], miniSectorSize: number): Uint8Array {
    const out = new Uint8Array(size);
    let sector = startSector;
    let position = 0;
    const seen = new Set();

    while (position < size && sector < 0xFFFFFFFA) {
        if (seen.has(sector)) throw new Error('File .xls bị lỗi cấu trúc (mini sector lặp).');
        seen.add(sector);
        if (sector >= miniFat.length) throw new Error('File .xls bị lỗi cấu trúc (mini sector ngoài phạm vi).');

        const offset = sector * miniSectorSize;
        if (offset >= miniStream.length) throw new Error('File .xls bị thiếu dữ liệu mini stream.');
        const take = Math.min(miniSectorSize, size - position, miniStream.length - offset);
        out.set(miniStream.subarray(offset, offset + take), position);
        position += take;
        sector = miniFat[sector];
    }

    if (position < size) throw new Error('File .xls bị thiếu dữ liệu mini stream.');
    return out;
}

function xlsExtractCfbWorkbook(bytes: Uint8Array): Uint8Array {
    if (!xlsIsCfb(bytes)) throw new Error('Không phải file Excel .xls hợp lệ.');

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const sectorSize = 1 << view.getUint16(30, true);
    const miniSectorSize = 1 << view.getUint16(32, true);
    const numFatSectors = view.getUint32(44, true);
    const firstDirSector = view.getUint32(48, true);
    const miniCutoff = view.getUint32(56, true);
    const firstMiniFatSector = view.getUint32(60, true);
    const numMiniFatSectors = view.getUint32(64, true);
    const firstDifatSector = view.getUint32(68, true);
    const numDifatSectors = view.getUint32(72, true);

    const fatSectorIds = [];
    for (let index = 0; index < 109; index++) {
        const id = view.getUint32(76 + index * 4, true);
        if (id < 0xFFFFFFFA) fatSectorIds.push(id);
    }

    let difatSector = firstDifatSector;
    const perDifat = sectorSize / 4 - 1;
    const seenDifat = new Set();
    for (let index = 0; index < numDifatSectors && difatSector < 0xFFFFFFFA; index++) {
        if (seenDifat.has(difatSector)) throw new Error('File .xls bị lỗi DIFAT.');
        seenDifat.add(difatSector);
        const offset = (difatSector + 1) * sectorSize;
        if (offset + sectorSize > bytes.length) throw new Error('File .xls bị thiếu DIFAT.');
        for (let item = 0; item < perDifat; item++) {
            const id = view.getUint32(offset + item * 4, true);
            if (id < 0xFFFFFFFA) fatSectorIds.push(id);
        }
        difatSector = view.getUint32(offset + perDifat * 4, true);
    }

    if (!fatSectorIds.length || fatSectorIds.length < numFatSectors) {
        throw new Error('File .xls bị lỗi bảng FAT.');
    }

    const fat = [];
    fatSectorIds.slice(0, numFatSectors).forEach(sector => {
        const offset = (sector + 1) * sectorSize;
        if (offset + sectorSize > bytes.length) throw new Error('File .xls bị thiếu bảng FAT.');
        for (let index = 0; index < sectorSize / 4; index++) {
            fat.push(view.getUint32(offset + index * 4, true));
        }
    });

    const directorySize = (() => {
        let sector = firstDirSector;
        let count = 0;
        const seen = new Set();
        while (sector < 0xFFFFFFFA && !seen.has(sector)) {
            seen.add(sector);
            count++;
            if (sector >= fat.length) throw new Error('File .xls bị lỗi thư mục.');
            sector = fat[sector];
        }
        return count * sectorSize;
    })();

    const directory = xlsReadCfbStream(bytes, firstDirSector, directorySize, fat, sectorSize);
    const entries = [];
    for (let offset = 0; offset + 128 <= directory.length; offset += 128) {
        const nameLength = xlsReadU16(directory, offset + 64);
        const nameBytes = directory.subarray(offset, offset + Math.max(0, Math.min(64, nameLength - 2)));
        let name = '';
        for (let index = 0; index + 1 < nameBytes.length; index += 2) {
            name += String.fromCharCode(nameBytes[index] | (nameBytes[index + 1] << 8));
        }
        entries.push({
            name,
            type: directory[offset + 66],
            startSector: xlsReadU32(directory, offset + 116),
            size: xlsReadU32(directory, offset + 120) + xlsReadU32(directory, offset + 124) * 4294967296
        });
    }

    const root = entries.find(entry => entry.type === 5 && /^root entry$/i.test(entry.name));
    const workbook = entries.find(entry => entry.type === 2 && /^(workbook|book)$/i.test(entry.name));
    if (!workbook) throw new Error('Không tìm thấy luồng Workbook trong file .xls.');
    if (!workbook.size) throw new Error('File .xls không có dữ liệu.');

    if (workbook.size < miniCutoff) {
        if (!root) throw new Error('File .xls bị lỗi (không có Root Entry).');
        const miniStream = xlsReadCfbStream(bytes, root.startSector, root.size, fat, sectorSize);
        const miniFatBytes = xlsReadCfbStream(bytes, firstMiniFatSector, numMiniFatSectors * sectorSize, fat, sectorSize);
        const miniFat = [];
        for (let index = 0; index < miniFatBytes.length / 4; index++) {
            miniFat.push(xlsReadU32(miniFatBytes, index * 4));
        }
        return xlsReadCfbMiniStream(workbook.startSector, workbook.size, miniStream, miniFat, miniSectorSize);
    }

    return xlsReadCfbStream(bytes, workbook.startSector, workbook.size, fat, sectorSize);
}

function xlsCreateByteReader(segments: Uint8Array[]) {
    let segmentIndex = 0;
    let offset = 0;

    function normalize() {
        while (segmentIndex < segments.length && offset >= segments[segmentIndex].length) {
            segmentIndex++;
            offset = 0;
        }
    }

    return {
        atEnd() {
            normalize();
            return segmentIndex >= segments.length;
        },
        atSegmentEnd() {
            return segmentIndex >= segments.length || offset >= segments[segmentIndex].length;
        },
        remaining() {
            normalize();
            return segmentIndex < segments.length ? segments[segmentIndex].length - offset : 0;
        },
        nextSegment() {
            segmentIndex++;
            offset = 0;
            normalize();
        },
        readU8() {
            normalize();
            if (segmentIndex >= segments.length) throw new Error('Dữ liệu chuỗi .xls bị thiếu.');
            return segments[segmentIndex][offset++];
        },
        readU16() {
            const low = this.readU8();
            const high = this.readU8();
            return (low | (high << 8)) >>> 0;
        },
        readU32() {
            const low = this.readU16();
            const high = this.readU16();
            return (low | (high << 16)) >>> 0;
        },
        skip(count) {
            for (let index = 0; index < count; index++) this.readU8();
        }
    };
}

function xlsReadUnicodeString(reader: any): string {
    const cch = reader.readU16();
    const flags = reader.readU8();
    let cRun = 0;
    let cbExtRst = 0;
    if (flags & 0x08) cRun = reader.readU16();
    if (flags & 0x04) cbExtRst = reader.readU32();

    let wide = Boolean(flags & 0x01);
    let remaining = cch;
    let text = '';

    while (remaining > 0) {
        if (reader.atSegmentEnd()) {
            reader.nextSegment();
            if (reader.atEnd()) throw new Error('Dữ liệu chuỗi .xls bị thiếu.');
            wide = Boolean(reader.readU8() & 0x01);
        }

        const available = reader.remaining();
        if (wide) {
            if (available < 2) throw new Error('Dữ liệu chuỗi .xls bị lỗi (ký tự Unicode bị chia).');
            const take = Math.min(remaining, Math.floor(available / 2));
            for (let index = 0; index < take; index++) {
                text += String.fromCharCode(reader.readU16());
            }
            remaining -= take;
        } else {
            const take = Math.min(remaining, available);
            for (let index = 0; index < take; index++) {
                text += String.fromCharCode(reader.readU8());
            }
            remaining -= take;
        }
    }

    if (cRun) reader.skip(cRun * 4);
    if (cbExtRst) reader.skip(cbExtRst);
    return text;
}

function xlsParseSst(payloads: Uint8Array[]): string[] {
    const reader = xlsCreateByteReader(payloads);
    reader.readU32();
    const uniqueCount = reader.readU32();
    if (uniqueCount > 1000000) throw new Error('File .xls có quá nhiều chuỗi chia sẻ.');
    const strings = [];
    for (let index = 0; index < uniqueCount; index++) {
        strings.push(xlsReadUnicodeString(reader));
    }
    return strings;
}

function xlsReadBiffRecords(data: Uint8Array, start: number): any[] {
    const records = [];
    let offset = start;
    while (offset + 4 <= data.length) {
        const type = xlsReadU16(data, offset);
        const length = xlsReadU16(data, offset + 2);
        const payloadStart = offset + 4;
        if (payloadStart + length > data.length) throw new Error('File .xls bị lỗi (record vượt quá dữ liệu).');
        records.push({ type, payload: data.subarray(payloadStart, payloadStart + length) });
        offset = payloadStart + length;
        if (type === 0x000A) break;
    }
    return records;
}

function xlsDecodeRk(rk: number): number {
    let value;
    if (rk & 0x02) {
        value = rk >> 2;
    } else {
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        view.setUint32(0, 0, true);
        view.setUint32(4, (rk & 0xFFFFFFFC) >>> 0, true);
        value = view.getFloat64(0, true);
    }
    if (rk & 0x01) value /= 100;
    return value;
}

function xlsNumberText(value: number): string {
    if (!Number.isFinite(value)) return '';
    return String(Number(value.toPrecision(15)));
}

function xlsSetCell(rows: Map<number, string[]>, rowIndex: number, columnIndex: number, value: string): void {
    let row = rows.get(rowIndex);
    if (!row) {
        row = [];
        rows.set(rowIndex, row);
    }
    row[columnIndex] = value === undefined || value === null ? '' : String(value);
}

function xlsParseSheet(workbook: Uint8Array, startOffset: number, sharedStrings: string[]): string[][] {
    if (startOffset + 4 > workbook.length || xlsReadU16(workbook, startOffset) !== 0x0809) {
        return [];
    }

    const records = xlsReadBiffRecords(workbook, startOffset);
    const rows = new Map();
    let pendingFormula = null;

    records.forEach(record => {
        const payload = record.payload;
        if (record.type === 0x000A) return;

        if (record.type === 0x00FD && payload.length >= 10) {
            pendingFormula = null;
            const row = xlsReadU16(payload, 0);
            const column = xlsReadU16(payload, 2);
            const index = xlsReadU32(payload, 6);
            xlsSetCell(rows, row, column, sharedStrings[index] !== undefined ? sharedStrings[index] : '');
            return;
        }

        if ((record.type === 0x0204 || record.type === 0x00D6) && payload.length >= 9) {
            pendingFormula = null;
            const row = xlsReadU16(payload, 0);
            const column = xlsReadU16(payload, 2);
            const reader = xlsCreateByteReader([payload.subarray(6)]);
            xlsSetCell(rows, row, column, xlsReadUnicodeString(reader));
            return;
        }

        if (record.type === 0x0203 && payload.length >= 14) {
            pendingFormula = null;
            xlsSetCell(rows, xlsReadU16(payload, 0), xlsReadU16(payload, 2), xlsNumberText(xlsReadDouble(payload, 6)));
            return;
        }

        if (record.type === 0x027E && payload.length >= 10) {
            pendingFormula = null;
            xlsSetCell(rows, xlsReadU16(payload, 0), xlsReadU16(payload, 2), xlsNumberText(xlsDecodeRk(xlsReadU32(payload, 6))));
            return;
        }

        if (record.type === 0x00BD && payload.length >= 12) {
            pendingFormula = null;
            const row = xlsReadU16(payload, 0);
            const firstColumn = xlsReadU16(payload, 2);
            const lastColumn = xlsReadU16(payload, payload.length - 2);
            const count = lastColumn - firstColumn + 1;
            if (count > 0 && 4 + count * 6 + 2 <= payload.length) {
                for (let index = 0; index < count; index++) {
                    const rk = xlsReadU32(payload, 4 + index * 6 + 2);
                    xlsSetCell(rows, row, firstColumn + index, xlsNumberText(xlsDecodeRk(rk)));
                }
            }
            return;
        }

        if (record.type === 0x0006 && payload.length >= 14) {
            const row = xlsReadU16(payload, 0);
            const column = xlsReadU16(payload, 2);
            const result = payload.subarray(6, 14);
            pendingFormula = null;

            if (result[6] === 0xFF && result[7] === 0xFF) {
                if (result[0] === 0) {
                    pendingFormula = { row, column };
                } else if (result[0] === 1) {
                    xlsSetCell(rows, row, column, result[2] ? 'TRUE' : 'FALSE');
                } else {
                    xlsSetCell(rows, row, column, '');
                }
            } else {
                xlsSetCell(rows, row, column, xlsNumberText(xlsReadDouble(result, 0)));
            }
            return;
        }

        if (record.type === 0x0207) {
            if (pendingFormula) {
                const reader = xlsCreateByteReader([payload]);
                xlsSetCell(rows, pendingFormula.row, pendingFormula.column, xlsReadUnicodeString(reader));
                pendingFormula = null;
            }
            return;
        }

        if (record.type === 0x0205 && payload.length >= 8) {
            pendingFormula = null;
            const value = payload[6];
            const isError = payload[7];
            xlsSetCell(rows, xlsReadU16(payload, 0), xlsReadU16(payload, 2), isError ? '' : (value ? 'TRUE' : 'FALSE'));
        }
    });

    const rowIndexes = Array.from(rows.keys()).sort((a, b) => a - b);
    let maxColumn = 0;
    rows.forEach(row => {
        for (let index = 0; index < row.length; index++) {
            if (row[index] !== undefined && row[index] !== '') maxColumn = Math.max(maxColumn, index);
        }
    });

    const result = [];
    rowIndexes.forEach(rowIndex => {
        const source = rows.get(rowIndex);
        const row = [];
        let hasValue = false;
        for (let column = 0; column <= maxColumn; column++) {
            const value = source[column] === undefined ? '' : source[column];
            if (value !== '') hasValue = true;
            row.push(value);
        }
        if (hasValue) result.push(row);
    });
    return result;
}

function xlsParseBoundsheetName(payload: Uint8Array): string {
    if (!payload || payload.length < 8) return '';
    const length = payload[6];
    const flags = payload[7];
    let name = '';

    if (flags & 0x01) {
        for (let index = 0; index < length; index++) {
            const position = 8 + index * 2;
            if (position + 1 >= payload.length) break;
            name += String.fromCharCode(payload[position] | (payload[position + 1] << 8));
        }
    } else {
        for (let index = 0; index < length; index++) {
            const position = 8 + index;
            if (position >= payload.length) break;
            name += String.fromCharCode(payload[position]);
        }
    }

    return name.trim();
}

export function xlsParseSheets(bytes: Uint8Array): SheetData[] {
    const workbook = xlsExtractCfbWorkbook(bytes);
    const records = xlsReadBiffRecords(workbook, 0);
    if (!records.length || records[0].type !== 0x0809) {
        throw new Error('File .xls không có workbook hợp lệ.');
    }

    const version = xlsReadU16(records[0].payload, 0);
    if (version !== 0x0600) {
        throw new Error('File .xls quá cũ (chỉ hỗ trợ Excel 97-2003). Hãy lưu lại thành .xlsx hoặc .csv.');
    }

    const sstPayloads = [];
    const sheets = [];
    let collectingSst = false;
    let encrypted = false;

    records.forEach(record => {
        if (record.type === 0x002F) encrypted = true;

        if (record.type === 0x00FC) {
            sstPayloads.length = 0;
            sstPayloads.push(record.payload);
            collectingSst = true;
            return;
        }
        if (collectingSst && record.type === 0x003C) {
            sstPayloads.push(record.payload);
            return;
        }
        collectingSst = false;

        if (record.type === 0x0085 && record.payload.length >= 8) {
            sheets.push({
                offset: xlsReadU32(record.payload, 0),
                name: xlsParseBoundsheetName(record.payload) || `Sheet ${sheets.length + 1}`
            });
        }
    });

    if (encrypted) {
        throw new Error('File .xls có mật khẩu bảo vệ chưa được hỗ trợ. Hãy bỏ mật khẩu hoặc lưu thành .xlsx/.csv.');
    }

    const sharedStrings = sstPayloads.length ? xlsParseSst(sstPayloads) : [];
    if (!sheets.length) throw new Error('Không tìm thấy sheet dữ liệu trong file .xls.');

    return sheets.map(sheet => {
        try {
            return { name: sheet.name, rows: xlsParseSheet(workbook, sheet.offset, sharedStrings) };
        } catch (error) {
            console.warn(`Không đọc được sheet "${sheet.name}":`, error);
            return { name: sheet.name, rows: [] };
        }
    });
}

export function xlsParseRows(bytes: Uint8Array): string[][] {
    const sheets = xlsParseSheets(bytes);
    const sheet = sheets.find(item => item.rows.length);
    return sheet ? sheet.rows : [];
}

function parseHtmlTableText(text: string): string[][] {
    try {
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const table = doc.querySelector('table');
        if (!table) return [];
        return Array.from(table.rows).map(row =>
            Array.from(row.cells).map(cell => String(cell.textContent || '').replace(/\u00a0/g, ' ').trim())
        ).filter(row => row.some(cell => cell !== ''));
    } catch (error) {
        return [];
    }
}

function parseSpreadsheetXmlText(text: string): string[][] {
    try {
        const doc = new DOMParser().parseFromString(text, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length) return [];
        const rows = Array.from(doc.getElementsByTagNameNS('*', 'Row'));
        if (!rows.length) return [];
        const result = [];
        rows.forEach(row => {
            const values = [];
            Array.from(row.getElementsByTagNameNS('*', 'Cell')).forEach(cell => {
                const indexValue = cell.getAttributeNS('urn:schemas-microsoft-com:office:spreadsheet', 'Index')
                    || cell.getAttribute('ss:Index');
                const index = parseInt(indexValue, 10);
                const data = cell.getElementsByTagNameNS('*', 'Data')[0];
                const value = String(data ? data.textContent : cell.textContent || '').replace(/\u00a0/g, ' ').trim();
                if (Number.isFinite(index) && index > 0) {
                    values[index - 1] = value;
                } else {
                    values.push(value);
                }
            });
            if (values.some(value => value !== undefined && value !== '')) result.push(values);
        });
        return result;
    } catch (error) {
        return [];
    }
}

function decodeTextBytes(bytes: Uint8Array): string {
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
        return new TextDecoder('utf-16le').decode(bytes.subarray(2));
    }
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
        return new TextDecoder('utf-16be').decode(bytes.subarray(2));
    }
    return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
}

export async function parseSheetFile(file: File): Promise<ParsedWorkbook> {
    const name = String(file.name || '').toLowerCase();

    if (name.endsWith('.xls') || name.endsWith('.xlsx')) {
        if (file.size > 20 * 1024 * 1024) {
            throw new Error('File Excel quá lớn (trên 20MB).');
        }

        const bytes = new Uint8Array(await file.arrayBuffer());
        if (xlsIsCfb(bytes)) return { sheets: xlsParseSheets(bytes) };
        if (xlsIsZip(bytes)) return { sheets: await parseXlsxSheets(bytes) };

        if (name.endsWith('.xls')) {
            const text = decodeTextBytes(bytes);
            if (/^\s*</.test(text)) {
                const xmlRows = parseSpreadsheetXmlText(text);
                if (xmlRows.length) return { sheets: [{ name: 'Dữ liệu', rows: xmlRows }] };
                const htmlRows = parseHtmlTableText(text);
                if (htmlRows.length) return { sheets: [{ name: 'Dữ liệu', rows: htmlRows }] };
                throw new Error('File .xls dạng XML/HTML chưa đọc được. Hãy mở bằng Excel và lưu lại thành .xlsx hoặc .csv.');
            }
            return { sheets: [{ name: 'Dữ liệu', rows: parseSheetText(text) }] };
        }

        throw new Error('Không phải file Excel .xlsx hợp lệ. Hãy kiểm tra lại file hoặc lưu thành .csv.');
    }

    const text = await readFileAsText(file);
    return { sheets: [{ name: 'Dữ liệu', rows: parseSheetText(text) }] };
}
