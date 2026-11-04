// Small reference lessons, not unrestricted model-generated factual answers.
const mdn = (title, path) => ({title:`MDN · ${title}`,url:`https://developer.mozilla.org/en-US/docs/${path}`});
const authored = {title:'Hướng dẫn và ví dụ do ChessArena biên soạn'};
const lesson = (id,title,terms,text,example,source=authored) => ({id,title,terms,text,example,source,domain:'general',suggestions:['Cho ví dụ','Tóm tắt','Tôi muốn hỏi câu khác']});

export const COACH_GENERAL_LESSONS = [
  lesson('general-ai','AI là gì?', ['tri tue nhan tao la gi','giai thich tri tue nhan tao'],
    'AI (trí tuệ nhân tạo) là tên gọi cho hệ thống máy tính thực hiện những việc như nhận dạng, dự đoán hoặc tạo nội dung. AI có thể sai; câu trả lời trôi chảy chưa đủ để chứng minh thông tin đúng. AI Coach dùng kho tài liệu cho kiến thức và Stockfish khi kiểm tra thế cờ.',
    'Ví dụ: một hệ thống gợi ý bài tập dựa trên lỗi bạn hay mắc đang dùng dữ liệu để chọn nội dung. Riêng nước đi trong một thế cờ cần được kiểm tra bằng luật và engine; lời giải thích nghe hợp lý chưa đủ.'),
  lesson('general-api','API là gì?', ['giai thich api','api dung de lam gi','what is an api'],
    'API là giao diện để phần mềm yêu cầu chức năng hoặc dữ liệu từ phần mềm khác. Nó quy định cách gửi yêu cầu và đọc kết quả. Không phải API nào cũng là API qua mạng.',
    'Ví dụ giả định: giao diện gửi yêu cầu lấy danh sách bài tập, máy chủ trả về dữ liệu và giao diện hiển thị. API là phần quy ước giữa hai phía, không phải chính nút bấm.',
    mdn('API','Glossary/API')),
  lesson('general-client-server','Trình duyệt và máy chủ', ['trinh duyet la gi','may chu la gi','client server la gi','website hoat dong the nao'],
    'Trình duyệt là phần mềm dùng để mở và hiển thị trang web. Máy chủ lưu hoặc xử lý nội dung rồi trả kết quả khi nhận yêu cầu. Trang hiển thị được trên trình duyệt không có nghĩa mọi dữ liệu đều được lưu trên máy của bạn.',
    'Hình dung trình duyệt gửi một phiếu yêu cầu và máy chủ gửi lại nội dung. Nếu đường truyền gián đoạn, giao diện đã tải có thể vẫn nhìn thấy nhưng dữ liệu mới chưa về.',
    mdn('How the web works','Learn_web_development/Getting_started/Web_standards/How_the_web_works')),
  lesson('general-http','HTTP là gì?', ['giai thich http','giao thuc http'],
    'HTTP là giao thức dùng để trao đổi yêu cầu và phản hồi giữa các thành phần trên web. Một phản hồi thường có mã trạng thái, phần đầu và có thể có nội dung. Mã trạng thái giúp mô tả kết quả xử lý; cần ngữ cảnh để biết nguyên nhân lỗi cụ thể.',
    'Ví dụ: trình duyệt yêu cầu một trang; máy chủ trả mã 200 cùng nội dung nếu xử lý thành công. Cùng một giao diện có thể gửi nhiều yêu cầu khác nhau.',
    mdn('Overview of HTTP','Web/HTTP/Guides/Overview')),
  lesson('general-cookie','Cookie là gì?', ['cookie trinh duyet','cookies la gi','giai thich cookie'],
    'Cookie là dữ liệu nhỏ mà máy chủ có thể yêu cầu trình duyệt lưu và gửi lại trong các yêu cầu phù hợp. Cookie có thể dùng cho phiên đăng nhập hoặc tùy chọn. Xóa cookie phiên có thể khiến bạn phải đăng nhập lại; không nên chia sẻ giá trị cookie đăng nhập.',
    'Ví dụ giả định: khi bạn đăng nhập, trình duyệt giữ một cookie phiên. Yêu cầu tiếp theo gửi cookie đó để máy chủ nhận biết phiên, thay vì yêu cầu bạn nhập lại mật khẩu mỗi lần.',
    mdn('Using HTTP cookies','Web/HTTP/Guides/Cookies')),
  lesson('general-study','Cách học hiệu quả', ['lam sao hoc hieu qua','cach tap trung hoc','toi kho tap trung'],
    'Bạn có thể thử một buổi học ngắn: chọn một mục tiêu cụ thể, tắt thông báo, học 20 phút rồi tự diễn đạt lại bằng lời của mình. Ghi một chỗ chưa hiểu để quay lại ôn. Đây là gợi ý để thử và điều chỉnh theo bạn, không phải lịch bắt buộc.',
    'Ví dụ: hôm nay chỉ học cách phân biệt ghim và xiên. Đọc một ví dụ của mỗi loại, tự giải thích sự khác nhau rồi làm một bài tập. Nếu vẫn nhầm, quay lại đúng điểm đó.'),
  lesson('general-support-message','Mẫu tin nhắn hỗ trợ', ['viet tin nhan ho tro','soan tin nhan ho tro','mau bao loi','viet email ho tro','mau ticket'],
    'Bạn có thể dùng mẫu sau và thay phần trong ngoặc:\nChào bộ phận hỗ trợ, tôi gặp [vấn đề] tại [màn hình] vào [thời điểm].\nCác bước: [1] → [2] → [3].\nTôi mong đợi [kết quả], nhưng nhận được [kết quả thực tế/thông báo lỗi].\nTrình duyệt và thiết bị: [thông tin]. Nhờ đội hỗ trợ kiểm tra giúp.\nKhông điền mật khẩu, mã OTP, token hoặc thông tin thanh toán bí mật vào mẫu.',
    'Ví dụ minh họa: “Tôi mở trang Review, chọn một ván rồi bấm bắt đầu. Tôi mong thấy phân tích nhưng màn hình báo lỗi. Tôi dùng trình duyệt [tên] trên [thiết bị].” Hãy thay bằng tình huống thật của bạn.',
    {title:'Hỗ trợ ChessArena',url:'/support'}),
];
