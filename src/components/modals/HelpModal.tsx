import {
  BookOpen,
  CheckCircle2,
  Cloud,
  FileSpreadsheet,
  Keyboard,
  Moon,
  Smartphone,
  Users
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { UNIT_RULE } from '../../lib/units';
import { Modal } from '../ui/Modal';

export function HelpModal() {
  const modal = useAppStore(state => state.modal);
  const closeModal = useAppStore(state => state.closeModal);
  const open = modal === 'help';

  return (
    <Modal
      open={open}
      onClose={closeModal}
      title="Hướng dẫn sử dụng"
      subtitle="Thiết kế mobile-first: mọi thao tác chính đều dùng được bằng một tay trên điện thoại."
      icon={<BookOpen size={20} />}
      size="lg"
      footer={<button type="button" className="btn btn-primary" onClick={closeModal}>Đã hiểu</button>}
    >
      <div className="inline-alert info">
        <strong>Quy ước đơn vị:</strong>&nbsp;a = tiểu đội · b = trung đội · c = đại đội. Ví dụ a45, b12, c3. {UNIT_RULE}
      </div>
      <div className="help-grid">
        <section className="help-card">
          <span className="help-icon"><Smartphone size={20} /></span>
          <h3>Bắt đầu nhanh</h3>
          <ol>
            <li>Chọn khóa ở góc phải header hoặc tạo khóa mới trong <strong>Công cụ → Quản lý khóa học</strong>.</li>
            <li>Vào <strong>Cài đặt</strong> để nhập tên khóa, đơn vị, điểm gốc và danh sách trung đội.</li>
            <li>Mở <strong>Danh sách</strong> hoặc <strong>Bảng điểm</strong>, chạm vào trung đội để chấm.</li>
          </ol>
        </section>

        <section className="help-card">
          <span className="help-icon gold"><CheckCircle2 size={20} /></span>
          <h3>Chấm điểm</h3>
          <ul>
            <li>Chạm thẻ trung đội để mở phiếu chấm.</li>
            <li>Dùng nút trừ nhanh <strong>-0,1</strong>, <strong>-0,2</strong>, <strong>-0,5</strong>, <strong>-1</strong> hoặc nhập tay.</li>
            <li>Bật <strong>Tự âm</strong> để nhập số dương tự động thành điểm trừ.</li>
            <li>Bấm <strong>Lưu &amp; chấm tiếp</strong> để chuyển nhanh sang trung đội kế tiếp.</li>
          </ul>
        </section>

        <section className="help-card">
          <span className="help-icon blue"><FileSpreadsheet size={20} /></span>
          <h3>Nhập Excel / Google Sheets</h3>
          <ul>
            <li>Vào <strong>Công cụ → Nhập Excel / Google Sheets</strong>.</li>
            <li>Chọn file <strong>.xls, .xlsx, .csv, .tsv</strong> hoặc dán trực tiếp từ Google Sheets.</li>
            <li>Hệ thống tự nhận diện cột b (trung đội), c (đại đội), tòa, phòng, quân số và điểm. Có thể ghép cột thủ công nếu cần.</li>
            <li>Chọn <strong>Cập nhật</strong> để giữ trung đội cũ hoặc <strong>Thay thế</strong> để dùng đúng danh sách trong file.</li>
          </ul>
        </section>

        <section className="help-card">
          <span className="help-icon violet"><Users size={20} /></span>
          <h3>Sinh viên &amp; ban cán sự</h3>
          <ul>
            <li>Tab <strong>Sinh viên</strong> nhóm theo phòng hoặc trung đội, hỗ trợ chọn nhiều để gán chức vụ.</li>
            <li>Tab <strong>Ban cán sự</strong> chỉ hiển thị Tiểu đội trưởng, Trung đội trưởng, Phó đại đội trưởng.</li>
            <li>Nhập danh sách từ Excel với chế độ <strong>Cập nhật</strong> hoặc <strong>Thay thế</strong>.</li>
          </ul>
        </section>

        <section className="help-card">
          <span className="help-icon green"><Cloud size={20} /></span>
          <h3>Chia sẻ &amp; cộng tác</h3>
          <ul>
            <li><strong>Kết nối chia sẻ</strong> dùng máy chủ riêng hoặc Supabase.</li>
            <li>Nhiều người nhập cùng <strong>mã nhóm dữ liệu</strong> sẽ thấy cùng bảng điểm.</li>
            <li>Bật <strong>Cộng tác nhóm</strong> để đồng bộ trực tiếp qua WebSocket/Realtime.</li>
            <li>Luôn tạo <strong>bản sao lưu</strong> trước khi nhập thay thế hoặc kéo dữ liệu.</li>
          </ul>
        </section>

        <section className="help-card">
          <span className="help-icon dark"><Moon size={20} /></span>
          <h3>Giao diện &amp; phím tắt</h3>
          <ul>
            <li>Nút mặt trăng/mặt trời trên header đổi nhanh sáng/tối. Lựa chọn được ghi nhớ.</li>
            <li><kbd>Esc</kbd> đóng modal, phiếu chấm hoặc menu Công cụ.</li>
            <li><kbd>Enter</kbd> trong ô điểm để áp dụng nhanh.</li>
            <li>Dùng <strong>In / Lưu PDF</strong> trong Báo cáo để gửi kết quả.</li>
          </ul>
        </section>
      </div>

      <div className="help-footer-note">
        <Keyboard size={17} />
        <span>Mẹo: trên điện thoại, thêm ứng dụng vào màn hình chính để dùng như app ngoại tuyến. Dữ liệu vẫn được lưu trên thiết bị.</span>
      </div>
    </Modal>
  );
}
