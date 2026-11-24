import { useMemo, useRef, useState } from 'react';
import {
  Building2,
  Check,
  ChevronDown,
  DoorOpen,
  Download,
  Eye,
  Filter,
  GraduationCap,
  IdCard,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  UserPlus,
  Users,
  UsersRound,
  X
} from 'lucide-react';
import {
  groupStudentsByPlatoon,
  groupStudentsByRoom,
  LEADER_POSITIONS,
  isLeaderPosition,
  STUDENT_INFO_FIELDS,
  type Student,
  type StudentMissingFilter,
  type StudentPlatoonGroup,
  type StudentRoomGroup
} from '../../students';
import {
  selectFilteredStudents,
  selectStudentFacets,
  selectStudentStats,
  useAppStore
} from '../../store/useAppStore';
import { exportStudentsCSV } from '../../lib/export';
import { UNIT_LEGEND, UNIT_RULE, unitCode, unitFull, unitLabel } from '../../lib/units';
import { Segmented } from '../ui/Segmented';
import { EmptyState } from '../ui/EmptyState';
import { StudentDetail } from '../students/StudentDetail';

function initials(name: string): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'SV';
  return (parts[parts.length - 1][0] + (parts.length > 1 ? parts[0][0] : '')).toUpperCase();
}

function positionClass(position: string): string {
  if (position.includes('Phó đại đội')) return 'pos-deputy';
  if (position.includes('Trung đội')) return 'pos-company';
  if (position.includes('Tiểu đội')) return 'pos-squad';
  return 'pos-member';
}

function StudentCard({
  student,
  selected,
  onToggle,
  onView,
  onEdit,
  onDelete,
  onClearPosition
}: {
  student: Student;
  selected: boolean;
  onToggle: () => void;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClearPosition?: () => void;
}) {
  const extraInfo = [
    { label: 'Lớp', value: student.className },
    { label: 'Trường', value: student.school },
    { label: 'Ngày sinh', value: student.birthDate },
    { label: 'Quê quán', value: student.hometown },
    { label: 'Giới tính', value: student.gender },
    { label: 'Dân tộc', value: student.ethnicity },
    { label: 'CCCD', value: student.cccd }
  ].filter(item => Boolean(item.value));

  return (
    <article className={`student-card ${selected ? 'selected' : ''}`}>
      <label className="student-check">
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Chọn ${student.name}`} />
        <span className="student-avatar">{initials(student.name)}</span>
      </label>
      <div className="student-main">
        <div className="student-name-row">
          <strong>{student.name}</strong>
          {student.code ? <span className="student-code">{student.code}</span> : null}
          <span className={`position-badge ${positionClass(student.position)}`}>{student.position}</span>
        </div>
        <div className="student-meta">
          {student.building || student.room ? (
            <span><Building2 size={13} /> {student.building || '—'} {student.room ? `· P.${student.room}` : ''}</span>
          ) : null}
          {student.daiDoi ? <span title={unitFull('daiDoi', student.daiDoi)}><Users size={13} /> {unitCode('daiDoi', student.daiDoi)}</span> : null}
          {student.trungDoi ? <span title={unitFull('trungDoi', student.trungDoi)}><UsersRound size={13} /> {unitCode('trungDoi', student.trungDoi)}</span> : null}
          {student.tieuDoi ? <span title={unitFull('tieuDoi', student.tieuDoi)}><GraduationCap size={13} /> {unitCode('tieuDoi', student.tieuDoi)}</span> : null}
          {student.phone ? <span><Phone size={13} /> {student.phone}</span> : null}
        </div>
        {extraInfo.length ? (
          <div className="student-extra">
            {extraInfo.map(item => (
              <span key={item.label}>
                <span className="student-extra-label">{item.label}</span>
                {item.value}
              </span>
            ))}
          </div>
        ) : null}
        {student.note ? <p className="student-note">{student.note}</p> : null}
      </div>
      <div className="student-actions">
        {onClearPosition ? (
          <button type="button" className="icon-button" onClick={onClearPosition} title="Bỏ chức vụ" aria-label={`Bỏ chức vụ ${student.name}`}>
            <X size={15} />
          </button>
        ) : null}
        <button type="button" className="icon-button" onClick={onView} title="Xem thông tin" aria-label={`Xem thông tin ${student.name}`}>
          <Eye size={15} />
        </button>
        <button type="button" className="icon-button" onClick={onEdit} title="Sửa sinh viên" aria-label={`Sửa ${student.name}`}>
          <Pencil size={15} />
        </button>
        <button type="button" className="icon-button danger" onClick={onDelete} title="Xóa sinh viên" aria-label={`Xóa ${student.name}`}>
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}

export function StudentsPage() {
  const record = useAppStore(state => state.record);
  const studentSearch = useAppStore(state => state.studentSearch);
  const studentBuilding = useAppStore(state => state.studentBuilding);
  const studentRoom = useAppStore(state => state.studentRoom);
  const studentPlatoon = useAppStore(state => state.studentPlatoon);
  const studentTieuDoi = useAppStore(state => state.studentTieuDoi);
  const studentDaiDoi = useAppStore(state => state.studentDaiDoi);
  const studentMissing = useAppStore(state => state.studentMissing);
  const groupMode = useAppStore(state => state.studentGroupMode);
  const tab = useAppStore(state => state.studentTab);
  const selectedIds = useAppStore(state => state.studentSelectedIds);
  const importBusy = useAppStore(state => state.importBusy);
  const setStudentSearch = useAppStore(state => state.setStudentSearch);
  const setStudentBuilding = useAppStore(state => state.setStudentBuilding);
  const setStudentRoom = useAppStore(state => state.setStudentRoom);
  const setStudentPlatoon = useAppStore(state => state.setStudentPlatoon);
  const setStudentTieuDoi = useAppStore(state => state.setStudentTieuDoi);
  const setStudentDaiDoi = useAppStore(state => state.setStudentDaiDoi);
  const setStudentMissing = useAppStore(state => state.setStudentMissing);
  const setGroupMode = useAppStore(state => state.setStudentGroupMode);
  const setTab = useAppStore(state => state.setStudentTab);
  const toggleSelected = useAppStore(state => state.toggleStudentSelected);
  const selectVisible = useAppStore(state => state.selectVisibleStudents);
  const clearSelection = useAppStore(state => state.clearStudentSelection);
  const resetFilters = useAppStore(state => state.resetStudentFilters);
  const openEditor = useAppStore(state => state.openStudentEditor);
  const deleteStudents = useAppStore(state => state.deleteStudents);
  const setStudentPosition = useAppStore(state => state.setStudentPosition);
  const bulkAssignPosition = useAppStore(state => state.bulkAssignPosition);
  const importStudents = useAppStore(state => state.importStudents);
  const notify = useAppStore(state => state.notify);
  const confirmAction = useAppStore(state => state.confirmAction);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bulkPosition, setBulkPosition] = useState('Học viên');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [detailId, setDetailId] = useState<string | null>(null);

  const students = useMemo(() => selectFilteredStudents({
    record,
    studentSearch,
    studentBuilding,
    studentRoom,
    studentPlatoon,
    studentTieuDoi,
    studentDaiDoi,
    studentMissing
  }), [record, studentSearch, studentBuilding, studentRoom, studentPlatoon, studentTieuDoi, studentDaiDoi, studentMissing]);
  const facets = useMemo(() => selectStudentFacets(record), [record]);
  const stats = useMemo(() => selectStudentStats(record), [record]);
  const leaderStudents = useMemo(() => students.filter(student => isLeaderPosition(student.position)), [students]);
  const roomGroups = useMemo(() => groupStudentsByRoom(students), [students]);
  const platoonGroups = useMemo(() => groupStudentsByPlatoon(students), [students]);
  const leadersByPosition = useMemo(() => LEADER_POSITIONS.map(position => ({
    position,
    students: leaderStudents.filter(student => student.position === position)
  })).filter(group => group.students.length), [leaderStudents]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const groups: Array<StudentRoomGroup | StudentPlatoonGroup> = groupMode === 'room' ? roomGroups : platoonGroups;
  const detailStudent = useMemo(
    () => detailId ? record.students.find(student => student.id === detailId) || null : null,
    [detailId, record.students]
  );
  const allVisibleSelected = students.length > 0 && students.every(student => selectedSet.has(student.id));
  const hasFilters = Boolean(studentSearch)
    || studentBuilding !== 'ALL'
    || studentRoom !== 'ALL'
    || studentPlatoon !== 'ALL'
    || studentTieuDoi !== 'ALL'
    || studentDaiDoi !== 'ALL'
    || studentMissing !== 'ALL';

  const askDelete = async (student: Student) => {
    const ok = await confirmAction({
      title: 'Xóa sinh viên',
      message: `Xóa ${student.name} khỏi danh sách của khóa này? Bạn có thể hoàn tác ngay sau đó.`,
      confirmLabel: 'Xóa',
      danger: true
    });
    if (ok) deleteStudents([student.id]);
  };

  const askBulkDelete = async () => {
    const ok = await confirmAction({
      title: 'Xóa sinh viên đã chọn',
      message: `Xóa ${selectedIds.length} sinh viên đã chọn khỏi danh sách? Bạn có thể hoàn tác ngay sau đó.`,
      confirmLabel: 'Xóa',
      danger: true
    });
    if (ok) deleteStudents(selectedIds);
  };

  const exportCurrent = () => {
    if (!students.length) {
      notify('Chưa có sinh viên để xuất.', 'error');
      return;
    }
    exportStudentsCSV({ ...record, students }, tab === 'leaders');
    notify(tab === 'leaders' ? 'Đã xuất CSV ban cán sự.' : 'Đã xuất CSV sinh viên.', 'success');
  };

  const renderStudent = (student: Student, leaderMode = false) => (
    <StudentCard
      key={student.id}
      student={student}
      selected={selectedSet.has(student.id)}
      onToggle={() => toggleSelected(student.id)}
      onView={() => setDetailId(student.id)}
      onEdit={() => openEditor(student.id)}
      onDelete={() => askDelete(student)}
      onClearPosition={leaderMode ? () => setStudentPosition(student.id, 'Học viên') : undefined}
    />
  );

  return (
    <div className="page-stack students-page">
      <section className="page-heading">
        <div>
          <span className="section-eyebrow">Hồ sơ sinh viên</span>
          <h1>Danh sách sinh viên</h1>
          <p>Quản lý phòng, đại đội, trung đội, tiểu đội và ban cán sự. Quy ước: {UNIT_LEGEND}. {UNIT_RULE} Dữ liệu dùng chung với bảng điểm và chế độ cộng tác.</p>
        </div>
        <div className="page-heading-actions">
          <select className="compact-select" value={importMode} onChange={event => setImportMode(event.target.value as 'merge' | 'replace')} aria-label="Chế độ nhập sinh viên">
            <option value="merge">Cập nhật</option>
            <option value="replace">Thay thế</option>
          </select>
          <button type="button" className="btn btn-soft" onClick={() => fileRef.current?.click()} disabled={importBusy}>
            <Upload size={16} /> {importBusy ? 'Đang nhập...' : 'Nhập file'}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => openEditor()}>
            <UserPlus size={16} /> Thêm sinh viên
          </button>
        </div>
      </section>

      <section className="student-stats">
        <button type="button" className="student-stat" onClick={resetFilters}>
          <span className="student-stat-icon"><Users size={18} /></span>
          <span><strong>{stats.total}</strong><small>Tổng sinh viên</small></span>
        </button>
        <button type="button" className="student-stat" onClick={() => { resetFilters(); setTab('leaders'); }}>
          <span className="student-stat-icon gold"><GraduationCap size={18} /></span>
          <span><strong>{stats.leaders}</strong><small>Ban cán sự</small></span>
        </button>
        <button type="button" className="student-stat" onClick={() => { resetFilters(); setStudentRoom('__none__'); }}>
          <span className="student-stat-icon red"><DoorOpen size={18} /></span>
          <span><strong>{stats.noRoom}</strong><small>Chưa xếp phòng</small></span>
        </button>
        <button type="button" className="student-stat" onClick={() => { resetFilters(); setStudentPlatoon('__none__'); }}>
          <span className="student-stat-icon blue"><UsersRound size={18} /></span>
          <span><strong>{stats.noPlatoon}</strong><small>Chưa xếp b</small></span>
        </button>
        <button type="button" className="student-stat" onClick={() => { resetFilters(); setTab('students'); setStudentMissing('cccd'); }}>
          <span className="student-stat-icon gold"><IdCard size={18} /></span>
          <span><strong>{stats.missingCccd}</strong><small>Thiếu CCCD</small></span>
        </button>
        <button type="button" className="student-stat" onClick={() => { resetFilters(); setTab('students'); setStudentMissing('hometown'); }}>
          <span className="student-stat-icon red"><MapPin size={18} /></span>
          <span><strong>{stats.missingHometown}</strong><small>Thiếu quê quán</small></span>
        </button>
      </section>

      <section className="filter-panel student-filter-panel">
        <div className="search-box">
          <Search size={18} />
          <input
            type="search"
            value={studentSearch}
            onChange={event => setStudentSearch(event.target.value)}
            placeholder="Tìm tên, mã SV, CCCD, quê quán, lớp, phòng, SĐT..."
            aria-label="Tìm sinh viên"
          />
          {studentSearch ? (
            <button type="button" className="search-clear" onClick={() => setStudentSearch('')} aria-label="Xóa tìm kiếm">
              <X size={16} />
            </button>
          ) : null}
        </div>
        <div className="filter-actions">
          <button type="button" className={`toggle-pill ${filtersOpen ? 'active' : ''}`} onClick={() => setFiltersOpen(value => !value)}>
            <SlidersHorizontal size={15} /> Bộ lọc <ChevronDown size={14} className={filtersOpen ? 'rotate' : ''} />
          </button>
          {hasFilters ? (
            <button type="button" className="text-button danger-text" onClick={resetFilters}>
              <X size={14} /> Xóa lọc
            </button>
          ) : null}
        </div>
      </section>

      {filtersOpen ? (
        <section className="student-filter-grid">
          <label className="compact-field">
            <span>Tòa</span>
            <select value={studentBuilding} onChange={event => setStudentBuilding(event.target.value)}>
              <option value="ALL">Tất cả tòa</option>
              {facets.buildings.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="compact-field">
            <span>Phòng</span>
            <select value={studentRoom} onChange={event => setStudentRoom(event.target.value)}>
              <option value="ALL">Tất cả phòng</option>
              <option value="__none__">Chưa xếp phòng</option>
              {facets.rooms.map(value => <option key={value} value={value}>P. {value}</option>)}
            </select>
          </label>
          <label className="compact-field">
            <span>{unitLabel('daiDoi')}</span>
            <select value={studentDaiDoi} onChange={event => setStudentDaiDoi(event.target.value)}>
              <option value="ALL">Tất cả c</option>
              <option value="__none__">Chưa xếp c</option>
              {facets.daiDois.map(value => <option key={value} value={value}>{unitCode('daiDoi', value)}</option>)}
            </select>
          </label>
          <label className="compact-field">
            <span>{unitLabel('trungDoi')}</span>
            <select value={studentPlatoon} onChange={event => setStudentPlatoon(event.target.value)}>
              <option value="ALL">Tất cả b</option>
              <option value="__none__">Chưa xếp b</option>
              {facets.platoons.map(value => <option key={value} value={value}>{unitCode('trungDoi', value)}</option>)}
            </select>
          </label>
          <label className="compact-field">
            <span>{unitLabel('tieuDoi')}</span>
            <select value={studentTieuDoi} onChange={event => setStudentTieuDoi(event.target.value)}>
              <option value="ALL">Tất cả a</option>
              <option value="__none__">Chưa xếp a</option>
              {facets.tieuDois.map(value => <option key={value} value={value}>{unitCode('tieuDoi', value)}</option>)}
            </select>
          </label>
          <label className="compact-field">
            <span>Thiếu thông tin</span>
            <select value={studentMissing} onChange={event => setStudentMissing(event.target.value as StudentMissingFilter)}>
              <option value="ALL">Không lọc</option>
              {STUDENT_INFO_FIELDS.map(field => (
                <option key={field.key} value={field.key}>Thiếu {field.label.toLowerCase()}</option>
              ))}
            </select>
          </label>
        </section>
      ) : null}

      <div className="student-toolbar">
        <Segmented
          value={tab}
          onChange={value => setTab(value)}
          ariaLabel="Nhóm sinh viên"
          options={[
            { value: 'students', label: `Sinh viên (${stats.total})`, icon: <Users size={15} /> },
            { value: 'leaders', label: `Ban cán sự (${stats.leaders})`, icon: <GraduationCap size={15} /> }
          ]}
        />
        <div className="student-toolbar-right">
          {tab === 'students' ? (
            <Segmented
              value={groupMode}
              onChange={value => setGroupMode(value)}
              ariaLabel="Cách nhóm sinh viên"
              options={[
                { value: 'room', label: 'Theo phòng', icon: <Building2 size={14} /> },
                { value: 'platoon', label: 'Theo b', icon: <UsersRound size={14} /> }
              ]}
            />
          ) : null}
          <button type="button" className="text-button" onClick={exportCurrent}>
            <Download size={15} /> Xuất CSV
          </button>
          <button type="button" className="text-button" onClick={() => selectVisible(allVisibleSelected ? [] : students.map(student => student.id))}>
            <Check size={15} /> {allVisibleSelected ? 'Bỏ chọn' : 'Chọn tất cả'}
          </button>
        </div>
      </div>

      {tab === 'leaders' ? (
        leaderStudents.length ? (
          <div className="leader-groups">
            {leadersByPosition.map(group => (
              <section key={group.position} className="leader-group">
                <div className="group-head">
                  <div>
                    <span className={`position-badge ${positionClass(group.position)}`}>{group.position}</span>
                    <strong>{group.students.length} cán sự</strong>
                  </div>
                </div>
                <div className="student-list">{group.students.map(student => renderStudent(student, true))}</div>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<GraduationCap size={28} />}
            title="Chưa có ban cán sự"
            description="Mở hồ sơ sinh viên và chọn chức vụ Tiểu đội trưởng, Trung đội trưởng hoặc Phó đại đội trưởng."
            action={<button type="button" className="btn btn-soft" onClick={() => openEditor(null, 'Tiểu đội trưởng')}><Plus size={16} /> Thêm cán sự</button>}
          />
        )
      ) : students.length ? (
        <div className="student-groups">
          {groups.map(group => (
            <section key={group.key} className="student-group">
              <div className="group-head">
                <div>
                  {'building' in group ? (
                    <>
                      <strong>{group.building || 'Chưa xếp tòa'} {group.room ? `· P.${group.room}` : ''}</strong>
                      <span>{group.students.length} sinh viên</span>
                    </>
                  ) : (
                    <>
                      <strong title={group.trungDoi ? unitFull('trungDoi', group.trungDoi) : undefined}>
                        {group.trungDoi ? unitCode('trungDoi', group.trungDoi) : 'Chưa xếp b'}
                        {group.daiDoi ? ` · ${unitCode('daiDoi', group.daiDoi)}` : ''}
                      </strong>
                      <span>{group.students.length} sinh viên · {group.buildings.join(', ') || 'Chưa xếp tòa'}</span>
                    </>
                  )}
                </div>
                <div className="group-chips">
                  {'daiDois' in group
                    ? group.daiDois.slice(0, 3).map(value => <span key={`c-${value}`} title={unitFull('daiDoi', value)}>{unitCode('daiDoi', value)}</span>)
                    : group.daiDoi ? <span title={unitFull('daiDoi', group.daiDoi)}>{unitCode('daiDoi', group.daiDoi)}</span> : null}
                  {'trungDois' in group ? group.trungDois.slice(0, 3).map(value => <span key={`b-${value}`} title={unitFull('trungDoi', value)}>{unitCode('trungDoi', value)}</span>) : null}
                  {group.tieuDois?.slice(0, 3).map(value => <span key={`a-${value}`} title={unitFull('tieuDoi', value)}>{unitCode('tieuDoi', value)}</span>)}
                </div>
              </div>
              <div className="student-list">{group.students.map(student => renderStudent(student))}</div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Filter size={28} />}
          title={hasFilters ? 'Không tìm thấy sinh viên phù hợp' : 'Chưa có sinh viên'}
          description={hasFilters ? 'Thử xóa bộ lọc hoặc tìm bằng từ khóa khác.' : 'Nhập file Excel hoặc thêm sinh viên đầu tiên để bắt đầu.'}
          action={hasFilters
            ? <button type="button" className="btn btn-soft" onClick={resetFilters}>Xóa bộ lọc</button>
            : <button type="button" className="btn btn-primary" onClick={() => openEditor()}><UserPlus size={16} /> Thêm sinh viên</button>}
        />
      )}

      {selectedIds.length ? (
        <div className="bulk-bar">
          <div className="bulk-count"><Check size={16} /> Đã chọn <strong>{selectedIds.length}</strong></div>
          <div className="bulk-actions">
            <select value={bulkPosition} onChange={event => setBulkPosition(event.target.value)} aria-label="Chức vụ cần gán">
              <option value="Học viên">Học viên</option>
              <option value="Tiểu đội trưởng">Tiểu đội trưởng</option>
              <option value="Trung đội trưởng">Trung đội trưởng</option>
              <option value="Phó đại đội trưởng">Phó đại đội trưởng</option>
            </select>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => bulkAssignPosition(selectedIds, bulkPosition)}>
              Gán chức vụ
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={askBulkDelete}>
              <Trash2 size={15} /> Xóa
            </button>
            <button type="button" className="icon-button" onClick={clearSelection} aria-label="Bỏ chọn">
              <X size={17} />
            </button>
          </div>
        </div>
      ) : null}

      <StudentDetail
        student={detailStudent}
        onClose={() => setDetailId(null)}
        onEdit={() => {
          if (!detailStudent) return;
          const id = detailStudent.id;
          setDetailId(null);
          openEditor(id);
        }}
      />

      <input
        ref={fileRef}
        type="file"
        accept=".xls,.xlsx,.csv,.tsv,text/csv"
        multiple
        hidden
        onChange={async event => {
          const files = Array.from(event.target.files || []);
          event.target.value = '';
          if (files.length) await importStudents(files, importMode);
        }}
      />
    </div>
  );
}
