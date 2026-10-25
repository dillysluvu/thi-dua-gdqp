# Bảng Thi Đua GDQP&AN

Công cụ chấm điểm thi đua trung đội, chạy hoàn toàn trên trình duyệt. Dữ liệu được lưu tự động trong `localStorage` trên thiết bị người dùng, không gửi lên máy chủ.

## Dùng online

Mở: **https://dillysluvu.github.io/thi-dua-gdqp/**

Có thể dùng trực tiếp trên điện thoại, máy tính bảng hoặc máy tính. Nên thêm trang vào màn hình chính (Add to Home Screen) để mở nhanh.

## Tính năng chính

- Chấm điểm theo từng trung đội: học tập, rèn luyện, nội vụ vệ sinh, lễ tiết.
- Trừ điểm nhanh, ghi chú lý do, tự động xếp hạng và thống kê.
- Tìm kiếm không dấu theo số trung đội, tòa nhà, phòng hoặc ghi chú.
- Lọc theo tòa, đổi kiểu xem bảng/thẻ.
- Cấu hình tên khóa, đơn vị, điểm gốc, ngày chấm và danh sách trung đội.
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

1. Vào menu **⋮ → Xuất File Sao Lưu (.json)** để lưu dữ liệu khóa hiện tại.
2. Vào **⋮ → Cấu Hình Khóa Học**, đổi tên khóa, đơn vị, điểm gốc, ngày chấm và danh sách trung đội.
3. Nhập file Excel của khóa mới hoặc chỉnh trực tiếp trên giao diện.
4. Khi cần xem lại khóa cũ, dùng **Nhập File Sao Lưu (.json)**.

> Mỗi thiết bị/trình duyệt có vùng dữ liệu riêng. Hãy xuất `.json` định kỳ để sao lưu và để chuyển dữ liệu sang thiết bị khác.

## Phát triển

Dự án dùng **Vite + TypeScript**, mã nguồn tách thành các module trong `src/`:

```text
index.html                 # Khung giao diện
src/main.ts                # Điểm vào, import CSS và app
src/app.ts                 # Trạng thái, render, sự kiện, nhập/xuất
src/parsers.ts             # Đọc .xls, .xlsx, .csv, .tsv, HTML/XML
src/constants.ts           # Dữ liệu mẫu, preset 56 trung đội, alias cột
src/utils.ts               # Hàm tiện ích dùng chung
src/styles.css             # Toàn bộ giao diện
```

Cài đặt và chạy thử:

```bash
npm install
npm run dev        # chạy dev server
npm run typecheck  # kiểm tra TypeScript
npm run build      # build ra thư mục dist/
npm run preview    # xem thử bản build
```

## Triển khai

Mỗi lần push lên nhánh `main`, GitHub Actions sẽ tự động:

1. Cài dependencies bằng `npm ci`.
2. Chạy `npm run build`.
3. Deploy thư mục `dist/` lên GitHub Pages.

Cấu hình workflow nằm tại `.github/workflows/deploy.yml`. Không commit thư mục `dist/` hay `node_modules/`.

## Quyền riêng tư

- Dữ liệu chấm điểm chỉ lưu trong `localStorage` của trình duyệt trên thiết bị đang dùng, không gửi lên máy chủ.
- Repo chỉ chứa mã nguồn và dữ liệu mẫu, **không chứa** danh sách cá nhân, số điện thoại, CCCD hay file Excel gốc.
- Xóa dữ liệu trình duyệt hoặc dùng chế độ ẩn danh có thể làm mất dữ liệu. Hãy xuất `.json` định kỳ để sao lưu.

## Nguồn

GitHub: https://github.com/dillysluvu/thi-dua-gdqp
