# Bảng Thi Đua GDQP&AN

Công cụ chấm điểm thi đua trung đội dạng **một file HTML tự chứa**, không dùng CDN, không cần cài đặt. Dữ liệu được lưu tự động trong trình duyệt trên thiết bị người dùng.

## Dùng online

Mở: **https://dillysluvu.github.io/thi-dua-gdqp/**

Có thể dùng trực tiếp trên điện thoại, máy tính bảng hoặc máy tính. Nên thêm trang vào màn hình chính (Add to Home Screen) để mở nhanh.

## Tính năng chính

- Chấm điểm theo từng trung đội: học tập, rèn luyện, nội vụ vệ sinh, lễ tiết.
- Trừ điểm nhanh, ghi chú lý do, tự động xếp hạng và thống kê.
- Tìm kiếm không dấu theo số trung đội, tòa nhà, phòng hoặc ghi chú.
- Lọc theo tòa, đổi kiểu xem bảng/thẻ.
- Cấu hình tên khóa, đơn vị, điểm gốc, ngày chấm và danh sách trung đội để dùng lại cho khóa sau.
- Xuất/nhập file sao lưu `.json`, xuất `.csv`, in hoặc lưu PDF.
- Nhập dữ liệu từ Excel/Google Sheets: `.xls` (Excel 97-2003), `.xlsx`, `.csv`, `.tsv` hoặc dán trực tiếp.
- Tự nhận diện bảng điểm hoặc bảng nhà ở/biên chế để cập nhật danh sách trung đội.
- Giao diện tiếng Việt, tối ưu cho điện thoại.

## Nhập Excel / Google Sheets

Vào menu **⋮ → Nhập Excel / Google Sheets**.

- File Excel nhiều sheet: chọn **Trang tính** cần nhập trong hộp thoại.
- Bảng điểm nên có dòng tiêu đề với các cột: `TĐ`, `Tòa`, `Phòng`, `Quân số`, `Học tập`, `Rèn luyện`, `NVVS`, `Lễ tiết`, `Ghi chú`.
- Bảng nhà ở/biên chế có các cột `TT`, `trung đội`, `quân số`, `phòng ở`, `NHà` sẽ được tự động gộp theo trung đội (ví dụ `B1`, `B2`...).
- Có thể chọn **Cập nhật** (giữ danh sách hiện tại, chỉ sửa các trung đội có trong file) hoặc **Thay thế toàn bộ**.
- Luôn xem trước trước khi bấm **Nhập Dữ Liệu**.

## Dùng cho khóa sau

1. Tải file `index.html` trong repo về máy.
2. Đổi tên file, ví dụ `K338.html`. Mỗi tên file có vùng dữ liệu riêng trong trình duyệt, nên khóa mới không ghi đè khóa cũ.
3. Mở file, vào menu **⋮ → Cấu Hình Khóa Học** để đổi tên khóa, đơn vị, điểm gốc, ngày chấm và danh sách trung đội.
4. Xuất file `.json` của khóa cũ để sao lưu trước khi bắt đầu.
5. Khi cần cập nhật bản online, thay nội dung `index.html` trong repo bằng file mới.

## Quyền riêng tư

- Dữ liệu chấm điểm chỉ lưu trong `localStorage` của trình duyệt trên thiết bị đang dùng, không gửi lên máy chủ.
- Repo chỉ chứa giao diện và dữ liệu mẫu, **không chứa** danh sách cá nhân, số điện thoại, CCCD hay file Excel gốc.
- Xóa dữ liệu trình duyệt hoặc dùng chế độ ẩn danh có thể làm mất dữ liệu. Hãy xuất `.json` định kỳ để sao lưu.

## Nguồn

GitHub: https://github.com/dillysluvu/thi-dua-gdqp
