# Máy chủ riêng cho Bảng Thi Đua GDQP&AN

Máy chủ nhỏ dùng **Node.js + SQLite + WebSocket**, phục vụ luôn bản build trong `dist/`. Không cần Docker, Supabase hay dịch vụ ngoài.

## Yêu cầu

- Node.js **22 trở lên** (dùng `node:sqlite` có sẵn).
- npm.
- Một thư mục dữ liệu còn trống. Mặc định: `~/.local/share/thi-dua-gdqp`.
- Nếu mở ra Internet: Cloudflare Tunnel hoặc reverse proxy có HTTPS.

## Chạy thử

Từ thư mục gốc repo:

```bash
npm install
npm run build
ACCESS_CODE='doi-ma-truy-cap' \
DATA_DIR="$HOME/.local/share/thi-dua-gdqp" \
MAX_DATA_BYTES=10737418240 \
npm run server
```

Mở `http://127.0.0.1:8787`.

Nếu không đặt `ACCESS_CODE`, server tự tạo mã và lưu vào `DATA_DIR/access-code.txt` với quyền `600`.

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `PORT` | `8787` | Cổng HTTP/WebSocket |
| `HOST` | `127.0.0.1` | Địa chỉ lắng nghe. Dùng `0.0.0.0` nếu muốn truy cập trong LAN |
| `DATA_DIR` | `~/.local/share/thi-dua-gdqp` | Thư mục chứa SQLite, backup và mã truy cập |
| `MAX_DATA_BYTES` | `10737418240` (10GB) | Giới hạn tổng dữ liệu + backup |
| `MAX_PAYLOAD_BYTES` | `104857600` (100MB) | Giới hạn một bản ghi khóa |
| `BACKUP_INTERVAL_HOURS` | `24` | Chu kỳ backup tự động; `0` để tắt |
| `BACKUP_KEEP` | `14` | Số bản backup giữ lại |
| `ALLOWED_ORIGINS` | `*` | Danh sách origin được CORS, cách nhau bởi dấu phẩy |
| `DIST_DIR` | `<repo>/dist` | Thư mục giao diện đã build |

## Cấu hình trong ứng dụng

1. Mở ứng dụng (GitHub Pages hoặc chính địa chỉ máy chủ).
2. Vào **⋮ → Kết Nối Chia Sẻ**.
3. Chọn **Máy chủ riêng**.
4. Nhập địa chỉ máy chủ, mã truy cập và **mã nhóm / bản dùng chung**.
5. Bấm **Kiểm tra kết nối**.
6. Vào **⋮ → Cộng Tác Nhóm**, nhập tên hiển thị rồi bật cộng tác.

Mọi người phải dùng cùng địa chỉ, mã truy cập và mã nhóm. Với máy chủ riêng, **mã nhóm cũng là mã bản dùng chung**: cùng mã nhóm sẽ thấy cùng một bản dữ liệu, dù mã khóa lưu cục bộ trên từng máy khác nhau.

## Dữ liệu và giới hạn 10GB

- Dữ liệu chính: `DATA_DIR/thi-dua.sqlite`.
- Backup: `DATA_DIR/backups/backup-*.sqlite`, tự tạo mỗi 24 giờ và giữ tối đa 14 bản.
- Server kiểm tra dung lượng trước khi ghi và trả HTTP `507` nếu vượt `MAX_DATA_BYTES`.
- SQLite được đặt `max_page_count` để không phình quá khoảng 90% hạn mức; phần còn lại dành cho backup.
- Xem dung lượng: `GET /api/usage` với header `Authorization: Bearer <mã truy cập>`.

Dữ liệu thực tế của 1.770 sinh viên chỉ vài MB. 10GB chủ yếu để dành cho backup và mở rộng sau này.

### Giới hạn cứng bằng ổ đĩa ảo 10GB (tùy chọn)

Nếu muốn hệ điều hành chặn cứng ở 10GB, tạo file ext4 và mount bằng `fuse2fs` (không cần root):

```bash
mkdir -p "$HOME/.local/share"
truncate -s 10G "$HOME/.local/share/thi-dua-gdqp.img"
mkfs.ext4 -F -O ^has_journal "$HOME/.local/share/thi-dua-gdqp.img"
mkdir -p "$HOME/.local/share/thi-dua-gdqp"
fuse2fs -o fakeroot "$HOME/.local/share/thi-dua-gdqp.img" "$HOME/.local/share/thi-dua-gdqp"
```

Sau đó đặt `DATA_DIR="$HOME/.local/share/thi-dua-gdqp"`. Khi khởi động lại, mount lại ổ này trước khi chạy server. Có thể tạo systemd user service cho `fuse2fs` với `Before=thi-dua-gdqp.service`.

## Chạy nền bằng systemd

Tạo file môi trường:

```bash
mkdir -p "$HOME/.config/thi-dua-gdqp"
cat > "$HOME/.config/thi-dua-gdqp/server.env" <<'EOF'
PORT=8787
HOST=127.0.0.1
DATA_DIR=/home/uyvu/.local/share/thi-dua-gdqp
MAX_DATA_BYTES=10737418240
ACCESS_CODE=doi-ma-truy-cap
ALLOWED_ORIGINS=*
BACKUP_INTERVAL_HOURS=24
BACKUP_KEEP=14
EOF
chmod 600 "$HOME/.config/thi-dua-gdqp/server.env"
```

Tạo `~/.config/systemd/user/thi-dua-gdqp.service`:

```ini
[Unit]
Description=Thi dua GDQP shared server
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/uyvu/337/thi-dua-gdqp
EnvironmentFile=/home/uyvu/.config/thi-dua-gdqp/server.env
ExecStart=/usr/bin/node server/index.mjs
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
```

Kích hoạt:

```bash
systemctl --user daemon-reload
systemctl --user enable --now thi-dua-gdqp.service
loginctl enable-linger "$USER"
systemctl --user status thi-dua-gdqp.service
```

Xem log:

```bash
journalctl --user -u thi-dua-gdqp.service -f
```

## Mở ra Internet bằng Cloudflare Tunnel

Chạy thử nhanh (URL tạm thời, đổi sau mỗi lần chạy):

```bash
cloudflared tunnel --url http://127.0.0.1:8787
```

Với tên miền ổn định, làm theo hướng dẫn Cloudflare để tạo named tunnel, trỏ DNS về tunnel và chạy:

```bash
cloudflared tunnel run --url http://127.0.0.1:8787 <ten-tunnel>
```

Sau khi có URL HTTPS, nhập URL đó vào **Kết Nối Chia Sẻ** trong ứng dụng. Không cần mở cổng trên router.

## API chính

Tất cả API cần header:

```http
Authorization: Bearer <ACCESS_CODE>
```

| Phương thức | Đường dẫn | Mục đích |
| --- | --- | --- |
| `GET` | `/api/health` | Kiểm tra kết nối, phiên bản, dung lượng |
| `GET` | `/api/usage` | Dung lượng đã dùng / hạn mức |
| `GET` | `/api/sync/:syncId/courses/:courseId` | Lấy bản dùng chung |
| `PUT` | `/api/sync/:syncId/courses/:courseId` | Ghi bản dùng chung |
| `GET` | `/api/sync/:syncId/courses` | Danh sách khóa trong nhóm |
| `POST` | `/api/backup` | Tạo backup ngay |
| `GET` | `/api/backups` | Danh sách backup |
| `GET` | `/api/export` | Xuất toàn bộ dữ liệu JSON |
| `WS` | `/ws?syncId=...&courseId=...&token=...` | Realtime + presence |

Với chế độ máy chủ riêng, ứng dụng dùng `syncId` làm cả mã nhóm và mã bản dùng chung.

## Bảo mật

- Luôn dùng HTTPS khi mở ra Internet (Cloudflare Tunnel hoặc reverse proxy).
- Không chia sẻ mã truy cập công khai; đổi mã bằng cách sửa `ACCESS_CODE` trong file env rồi khởi động lại service.
- Không mở trực tiếp cổng SQLite hay thư mục dữ liệu ra ngoài.
- Nên đặt `ALLOWED_ORIGINS` cụ thể (ví dụ `https://dillysluvu.github.io,https://thi-dua.example.com`) thay vì `*` khi đã ổn định.
- Backup định kỳ ra ổ khác hoặc tải qua `GET /api/export`.

## Kiểm thử

```bash
npm run typecheck
npm test              # Vitest + test server SQLite
npm run test:server   # chỉ test server
npm run build
```
