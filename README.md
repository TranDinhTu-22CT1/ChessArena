# ChessArena

Website chơi và luyện tập cờ vua, phát triển bởi **Trần Đình Tú**.

## Chức năng chính

- Chơi với máy hoặc đấu online, ghép trận và thách đấu bạn bè.
- Xem lại, phân tích ván đấu bằng Stockfish và hỏi đáp với AI Coach.
- Giải câu đố: Daily Puzzle, Puzzle Rush, Puzzle Streak và Puzzle Battle.
- Quản lý hồ sơ, bạn bè, lịch sử đấu và bảng xếp hạng.
- Gói thành viên qua PayPal; trang quản trị người chơi, hỗ trợ và cấu hình website.

Bảng xếp hạng tuần/tháng dùng điểm thi đấu riêng, không đặt lại Elo ghép trận.
AI Coach hỗ trợ kiến thức cờ vua và phân tích theo ngữ cảnh bàn cờ; khả năng trả lời phụ thuộc dữ liệu và trạng thái engine.

## Công nghệ

| Thành phần | Công nghệ |
| --- | --- |
| Giao diện | React, Vite |
| Backend | Node.js, Next.js API |
| Dữ liệu và đăng nhập | Supabase PostgreSQL, Firebase Authentication |
| Luật cờ và phân tích | chess.js, Stockfish |
| Kiểm thử | Node.js Test Runner, Playwright |

## Cấu trúc dự án

```text
ChessArena/
├── Frontend/          # Giao diện, tài nguyên và test trình duyệt
├── backend/
│   ├── src/           # API, xử lý nghiệp vụ và dữ liệu kiến thức
│   ├── supabase/      # Schema và các bản cập nhật database
│   ├── scripts/       # Worker và công cụ kiểm tra
│   └── tests/         # Unit test và integration test
├── scripts/           # Chạy và kiểm tra môi trường local
├── docs/              # Tài liệu chức năng và vận hành
└── .github/workflows/ # Cấu hình CI
```

Frontend gửi yêu cầu đến backend; backend xác thực người dùng, xử lý luật và làm việc với database.
Stockfish được dùng cho chơi với máy và phân tích; chess.js hỗ trợ kiểm tra nước đi hợp lệ.

## Chạy local

Yêu cầu **Node.js 22.12 trở lên**, cùng cấu hình Firebase và Supabase của dự án. Chạy các lệnh tại thư mục gốc:

```powershell
npm.cmd --prefix backend ci
npm.cmd --prefix Frontend ci
```

1. Tạo `backend/.env` và `Frontend/.env` từ các file `.env.example` tương ứng, rồi điền cấu hình. Giữ nguyên `.env` nếu đã thiết lập; không đưa khóa bí mật vào frontend hoặc GitHub.
2. Với Supabase trống, chạy [schema.sql](backend/supabase/schema.sql). Với database ChessArena đã có dữ liệu, sao lưu và đọc hướng dẫn đầu [BanCanCapNhat.sql](backend/supabase/BanCanCapNhat.sql) trước khi cập nhật.
3. Khởi động frontend, backend và các worker:

```powershell
npm.cmd run local:host
```

Mở **http://localhost:5173**; backend chạy ở cổng **3000**. Khi thử đấu online trên hai máy, cả hai phải kết nối cùng backend.

## Cấu hình cần chuẩn bị

| File | Cấu hình chính |
| --- | --- |
| [backend/.env.example](backend/.env.example) | Supabase, Firebase Admin, khóa phiên, SMTP và PayPal |
| [Frontend/.env.example](Frontend/.env.example) | Firebase Web App, địa chỉ API và Plan ID PayPal công khai |

Firebase phía frontend và backend phải thuộc cùng project. Khi thử thanh toán, dùng tài khoản và gói PayPal sandbox tương ứng.
Khóa `service_role`, Firebase Admin private key và PayPal secret chỉ đặt ở backend.
Các biến bắt đầu bằng `VITE_` có thể được đưa vào bản build giao diện, nên không dùng để chứa bí mật.

Lệnh `local:host` cấu hình proxy API về backend local. Database chỉ cần tạo/cập nhật khi cài đặt hoặc nâng cấp, không chạy SQL mỗi lần mở ứng dụng.
Trước khi cập nhật database có dữ liệu, sao lưu và dừng backend/worker theo hướng dẫn trong file SQL.

## Kiểm tra

```powershell
npm.cmd --prefix backend test
npm.cmd --prefix Frontend test
npm.cmd --prefix backend run check:engine
```

Các bước kiểm tra bổ sung:

```powershell
npm.cmd --prefix backend run lint
npm.cmd --prefix Frontend run lint
npm.cmd --prefix backend run test:integration
npm.cmd --prefix Frontend run test:browser
npm.cmd --prefix backend run build
npm.cmd --prefix Frontend run build
```

Integration test dùng PostgreSQL tạm; browser test dùng Playwright với các tình huống API giả lập.
Trên Linux, cài trình duyệt kiểm thử bằng `npx playwright install --with-deps chromium` tại `Frontend`.
Dừng phiên dev trước khi build để tránh xung đột thư mục đầu ra. Kết quả test cần được đọc theo từng lần chạy, không mặc định mọi môi trường đều đạt.

## Tài liệu bổ sung

- [Bảng xếp hạng theo kỳ và bộ lọc bạn bè](docs/leaderboard-and-friends.md).
- [Cấu hình bảo mật và kiểm tra sau triển khai](docs/security-upgrade.md).
- [Dữ liệu kiến thức cho AI Coach](backend/src/data/README.md).
