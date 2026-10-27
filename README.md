# Bảng Thi Đua GDQP&AN

Công cụ chấm điểm và theo dõi thi đua trung đội GDQP&AN, chạy trên trình duyệt. Dữ liệu được lưu tự động trên thiết bị, có thể dùng nhiều khóa học, quản lý danh sách sinh viên/ban cán sự, sao lưu/khôi phục, khóa sổ, đồng bộ đám mây và cộng tác nhóm tùy chọn. Có thể dùng Supabase hoặc dựng **máy chủ riêng Node + SQLite** để nhiều người cùng làm việc trên một bản dữ liệu, với dung lượng dữ liệu/backup giới hạn 10GB.

## Dùng online

Mở: **https://dillysluvu.github.io/thi-dua-gdqp/**

Có thể dùng trên điện thoại, máy tính bảng hoặc máy tính. Trang có thể cài như ứng dụng (PWA) và vẫn mở được khi mất mạng sau lần truy cập đầu.

## Tính năng chính

### Chấm điểm và quản lý khóa

- Chấm điểm từng trung đội theo học tập, rèn luyện, nội vụ vệ sinh, lễ tiết.
- Trừ điểm nhanh, ghi chú lý do, tự động tính tổng điểm và xếp hạng.
- Tìm kiếm không dấu theo số trung đội, tòa nhà, phòng hoặc ghi chú.
- Lọc theo tòa, đổi kiểu xem bảng/thẻ.
- Quản lý nhiều khóa học: tạo mới, nhân bản, đổi tên, chuyển khóa và xóa khóa.
- Khóa mới dùng 56 trung đội mẫu; khóa nhân bản giữ cấu hình tòa/phòng/quân số nhưng đặt điểm về 0.
- Dữ liệu V2 cũ được tự động chuyển sang mô hình nhiều khóa V3, không xóa dữ liệu cũ.

### Danh sách sinh viên và ban cán sự

- Mở menu **⋮ → Danh Sách Sinh Viên & Cán Sự**.
- Nhập danh sách từ Excel/CSV với các cột họ tên, mã SV, tòa, phòng, tiểu đội, trung đội, chức vụ, số điện thoại, ghi chú; giữ thêm lớp, trường, ngày sinh, nơi sinh, giới tính, dân tộc, CCCD nếu có.
- Hỗ trợ mẫu **biên chế nhiều tiểu đội** của nhà trường: tự đọc từng khối “Danh sách biên chế tiểu đội”, ghép họ tên từ hai cột, nhận trung đội/tiểu đội/phòng/tòa và **giữ nguyên số tiểu đội gốc** liên tục (1, 2, 3, ... 168), không reset về 1–3 trong từng trung đội.
- Có thể chọn **nhiều file .xls/.xlsx cùng lúc** để nhập gộp (ví dụ file ĐHKT và file HVMM).
- Nếu đã nhập danh sách bằng bản 3.2 trở về trước, hãy nhập lại file biên chế ở chế độ **Cập nhật** một lần để thay số tiểu đội cũ (1–3 trong từng trung đội) bằng số tiểu đội gốc.
- Xem danh sách nhóm theo từng phòng hoặc theo trung đội; lọc nhanh cán sự, sinh viên chưa xếp phòng/trung đội; lọc theo tòa, phòng, trung đội, tiểu đội và tìm kiếm không dấu.
- Thêm, sửa, xóa sinh viên trực tiếp trên giao diện; kiểm tra trùng mã SV; **Lưu & Thêm tiếp** để nhập nhanh nhiều sinh viên; xóa có xác nhận và **Hoàn tác**.
- Chọn nhiều sinh viên bằng checkbox để **xóa hàng loạt** hoặc **gán chức vụ hàng loạt**; mở rộng phần thông tin bổ sung để sửa lớp, ngày sinh, CCCD...
- Gán chức vụ **Tiểu đội trưởng**, **Trung đội trưởng**, **Phó đại đội trưởng**; tab **Ban cán sự** có nút **Gán cán sự** để tìm sinh viên theo tên/mã và gán chức vụ, tránh tạo trùng sinh viên.
- Bấm **SV: n** trên thẻ hoặc bảng điểm để mở đúng danh sách sinh viên của trung đội đó.
- Xuất danh sách sinh viên hoặc ban cán sự ra CSV.

### Nhập và xuất dữ liệu

- Nhập Excel/Google Sheets: `.xls` (Excel 97-2003), `.xlsx`, `.csv`, `.tsv` hoặc dán trực tiếp.
- Tự nhận diện bảng điểm hoặc bảng nhà ở/biên chế để cập nhật danh sách trung đội.
- Ghép cột thủ công khi file có tên cột hoặc thứ tự cột khác chuẩn.
- Lưu mẫu ghép cột để dùng lại cho các khóa sau.
- Xem trước, báo lỗi theo từng dòng trước khi nhập.
- Xuất/nhập file sao lưu `.json`, xuất `.csv`, in hoặc lưu PDF.

### Sao lưu, nhật ký và khóa sổ

- Tự động tạo bản sao lưu đầu tiên và định kỳ khi có thay đổi.
- Tự sao lưu trước các thao tác quan trọng: nhập Excel, nhập JSON, đổi cấu hình, đặt lại điểm, khôi phục bản lưu.
- Danh sách tối đa 15 bản sao lưu gần nhất cho mỗi khóa; có thể khôi phục hoặc xóa từng bản.
- Nhật ký ghi lại người chấm, thời gian và nội dung các lần sửa điểm, quân số, cấu hình, nhập dữ liệu, khóa/mở khóa sổ.
- Khóa sổ điểm sau khi hoàn tất để chặn sửa điểm, sửa quân số, nhập Excel và đổi cấu hình.
- Xuất nhật ký ra CSV.

### PWA, đồng bộ đám mây và cộng tác nhóm

- Cài được lên màn hình chính, có service worker và hoạt động ngoại tuyến.
- Có chỉ báo khi đang ngoại tuyến.
- Đồng bộ đám mây tùy chọn qua Supabase hoặc **máy chủ riêng**: đẩy lên, kéo về, kiểm tra kết nối và tự động đẩy sau khi sửa.
- Cộng tác nhóm tùy chọn: nhiều người cùng sửa bảng điểm và danh sách sinh viên; thay đổi được báo qua Supabase Realtime hoặc WebSocket của máy chủ riêng, và vẫn tự đồng bộ mỗi 15 giây nếu realtime không khả dụng.
- Máy chủ riêng dùng Node + SQLite, nhẹ, không cần Docker; dữ liệu và backup được giới hạn theo `MAX_DATA_BYTES` (mặc định 10GB).
- Không cấu hình đám mây/máy chủ vẫn dùng bình thường; dữ liệu chính vẫn nằm trên thiết bị.

## Dùng cho khóa sau

1. Vào menu **⋮ → Quản Lý Khóa Học**.
2. Bấm **Tạo khóa mới**, nhập tên khóa (ví dụ `K338`), hoặc **Nhân bản** khóa hiện tại nếu muốn giữ cấu hình tòa/phòng/quân số.
3. Chọn khóa vừa tạo ở ô **Khóa** trên header.
4. Vào **⋮ → Cấu Hình Khóa Học** để đổi đơn vị, điểm gốc, ngày chấm và danh sách trung đội.
5. Nhập Excel của khóa mới hoặc chỉnh trực tiếp trên giao diện.
6. Vào **⋮ → Danh Sách Sinh Viên & Cán Sự** để nhập danh sách sinh viên và gán chức vụ ban cán sự.
7. Sau khi chấm xong, vào **⋮ → Nhật Ký & Khóa Sổ** để khóa sổ.
8. Xuất **File Sao Lưu (.json)** để lưu thêm ra ngoài thiết bị.

> Mỗi thiết bị/trình duyệt có vùng dữ liệu riêng. Nên xuất `.json` định kỳ và trước khi đổi máy.

## Nhập Excel / Google Sheets

Vào menu **⋮ → Nhập Excel / Google Sheets**.

- File Excel nhiều sheet: chọn **Trang tính** cần nhập.
- Bảng điểm nên có dòng tiêu đề với các cột: `TĐ`, `Tòa`, `Phòng`, `Quân số`, `Học tập`, `Rèn luyện`, `NVVS`, `Lễ tiết`, `Ghi chú`.
- Bảng nhà ở/biên chế có các cột `TT`, `trung đội`, `quân số`, `phòng ở`, `Nhà` sẽ được tự động gộp theo trung đội.
- Có thể chọn **Cập nhật** (giữ danh sách hiện tại, chỉ sửa các trung đội có trong file) hoặc **Thay thế toàn bộ**.
- Nếu file không nhận diện đúng, mở **Ghép cột thủ công & mẫu mapping**, chọn đúng cột cho từng trường rồi bấm **Lưu mẫu** để dùng lại.
- Luôn xem trước và kiểm tra lỗi từng dòng trước khi bấm **Nhập Dữ Liệu**.

## Nhập danh sách sinh viên

Vào menu **⋮ → Danh Sách Sinh Viên & Cán Sự → Nhập Excel/CSV**.

- Cột bắt buộc: **Họ tên**. Các cột còn lại là tùy chọn.
- Tên cột được nhận diện tự động: `Họ tên`, `Mã SV`, `Tòa`, `Phòng`, `Tiểu đội`, `Trung đội`, `Chức vụ`, `SĐT`, `Ghi chú`, `Lớp`, `Trường`, `Ngày sinh`, `Nơi sinh`, `Giới tính`, `Dân tộc`, `CCCD`.
- Nếu file không có dòng tiêu đề, ứng dụng đọc theo thứ tự cột mặc định ở trên.
- Chế độ **Cập nhật** giữ sinh viên hiện có và cập nhật theo mã SV; sinh viên chưa có mã mới đối chiếu theo họ tên + phòng. Chế độ **Thay thế** xóa danh sách cũ rồi nhập mới. Khi cập nhật, chức vụ cán sự, SĐT và ghi chú đã nhập tay được giữ lại nếu file mới để trống.
- Có thể chọn nhiều file cùng lúc. Với file có cả sheet `Bienche` và `Nha o`, nên nhập sheet `Bienche` ở mục **Nhập danh sách sinh viên** và nhập sheet `Nha o` ở mục **Nhập Excel / Google Sheets** để cập nhật danh sách trung đội.
- Với mẫu biên chế, ứng dụng tự nhận:
  - dòng `Danh sách biên chế tiểu đội` và `Trung đội`;
  - họ tên ghép từ cột họ đệm + cột tên;
  - phòng/tòa từ dòng `Phòng ở` và cột phòng của từng sinh viên;
  - tiểu đội gốc được giữ nguyên (ví dụ 46, 47, 48; hoặc 1, 2, 3, ... 12, ... 168), không đánh số lại theo từng trung đội;
  - trưởng nếu file có ghi tên ở dòng `Trung đội trưởng` / `Tiểu đội trưởng`.
- Có thể xuất CSV để chỉnh sửa hàng loạt rồi nhập lại. File CSV có thêm các cột thông tin phụ; hãy giữ nguyên thứ tự cột khi nhập lại.

## Cài đặt PWA / dùng ngoại tuyến

- Trên điện thoại: mở trang bằng Chrome/Safari, chọn **Thêm vào màn hình chính**.
- Trên máy tính: dùng biểu tượng cài đặt trên thanh địa chỉ của Chrome/Edge.
- Sau lần mở đầu tiên, ứng dụng có thể tải lại khi không có mạng. Dữ liệu vẫn được lưu cục bộ.

## Dùng chung một bản bằng máy chủ riêng (khuyến nghị)

Repo có sẵn backend nhỏ **Node.js + SQLite + WebSocket** trong thư mục `server/`, không cần Docker hay Supabase. Máy chủ phục vụ luôn giao diện đã build và giới hạn tổng dữ liệu + backup theo `MAX_DATA_BYTES` (mặc định **10GB**).

Chạy thử:

```bash
npm install
npm run build
ACCESS_CODE='doi-ma-truy-cap' \
DATA_DIR="$HOME/.local/share/thi-dua-gdqp" \
MAX_DATA_BYTES=10737418240 \
npm run server
```

Mở `http://127.0.0.1:8787`, vào **⋮ → Kết Nối Chia Sẻ**, chọn **Máy chủ riêng**, nhập địa chỉ máy chủ, mã truy cập và **mã nhóm / bản dùng chung**. Mọi người dùng cùng ba thông tin này sẽ làm việc trên cùng một bản. Sau đó vào **⋮ → Cộng Tác Nhóm** và bật cộng tác.

- Dữ liệu chính: `DATA_DIR/thi-dua.sqlite`; backup tự động mỗi 24 giờ, giữ 14 bản.
- Server trả lỗi `507` khi vượt 10GB và có `GET /api/usage` để xem dung lượng.
- Có thể chạy nền bằng systemd và mở ra Internet bằng Cloudflare Tunnel.
- Hướng dẫn đầy đủ: [`server/README.md`](server/README.md).

## Đồng bộ đám mây với Supabase (tùy chọn)

Ứng dụng là trang tĩnh trên GitHub Pages nên không có backend riêng. Có thể dùng Supabase làm nơi lưu bản sao:

1. Tạo project Supabase.
2. Mở **SQL Editor** và chạy:

```sql
create table public.course_sync (
  id text primary key,
  course_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.course_sync enable row level security;

create policy "course_sync_all" on public.course_sync
  for all using (true) with check (true);
```

3. Vào **⋮ → Kết Nối Chia Sẻ**, chọn **Supabase**, nhập URL project, anon key, tên bảng `course_sync` và mã nhóm đồng bộ.
4. Bấm **Kiểm tra kết nối**, sau đó **Đẩy lên** hoặc **Kéo về**.

Lưu ý: anon key dùng trong ứng dụng tĩnh là công khai. Policy mở `using (true)` chỉ phù hợp cho dữ liệu nội bộ hoặc thử nghiệm. Với dữ liệu nhạy cảm, cần backend trung gian hoặc policy giới hạn theo người dùng.

## Cộng tác nhóm (nhiều người cùng sửa)

Có thể cộng tác qua **Supabase** (dùng bảng `course_sync` ở trên) hoặc **máy chủ riêng** (xem [`server/README.md`](server/README.md)). Với máy chủ riêng, mã nhóm cũng là mã bản dùng chung nên mọi người thấy cùng một bản dữ liệu dù mã khóa cục bộ khác nhau.

1. Mỗi người mở **⋮ → Kết Nối Chia Sẻ**, chọn Supabase hoặc Máy chủ riêng, rồi nhập cùng địa chỉ, mã truy cập và **mã nhóm / bản dùng chung**.
2. Mở **⋮ → Cộng Tác Nhóm**, nhập tên hiển thị và bấm **Bật cộng tác**.
3. Khi một người sửa điểm, quân số, cấu hình hoặc danh sách sinh viên, ứng dụng đẩy bản mới lên Supabase/máy chủ và báo cho các máy khác qua Realtime/WebSocket.
4. Máy khác nhận thông báo sẽ kéo bản mới về và gộp thay đổi. Nếu realtime bị chặn hoặc mất kết nối, ứng dụng vẫn tự kéo mỗi 15 giây.
5. Có thể bấm **Kéo mới nhất** hoặc **Đẩy hiện tại** trong hộp thoại cộng tác để đồng bộ ngay.

Cách gộp dữ liệu:

- Mỗi trung đội và mỗi sinh viên có thời điểm sửa riêng. Hai người sửa hai trung đội khác nhau thì cả hai thay đổi đều được giữ.
- Nếu hai người sửa cùng một trung đội/sinh viên, bản có thời điểm sửa sau sẽ thắng. Cấu hình khóa (tên khóa, đơn vị, điểm gốc, ngày, khóa sổ) cũng được gộp theo thời điểm.
- Nhật ký của các máy được gộp lại (tối đa 1.000 dòng gần nhất).
- Tên người chấm trên mỗi thiết bị được giữ riêng, không bị người khác ghi đè.
- Lần đầu bật cộng tác, nếu bản trên Supabase còn trống và máy đang có dữ liệu, ứng dụng giữ dữ liệu trên máy và đẩy lên làm bản gốc; nếu cả hai bên đều có dữ liệu, danh sách trung đội/sinh viên được gộp để tránh mất dữ liệu.

Để có danh sách người đang online và cập nhật tức thời, bật **Realtime** trong project Supabase. Nếu không bật, ứng dụng vẫn cộng tác được qua REST và tự đồng bộ định kỳ.

## Phát triển

Dự án dùng **Vite + TypeScript**, mã nguồn tách thành các module trong `src/`:

```text
index.html                 # Khung giao diện
src/main.ts                # Điểm vào, đăng ký service worker
src/app.ts                 # Trạng thái, render, sự kiện, nhập/xuất
src/parsers.ts             # Đọc .xls, .xlsx, .csv, .tsv, HTML/XML
src/constants.ts           # Dữ liệu mẫu, preset 56 trung đội, alias cột
src/utils.ts               # Hàm tiện ích dùng chung
src/scoring.ts             # Tính điểm, xếp hạng, thống kê
src/courseStore.ts         # Lưu trữ nhiều khóa V3 và migrate V2
src/backup.ts              # Sao lưu tự động và danh sách bản lưu
src/audit.ts               # Nhật ký thay đổi
src/students.ts            # Danh sách sinh viên, ban cán sự, nhập/xuất CSV
src/merge.ts               # Gộp dữ liệu nhiều người theo thời điểm sửa
src/cloudSync.ts           # Kết nối Supabase hoặc máy chủ riêng
src/collab.ts              # Cộng tác Supabase Realtime / WebSocket, presence, polling
server/index.mjs           # HTTP API, WebSocket, phục vụ dist/
server/store.mjs           # SQLite, quota 10GB, backup
server/store.test.mjs      # Test Node cho server
src/styles.css             # Toàn bộ giao diện
```

Cài đặt và chạy thử:

```bash
npm install
npm run dev        # chạy dev server
npm run typecheck  # kiểm tra TypeScript
npm test           # Vitest (57 test) + test server SQLite (4 test)
npm run test:server # chỉ chạy test server
npm run build      # build ra thư mục dist/
npm run preview    # xem thử bản build
npm run server     # chạy backend Node + SQLite (sau khi build)
```

## Triển khai

Mỗi lần push lên nhánh `main`, GitHub Actions sẽ tự động:

1. Cài dependencies bằng `npm ci`.
2. Chạy `npm run typecheck`.
3. Chạy `npm test`.
4. Chạy `npm run build`.
5. Deploy thư mục `dist/` lên GitHub Pages.

Cấu hình workflow nằm tại `.github/workflows/deploy.yml`. Không commit thư mục `dist/` hay `node_modules/`.

## Quyền riêng tư

- Dữ liệu chấm điểm lưu trong `localStorage` trên thiết bị đang dùng.
- Nếu bật đồng bộ đám mây hoặc cộng tác nhóm, bản sao dữ liệu (bao gồm danh sách sinh viên nếu đã nhập) được gửi lên Supabase do người dùng cấu hình hoặc máy chủ riêng do người dùng dựng.
- Máy chủ riêng lưu dữ liệu trong `DATA_DIR` trên máy chủ; nếu mở qua Cloudflare Tunnel, dữ liệu vẫn nằm trên máy chủ của bạn, không đi qua Supabase.
- Repo chỉ chứa mã nguồn và dữ liệu mẫu, **không chứa** danh sách cá nhân, số điện thoại, CCCD hay file Excel gốc.
- Xóa dữ liệu trình duyệt hoặc dùng chế độ ẩn danh có thể làm mất dữ liệu. Hãy xuất `.json` định kỳ.

## Nguồn

GitHub: https://github.com/dillysluvu/thi-dua-gdqp
