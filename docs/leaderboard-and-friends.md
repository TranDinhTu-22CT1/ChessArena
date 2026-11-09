# Bảng xếp hạng theo kỳ và bộ lọc bạn bè

## Cơ sở thiết kế

Tài liệu đối chiếu ngày 15/10/2026:

- [Chess.com Players League](https://support.chess.com/en/articles/8557800-what-is-the-players-league): cuộc đua điểm theo tuần, tách khái niệm league khỏi rating cờ.
- [Điều kiện nhận điểm League](https://support.chess.com/en/articles/8557462-i-just-won-a-game-why-didn-t-i-get-any-league-trophies): chỉ trận rated hợp lệ, giới hạn số ván với cùng đối thủ.
- [Chess.com Live Chess settings](https://support.chess.com/en/articles/8614003-how-do-i-manage-my-live-chess-settings): khoảng rating và quyền nhận lời mời là các thiết lập riêng.
- [Lichess FAQ — ranks and leaderboards](https://lichess.org/faq#leaderboards): thứ hạng có điều kiện về hoạt động và độ tin cậy của rating.

Không có bằng chứng từ các nguồn này rằng Chess.com dùng đúng thuật toán sắp xếp bạn bè của ChessArena. Bộ lọc và thứ tự gợi ý dưới đây là thiết kế riêng cho dự án, dựa trên nhu cầu Elo gần nhau và hoạt động gần đây đã được chọn.

## Quy tắc ChessArena

- Elo tổng và Elo ghép trận giữ nguyên, không reset tuần hoặc tháng.
- Tuần bắt đầu thứ Hai 00:00; tháng bắt đầu ngày 1 00:00, theo Asia/Ho_Chi_Minh (UTC+7). Khoảng thời gian gồm đầu kỳ, không gồm đầu kỳ sau. Không phụ thuộc múi giờ trình duyệt.
- Tuần/tháng xếp theo điểm riêng từng mode: thắng 3, hòa 1, thua 0. Đây là điểm thi đấu, không phải Elo và không phải công thức điểm Chess.com.
- Chỉ tính game rated, quick, kết thúc checkmate/draw/resigned, có finished_at và online_rating_events khớp người chơi/kết quả. Trận bot, bạn bè không rated, bỏ trận và game chưa chốt rating không được tính.
- Chỉ ba trận hợp lệ đầu tiên của mỗi cặp đối thủ trong ngày Việt Nam được tính, chung mọi mode, không chỉ ba trận thắng. Các trận còn lại vẫn cập nhật Elo bình thường theo cơ chế hiện tại.
- Bằng điểm: số trận thắng cao hơn, thời điểm kết thúc trận được tính cuối sớm hơn, UUID tăng dần. UUID chỉ là khóa phân xử ổn định, không phải ưu tiên trình độ.
- Người chưa có trận hợp lệ chưa có hạng kỳ mới; hạng kỳ trước được hiển thị riêng. Ví dụ hạng #60 tuần trước không bị gán sai thành #60 tuần mới.
- Chọn được kỳ hiện tại và 12 kỳ trước; có kết quả kỳ liền trước của kỳ đang xem. Lịch sử được tính từ game và sự kiện rating đã lưu, không xóa điểm/game. Nếu quản trị sửa/xóa nguồn lịch sử, bảng kỳ cũ sẽ được tính lại; đây không phải bản chốt bất biến hay hệ thống trao thưởng.
- Chuyển kỳ là điều kiện thời gian trong truy vấn, không cần cron reset. Trang đang mở tự tải lại theo mốc giờ server; request hủy/đổi bộ lọc không ghi đè kết quả mới bằng response cũ.
- Không nhận điểm, rank, Elo hay ngày kỳ do client tự khai báo để ghi database. RPC chỉ service_role được gọi; REST lấy user ID từ phiên đăng nhập.

## Bạn bè

- Lọc theo tên, mode Elo, chênh lệch ±100/200/400, đang online, online chưa vào trận, hoạt động 24 giờ hoặc 7 ngày.
- Gợi ý mặc định: online chưa chơi/tìm trận trước, tiếp theo người online bận, rồi offline; trong mỗi nhóm ưu tiên Elo gần nhất, sau đó hoạt động gần đây, cuối cùng ID ổn định.
- Có thể chuyển sang ưu tiên Elo hoặc thời điểm hoạt động. Sắp xếp/lọc toàn danh sách đã tải trước khi phân trang.
- Không dùng Elo Rapid để so người chơi Blitz. Chưa có trận rated trong mode thì không giả định Elo 0; không đưa vào bộ lọc chênh lệch. Người xem chưa có Elo sẽ chưa bật được bộ lọc khoảng Elo.
- Hoạt động lấy từ online_presence.last_seen hoặc lần cập nhật rating đã có ván; không suy đoán giờ rảnh hay theo dõi lịch sinh hoạt. Online hết hạn sau 45 giây; khi trang hiển thị, tải lại dữ liệu mỗi 30 giây.
- Bộ lọc chỉ hỗ trợ lựa chọn, không thay đổi quyền kết bạn hoặc thách đấu. Chọn thời gian cho lời mời vẫn là một điều khiển riêng.

## Cập nhật database

Database đang có dữ liệu: chạy toàn bộ `backend/supabase/LeaderboardSeasons.sql` bằng Supabase SQL Editor. Script thêm index và RPC đọc, không reset dữ liệu. Chạy lại được.

Database mới đã có khối tương ứng trong `backend/supabase/schema.sql`; bản cập nhật tổng hợp cũng có trong `BanCanCapNhat.sql`. Không cần chạy cả ba file. `OnlineHotfix.sql` vẫn chỉ xử lý matchmaking và không cài RPC leaderboard.

Sau đó khởi động lại backend/frontend. Nếu chưa cài RPC, leaderboard trả thông báo cập nhật database; không giả lập bảng điểm hay sửa Elo để che lỗi.

## Giới hạn

Giới hạn ba ván/cặp/ngày chỉ giảm farm đơn giản, không thay thế phát hiện thông đồng/tài khoản phụ. Kỳ được tổng hợp trực tiếp trong database và phân trang ở server; với quy mô lớn cần đo EXPLAIN/độ trễ thực tế trước khi bổ sung bảng tổng hợp. Không có migration hoặc thay đổi dữ liệu production tự động trong công việc này.
