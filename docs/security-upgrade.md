# Hoàn tất bốn nhóm nâng cấp bảo mật và ổn định

## Thay đổi

1. API ghi kiểm tra Origin trước khi xử lý cookie; chỉ cho phép origin chính xác, không tin tiền tố tên miền preview. Chỉ webhook PayPal và maintenance server-to-server được miễn khi không có cookie; các handler vẫn xác minh chữ ký/cron secret. Admin, OTP và token khiếu nại không còn lấy khóa Supabase làm khóa ký dự phòng.
2. Ba bảng bot_personas, site_events, personal_puzzles bật RLS, thu hồi quyền browser và chặn policy cũ cho anon/authenticated. Các bảng và RPC phiên puzzle mới chỉ cho service_role sử dụng. Server cấp attempt/version/run, kiểm tra đáp án và tính thành tích trong giao dịch. API không nhận điểm, Elo puzzle, thời gian hoặc streak tự khai báo để ghi. Khách chưa đăng nhập chỉ luyện tập, không lưu thành tích. Game log chuẩn hóa ngày ISO và kiểm tra đường dẫn; file log cũ vẫn đọc được.
3. Heartbeat dùng ở cấp App cho tài khoản đã đăng nhập, mỗi 20 giây khi trang đang hiển thị. Nó chỉ cập nhật last_seen/updated_at, không đổi trạng thái playing/queue, game_id, ticket hay gia hạn lease. Khi offline/tab nền thì ngừng gửi. Nhiều tab có thể cùng gửi nhưng không thay đổi quyền sở hữu trận/hàng chờ.
4. Tìm người chơi hủy request cũ và kiểm tra thế hệ request trước khi cập nhật kết quả. Playwright chạy trong CI, lưu artifact khi job thất bại.

## Cập nhật database và ứng dụng

1. Sao lưu database bằng quy trình hiện có, dừng backend/worker trong cửa sổ cập nhật.
2. Với database đã cài ChessArena, chạy **toàn bộ** `backend/supabase/SecurityUpgrade.sql` trong Supabase SQL Editor. Không chạy `schema.sql` trên database đang có dữ liệu. Script chạy lại được, không xóa game, Elo, thanh toán hoặc tiến độ puzzle cũ. Tiến độ cũ được giữ, không tự chứng nhận hay tính lại độ tin cậy của điểm cũ.
3. Chạy `backend/supabase/VerifySecurityUpgrade.sql`; cả hai bảng kết quả cần PASS. Đây là kiểm tra tồn tại/RLS/quyền cơ bản, không chứng nhận mọi cấu hình của Supabase.
4. Cập nhật backend và frontend cùng phiên bản, khởi động lại worker. Trang cũ cần tải lại; PUT tiến độ puzzle cũ trả 405, yêu cầu đáp án không có attempt/version trả lỗi thay vì ghi điểm không xác minh.
5. Trong backend chạy `npm.cmd run check:security`. Khóa `ADMIN_SESSION_SECRET` và `OTP_SECRET` phải riêng biệt, ít nhất 32 ký tự ngẫu nhiên, không dùng placeholder hoặc khóa database. Cấu hình local đã kiểm tra đạt điều kiện này mà không thay giá trị. Nếu thay khóa ký, đăng nhập admin lại và xin OTP mới.
6. Mỗi địa chỉ frontend/preview được phép phải có trong `FRONTEND_URL` hoặc `FRONTEND_URLS` (danh sách cách nhau bằng dấu phẩy). Tên miền có cùng tiền tố không tự được chấp nhận. `local:host` bổ sung các IP giao diện mạng của máy chủ vào danh sách riêng, không ghi đè FRONTEND_URLS của .env. Một frontend chạy từ IP máy khác cần khai báo origin đó rõ ràng; localhost vẫn theo cấu hình local.

Database mới và bản cập nhật tổng hợp đã chứa cùng khối SQL; không cần chạy cả ba file. Lượt sửa này không tự áp migration lên Supabase đang sử dụng.

## Thu hồi khóa đã lộ — CHƯA HOÀN TẤT

Người dùng xác nhận chưa thu hồi hoặc chưa chắc. Không có bằng chứng Dashboard đã vô hiệu hóa khóa cũ. Không thử dùng lại khóa đã lộ, không in khóa vào báo cáo và không tự xoay khóa production.

Trong **Supabase Dashboard → Settings → API Keys**, chuyển backend/worker sang secret key mới; nếu frontend dùng legacy anon key, chuyển sang publishable key tương ứng. Cập nhật cấu hình triển khai và khởi động lại/build lại thành phần dùng khóa trước khi vô hiệu hóa legacy keys. Riêng khóa service_role dạng JWT từng lộ phải được vô hiệu hóa, không chỉ tạo khóa mới. Xác minh các client đang dùng khóa mới và lưu xác nhận Dashboard đã tắt khóa cũ. Hướng dẫn chính thức: [API keys và xử lý khóa bị lộ](https://supabase.com/docs/guides/getting-started/api-keys).

Trong source hiện tại, backend/worker đọc khóa từ `SUPABASE_SERVICE_ROLE_KEY`; frontend Realtime đọc khóa công khai từ `VITE_SUPABASE_ANON_KEY`. Không đặt secret key vào biến `VITE_*`. Không sửa tên biến chỉ để đổi loại khóa. Không đưa khóa hay ảnh chứa khóa vào chat.

`check:security` kiểm tra cấu hình cục bộ, **không** chứng minh khóa cũ đã bị thu hồi. RLS không bảo vệ được dữ liệu trước người còn giữ khóa service_role hợp lệ.

## Kiểm tra sau triển khai

- Đăng nhập/đăng xuất bằng origin hợp lệ; gửi mutation từ origin lạ phải nhận 403.
- Mở Friends hoặc Review bằng tài khoản thứ hai: có heartbeat presence; đang chơi/tìm trận không bị heartbeat này đưa về trạng thái khác.
- Giải câu đố nhiều nước, tải lại giữa chừng, gửi lại đáp án: tiến độ được khôi phục, không cộng điểm hai lần. Bài thứ năm của tài khoản Free vẫn hoàn thành được; bài mới vượt hạn mức bị từ chối. Rush hết giờ/ba lỗi và Streak sai đều kết thúc phía server.
- Lưu/xem lại ván cũ và mới; kiểm tra bạn bè, lời mời, ghép trận và review bình thường.
- Bộ test trình duyệt sử dụng API giả lập; SQL integration dùng PostgreSQL riêng, kiểm thử engine dùng Stockfish cục bộ. Kết quả không thay thế xác minh cấu hình hoặc mạng production.

## Kết quả rà soát ngày 29/10/2026

| Kiểm tra | Kết quả |
| --- | --- |
| Backend unit tests | 226/226 PASS |
| Frontend unit tests | 26/26 PASS |
| Database integration, chạy tuần tự bằng `node --test --test-concurrency=1 tests/integration/*.test.js` | 85/85 PASS |
| Toàn bộ Playwright trên trình duyệt Edge cục bộ | 80/80 PASS |
| Lint backend và frontend | PASS |
| Production build backend và frontend | PASS |
| `check:security` | Cấu hình khóa ký và origin đạt; thu hồi khóa cũ UNVERIFIED |

Đã chạy lại riêng 15 test security integration sau khi bổ sung kiểm tra file `VerifySecurityUpgrade.sql`: tất cả PASS. File xác minh trả PASS cho 6 bảng và 5 RPC; cố tình thiếu quyền UPDATE của service_role thì trả CHECK PERMISSIONS. Migration được áp hai lần trên database kiểm thử để kiểm tra khả năng chạy lại. Các khối SQL nâng cấp trong `schema.sql`, `BanCanCapNhat.sql` và `SecurityUpgrade.sql` được đối chiếu giống nhau.

CI đã được cấu hình chạy Chromium trên Linux; chưa có kết quả chạy GitHub Actions từ lượt sửa cục bộ này. Cấu hình local còn bật `ENABLE_TEST_ACCOUNTS=true`; cần tắt khi triển khai công khai. Chưa áp migration lên Supabase đang sử dụng và chưa xác minh thu hồi khóa cũ. Đây là các bước triển khai còn lại, không được coi là đã hoàn thành bởi kết quả test cục bộ.
