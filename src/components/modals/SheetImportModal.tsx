import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  FileSpreadsheet,
  Save,
  Sparkles,
  Trash2,
  Upload
} from 'lucide-react';
import { parseSheetFile, parseSheetText } from '../../parsers';
import {
  buildSheetImport,
  chooseDefaultSheetIndex,
  deleteMappingPreset,
  readMappingPresets,
  sampleSheetText,
  saveMappingPreset,
  SHEET_FIELDS,
  type MappingPreset
} from '../../lib/sheetImport';
import { useAppStore } from '../../store/useAppStore';
import { formatNum } from '../../utils';
import { unitCode } from '../../lib/units';
import { Modal } from '../ui/Modal';
import { Segmented } from '../ui/Segmented';
import { Field } from '../ui/Field';

interface SheetOption {
  name: string;
  rows: string[][];
}

export function SheetImportModal() {
  const modal = useAppStore(state => state.modal);
  const record = useAppStore(state => state.record);
  const closeModal = useAppStore(state => state.closeModal);
  const applySheetImport = useAppStore(state => state.applySheetImport);
  const confirmAction = useAppStore(state => state.confirmAction);
  const notify = useAppStore(state => state.notify);

  const open = modal === 'importSheet';
  const fileRef = useRef<HTMLInputElement | null>(null);
  const skipAutoMapRef = useRef(false);
  const [tab, setTab] = useState<'file' | 'paste'>('file');
  const [sheets, setSheets] = useState<SheetOption[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [pasteText, setPasteText] = useState('');
  const [hasHeader, setHasHeader] = useState(true);
  const [manualMode, setManualMode] = useState(false);
  const [manualMap, setManualMap] = useState<Record<string, number>>({});
  const [manualHeaderIndex, setManualHeaderIndex] = useState(0);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [presets, setPresets] = useState<MappingPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [presetId, setPresetId] = useState('');

  const rows = useMemo(() => {
    if (tab === 'paste') return parseSheetText(pasteText);
    return sheets[sheetIndex]?.rows || [];
  }, [tab, pasteText, sheets, sheetIndex]);

  const rowsKey = useMemo(() => `${rows.length}:${rows.slice(0, 4).map(row => row.join('|')).join('::')}`, [rows]);

  const result = useMemo(() => buildSheetImport(
    rows,
    hasHeader,
    record.meta.autoNegative,
    manualMode ? manualMap : null,
    manualHeaderIndex
  ), [rows, hasHeader, record.meta.autoNegative, manualMode, manualMap, manualHeaderIndex]);

  const displayMap = manualMode ? manualMap : result.map;

  useEffect(() => {
    if (!open) return;
    setPresets(readMappingPresets());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (skipAutoMapRef.current) {
      skipAutoMapRef.current = false;
      return;
    }
    const auto = buildSheetImport(rows, hasHeader, record.meta.autoNegative);
    setManualMap(auto.map);
    setManualHeaderIndex(auto.headerIndex);
    setManualMode(false);
  }, [rowsKey, hasHeader, record.meta.autoNegative, open]);

  const reset = () => {
    setTab('file');
    setSheets([]);
    setSheetIndex(0);
    setPasteText('');
    setHasHeader(true);
    setManualMode(false);
    setManualMap({});
    setManualHeaderIndex(0);
    setMode('merge');
    setFileName('');
    setError('');
    setBusy(false);
    setPresetName('');
    setPresetId('');
  };

  const close = () => {
    reset();
    closeModal();
  };

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const workbook = await parseSheetFile(file);
      const options = workbook.sheets
        .map(sheet => ({ name: sheet.name, rows: sheet.rows }))
        .filter(sheet => sheet.rows.some(row => row.some(cell => String(cell || '').trim())));
      if (!options.length) {
        setError('File không có dữ liệu. Hãy kiểm tra lại trang tính hoặc chọn file khác.');
        setSheets([]);
        return;
      }
      const index = chooseDefaultSheetIndex(options);
      setSheets(options);
      setSheetIndex(index);
      setFileName(file.name);
      setTab('file');
    } catch (parseError) {
      setError((parseError as Error).message || 'Không đọc được file.');
      setSheets([]);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!result.entries.length) {
      setError('Chưa có dữ liệu hợp lệ để nhập.');
      return;
    }
    if (mode === 'replace') {
      const ok = await confirmAction({
        title: 'Thay thế bảng điểm',
        message: `Thay thế toàn bộ danh sách trung đội hiện tại bằng ${result.entries.length} trung đội từ ${fileName || 'dữ liệu dán'}?\nĐiểm của các trung đội không có trong file sẽ bị xóa. Bạn có thể hoàn tác bằng bản sao lưu tự động.`,
        confirmLabel: 'Thay thế',
        danger: true
      });
      if (!ok) return;
    }
    applySheetImport(result.entries, mode, fileName || 'dữ liệu dán');
    close();
  };

  const savePreset = () => {
    const name = presetName.trim();
    if (!name) {
      setError('Hãy nhập tên cho cách ghép cột.');
      return;
    }
    const preset: MappingPreset = {
      id: `map_${Date.now().toString(36)}`,
      name,
      map: { ...displayMap },
      hasHeader,
      headerIndex: manualHeaderIndex,
      createdAt: new Date().toISOString()
    };
    saveMappingPreset(preset);
    setPresets(readMappingPresets());
    setPresetName('');
    setPresetId(preset.id);
    notify('Đã lưu cách ghép cột.', 'success');
  };

  const applyPreset = (id: string) => {
    setPresetId(id);
    const preset = presets.find(item => item.id === id);
    if (!preset) return;
    skipAutoMapRef.current = true;
    setHasHeader(preset.hasHeader);
    setManualHeaderIndex(preset.headerIndex || 0);
    setManualMap({ ...preset.map });
    setManualMode(true);
  };

  const removePreset = () => {
    if (!presetId) return;
    deleteMappingPreset(presetId);
    setPresets(readMappingPresets());
    setPresetId('');
    notify('Đã xóa cách ghép cột.', 'success');
  };

  const previewEntries = result.entries.slice(0, 10);
  const columnOptions = (result.headerRow && result.headerRow.length
    ? result.headerRow
    : Array.from({ length: Math.max(...rows.map(row => row.length), 1) }, (_, index) => `Cột ${index + 1}`));

  return (
    <Modal
      open={open}
      onClose={close}
      title="Nhập Excel / Google Sheets"
      subtitle="Hỗ trợ .xls, .xlsx, .csv, .tsv hoặc dán trực tiếp từ Google Sheets. Hệ thống tự nhận diện cột và số b (trung đội), c (đại đội)."
      icon={<FileSpreadsheet size={20} />}
      size="xl"
      footer={
        <>
          <div className="modal-footer-info">
            {result.entries.length ? <span className="text-success"><CheckCircle2 size={15} /> {result.entries.length} b hợp lệ</span> : <span className="text-muted">Chưa có dữ liệu</span>}
            {result.errors.length ? <span className="text-danger"><AlertTriangle size={15} /> {result.errors.length} dòng lỗi</span> : null}
          </div>
          <button type="button" className="btn btn-ghost" onClick={close}>Hủy</button>
          <button type="button" className="btn btn-primary" onClick={apply} disabled={!result.entries.length || busy}>
            <Upload size={16} /> {mode === 'replace' ? 'Thay thế bảng điểm' : 'Cập nhật bảng điểm'}
          </button>
        </>
      }
    >
      <div className="sheet-import-top">
        <Segmented
          value={tab}
          onChange={value => { setTab(value); setError(''); }}
          ariaLabel="Nguồn dữ liệu"
          options={[
            { value: 'file', label: 'Tệp Excel', icon: <FileSpreadsheet size={15} /> },
            { value: 'paste', label: 'Dán dữ liệu', icon: <ClipboardPaste size={15} /> }
          ]}
        />
        <button type="button" className="text-button" onClick={() => { setTab('paste'); setPasteText(sampleSheetText()); }}>
          <Sparkles size={15} /> Dùng dữ liệu mẫu
        </button>
      </div>

      {error ? <div className="inline-alert error"><AlertTriangle size={16} /> {error}</div> : null}

      {tab === 'file' ? (
        <div className="sheet-file-area">
          <button type="button" className="dropzone" onClick={() => fileRef.current?.click()}>
            <span className="dropzone-icon"><FileSpreadsheet size={28} /></span>
            <strong>{busy ? 'Đang đọc file...' : fileName || 'Chọn file Excel hoặc CSV'}</strong>
            <span>Kéo thả hoặc chạm để chọn · tối đa 20MB · hỗ trợ .xls, .xlsx, .csv, .tsv</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xls,.xlsx,.csv,.tsv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            onChange={event => {
              const file = event.target.files?.[0];
              event.target.value = '';
              void chooseFile(file);
            }}
          />
          {sheets.length > 1 ? (
            <Field label="Trang tính" htmlFor="sheet-select" className="sheet-select-field">
              <select id="sheet-select" className="select-input" value={sheetIndex} onChange={event => setSheetIndex(Number(event.target.value))}>
                {sheets.map((sheet, index) => <option key={`${sheet.name}-${index}`} value={index}>{sheet.name} · {sheet.rows.length} dòng</option>)}
              </select>
            </Field>
          ) : null}
        </div>
      ) : (
        <div className="sheet-paste-area">
          <Field label="Dán dữ liệu từ Excel / Google Sheets" htmlFor="sheet-paste" hint="Mỗi dòng là một trung đội, các cột cách nhau bằng tab hoặc dấu phẩy.">
            <textarea
              id="sheet-paste"
              className="text-area paste-area"
              rows={9}
              value={pasteText}
              onChange={event => setPasteText(event.target.value)}
              placeholder={'b\\tc\\tTòa\\tPhòng\\tQuân số\\tHọc tập\\tRèn luyện\\tNVVS\\tLễ tiết\\tGhi chú'}
              spellCheck={false}
            />
          </Field>
        </div>
      )}

      <div className="sheet-options">
        <label className="checkbox-line">
          <input type="checkbox" checked={hasHeader} onChange={event => setHasHeader(event.target.checked)} />
          <span>Dòng đầu tiên là tiêu đề</span>
        </label>
        <label className="checkbox-line">
          <input type="checkbox" checked={manualMode} onChange={event => setManualMode(event.target.checked)} />
          <span>Ghép cột thủ công</span>
        </label>
        <div className="sheet-mode">
          <Segmented
            value={mode}
            onChange={value => setMode(value)}
            ariaLabel="Cách nhập dữ liệu"
            options={[
              { value: 'merge', label: 'Cập nhật' },
              { value: 'replace', label: 'Thay thế' }
            ]}
          />
        </div>
      </div>

      {manualMode ? (
        <section className="mapping-panel">
          <div className="mapping-head">
            <div>
              <h3>Ghép cột dữ liệu</h3>
              <p>Chọn cột tương ứng với từng trường. Cột số b (trung đội) là bắt buộc.</p>
            </div>
            {hasHeader ? (
              <label className="compact-field">
                <span>Dòng tiêu đề</span>
                <input className="text-input" type="number" min="1" value={manualHeaderIndex + 1} onChange={event => setManualHeaderIndex(Math.max(0, Number(event.target.value) - 1))} />
              </label>
            ) : null}
          </div>
          <div className="mapping-grid">
            {SHEET_FIELDS.map(field => (
              <label key={field.key} className="compact-field">
                <span>{field.label}{field.key === 'id' ? ' *' : ''}</span>
                <select
                  value={displayMap[field.key] ?? -1}
                  onChange={event => {
                    const next = { ...displayMap, [field.key]: Number(event.target.value) };
                    if (next[field.key] < 0) delete next[field.key];
                    setManualMap(next);
                    setManualMode(true);
                  }}
                >
                  <option value={-1}>Không dùng</option>
                  {columnOptions.map((column, index) => (
                    <option key={`${field.key}-${index}`} value={index}>{String(column || `Cột ${index + 1}`).slice(0, 40)}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="mapping-presets">
            <div className="mapping-preset-row">
              <input className="text-input" value={presetName} onChange={event => setPresetName(event.target.value)} placeholder="Tên cách ghép cột..." />
              <button type="button" className="btn btn-soft btn-sm" onClick={savePreset}><Save size={15} /> Lưu</button>
            </div>
            {presets.length ? (
              <div className="mapping-preset-row">
                <select className="select-input" value={presetId} onChange={event => applyPreset(event.target.value)}>
                  <option value="">Chọn cách ghép đã lưu...</option>
                  {presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                </select>
                <button type="button" className="icon-button danger" onClick={removePreset} disabled={!presetId} aria-label="Xóa cách ghép đã lưu"><Trash2 size={16} /></button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {result.fatal ? <div className="inline-alert error"><AlertTriangle size={16} /> {result.fatal}</div> : null}

      {result.errors.length ? (
        <section className="sheet-errors">
          <strong><AlertTriangle size={15} /> Dòng cần kiểm tra</strong>
          <div>{result.errors.slice(0, 12).map(error => <div key={error}>{error}</div>)}</div>
          {result.errors.length > 12 ? <span>... và {result.errors.length - 12} lỗi khác</span> : null}
        </section>
      ) : null}

      {previewEntries.length ? (
        <section className="sheet-preview">
          <div className="sheet-preview-head">
            <div>
              <h3>Xem trước dữ liệu nhập</h3>
              <p>{result.roomMode ? 'Nhận diện theo danh sách phòng/trung đội.' : 'Nhận diện theo bảng điểm.'} Hiển thị {previewEntries.length}/{result.entries.length} trung đội.</p>
            </div>
            <span className="mapping-summary">{SHEET_FIELDS.filter(field => displayMap[field.key] !== undefined).length} cột đã ghép</span>
          </div>
          <div className="sheet-preview-table-wrap">
            <table className="sheet-preview-table">
              <thead>
                <tr>
                  <th>b</th>
                  <th>c</th>
                  <th>Tòa</th>
                  <th>Phòng</th>
                  <th>Quân số</th>
                  <th>HT</th>
                  <th>RL</th>
                  <th>NVVS</th>
                  <th>LT</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {previewEntries.map(entry => (
                  <tr key={entry.id}>
                    <td><strong>{unitCode('trungDoi', entry.id)}</strong></td>
                    <td>{entry.daiDoi ? unitCode('daiDoi', entry.daiDoi) : '—'}</td>
                    <td>{entry.building || '—'}</td>
                    <td>{entry.rooms || '—'}</td>
                    <td>{entry.quanSo || '—'}</td>
                    <td>{entry.hocTap === undefined ? '—' : formatNum(entry.hocTap)}</td>
                    <td>{entry.renLuyen === undefined ? '—' : formatNum(entry.renLuyen)}</td>
                    <td>{entry.nvvs === undefined ? '—' : formatNum(entry.nvvs)}</td>
                    <td>{entry.leTiet === undefined ? '—' : formatNum(entry.leTiet)}</td>
                    <td>{entry.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </Modal>
  );
}
