import { normalizeKnowledgeText as norm } from './chessKnowledge.js';
import { knowledgeReply } from './coachKnowledge.js';
import { COACH_GENERAL_LESSONS } from '../data/coachGeneralLessons.js';
import { normalizeAiCoachText } from './aiCoachIntent.js';

const suggestions = ['Bạn có thể giúp gì?', 'Kể tên 3 đại kiện tướng', 'Tôi muốn hỏi câu khác'];
const reply = (answer, status = 'conversation', extra = {}) => knowledgeReply(answer, [], status, {suggestions, ...extra});

// Run before article selection: these requests must not pick a chess article
// because of an incidental word, or forward secrets to a model provider.
export function sensitiveCoachReply(question) {
  const text = norm(question);
  if (/\b(toi|minh|em) (?:muon|dinh|sap) (?:tu tu|tu sat|tu hai|lam hai ban than|chet)\b/.test(text)) {
    return reply('Mình rất tiếc vì bạn đang đau khổ như vậy. Nếu có nguy cơ làm hại bản thân ngay lúc này, hãy gọi dịch vụ cấp cứu nơi bạn sống và nhờ một người bạn tin tưởng ở cạnh. Bạn có đang ở nơi an toàn, và có ai bạn có thể gọi ngay không?', 'conversation', {suggestions:[]});
  }
  if (/\b(api key|service role|service_role|private key|secret key|access token|refresh token|system prompt|prompt he thong|bien moi truong|file env)\b/.test(text)
    || /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/.test(question)
    || /-----BEGIN .*PRIVATE KEY-----|\b(?:sk-|AIza)[A-Za-z0-9_-]{20,}/.test(question)) {
    return reply('Mình không cung cấp khóa bí mật, token đăng nhập hoặc cấu hình nội bộ. Nếu đang sửa lỗi tích hợp, hãy gửi tên dịch vụ và thông báo lỗi đã che thông tin bí mật. Nếu vừa gửi một khóa thật, hãy thu hồi hoặc thay khóa đó tại dịch vụ phát hành.', 'conversation', {suggestions:['Tạo ticket hỗ trợ']});
  }
  if (/\b(hack|danh cap|lay trom|be khoa|chiem)\b/.test(text) && /\b(tai khoan|mat khau|otp|token)\b/.test(text)) {
    return reply('Mình không hướng dẫn chiếm tài khoản hoặc lấy thông tin đăng nhập của người khác. Nếu đây là tài khoản của bạn, hãy dùng luồng quên mật khẩu hoặc liên hệ hỗ trợ để xác minh quyền sở hữu.', 'conversation', {suggestions:['Quên mật khẩu', 'Tạo ticket hỗ trợ']});
  }
  if (/\b(so dien thoai|dia chi nha|email rieng|mat khau)\b/.test(text) && /\b(cua (?!toi\b|minh\b|em\b)|nguoi khac|chu web|admin)\b/.test(text)) {
    return reply('Mình chỉ dùng thông tin liên hệ đã được công bố cho mục đích hỗ trợ, không cung cấp thông tin riêng tư của người khác. Bạn có thể hỏi email hỗ trợ công khai của ChessArena.', 'conversation', {suggestions:['Email hỗ trợ ChessArena là gì?']});
  }
  if (/\b(bo qua|ignore|quen het)\b/.test(text) && /\b(quy tac|chi dan|instructions|previous|he thong)\b/.test(text)) {
    return reply('Bạn hãy gửi thẳng câu hỏi cần giải quyết. Mình sẽ trả lời theo thông tin kiểm tra được; yêu cầu đổi vai hoặc bỏ qua hướng dẫn không cung cấp thêm dữ liệu thực tế.', 'clarify');
  }
  return null;
}

function arithmetic(question) {
  const raw = normalizeAiCoachText(question).trim().replace(/^(?:tinh(?: giup toi)?|doi|calculate|what is)\s*/i, '').replace(/\s*(?:bang bao nhieu|bang may|=|\?)\s*[?]?$/i, '').trim();
  const number = '-?\\d{1,9}(?:[.,]\\d{1,6})?';
  const parse = value => Number(value.replace(',', '.'));
  const percentage = raw.match(new RegExp(`^(${number})\\s*(?:%|phan tram)\\s*(?:cua|of)\\s*(${number})$`));
  if (percentage) {
    const value = parse(percentage[1]) * parse(percentage[2]) / 100, rounded = Number(value.toPrecision(12));
    return reply(`${percentage[1]}% của ${percentage[2]} ${value === rounded ? '=' : '≈'} ${rounded}.`, 'grounded');
  }
  const unit = '(?:gio|phut|giay|km|cm|mm|m)';
  const conversion = raw.match(new RegExp(`^(${number})\\s*(${unit})\\s*(?:sang|ra|bang(?: bao nhieu)?)\\s*(${unit})$`));
  if (conversion) {
    const units = {gio:['time',3600,'giờ'],phut:['time',60,'phút'],giay:['time',1,'giây'],km:['length',1000,'km'],m:['length',1,'m'],cm:['length',0.01,'cm'],mm:['length',0.001,'mm']};
    const from = units[conversion[2]], to = units[conversion[3]];
    if (from[0] !== to[0]) return reply('Hai đơn vị này đo đại lượng khác nhau nên không thể đổi trực tiếp. Bạn muốn đổi thời gian (giờ/phút/giây) hay độ dài (km/m/cm/mm)?', 'clarify');
    const value = parse(conversion[1]) * from[1] / to[1], rounded = Number(value.toPrecision(12));
    return reply(`${conversion[1]} ${from[2]} ${value === rounded ? '=' : '≈'} ${rounded} ${to[2]}.`, 'grounded');
  }
  const match = raw.match(/^(-?\d{1,9}(?:[.,]\d{1,6})?)\s*([+\-*/×÷])\s*(-?\d{1,9}(?:[.,]\d{1,6})?)$/);
  if (!match) return null;
  const a = Number(match[1].replace(',', '.')), b = Number(match[3].replace(',', '.')), op = match[2];
  if (['/', '÷'].includes(op) && b === 0) return reply('Không thể chia cho 0 trong phép chia số thông thường.', 'grounded');
  const value = op === '+' ? a + b : op === '-' ? a - b : ['*','×'].includes(op) ? a * b : a / b;
  const rounded = Number(value.toPrecision(12));
  return reply(`${match[1]} ${op} ${match[3]} ${rounded === value ? '=' : '≈'} ${rounded}.`, 'grounded');
}

const vocabulary = [
  ['hello','xin chào'], ['thank you','cảm ơn'], ['thanks','cảm ơn'], ['goodbye','tạm biệt'],
  ['good luck','chúc may mắn'], ['well played','chơi hay lắm'], ['good game','ván đấu hay'],
  ['checkmate','chiếu hết'], ['stalemate','hết nước đi (hòa khi Vua không bị chiếu)'],
  ['draw','hòa'], ['resign','đầu hàng'], ['rematch','tái đấu'], ['puzzle','câu đố'],
];
function vocabularyReply(question) {
  const text = norm(question);
  // A bounded phrase dictionary, never a claim to translate arbitrary text.
  const toVietnamese = text.match(/^(?:dich (?:cau )?)?(.+?) (?:nghia la gi|tieng viet la gi|sang tieng viet)$/);
  const toEnglish = text.match(/^(?:dich (?:cau )?)?(.+?) (?:tieng anh la gi|sang tieng anh)$/);
  const entry = toVietnamese ? vocabulary.find(([en])=>en === toVietnamese[1]) : toEnglish ? vocabulary.find(([,vi])=>norm(vi) === toEnglish[1]) : null;
  if (!entry) return null;
  return reply(`${toEnglish ? entry[1] : entry[0]} → ${toEnglish ? entry[0] : entry[1]}.${['draw','resign','puzzle'].includes(entry[0]) ? ' Đây là nghĩa trong ngữ cảnh cờ vua.' : ''}`, 'grounded', {suggestions:['Good luck nghĩa là gì?', 'Checkmate tiếng Việt là gì?', 'Tôi muốn hỏi câu khác']});
}

export function scopeReply(question) {
  const text = norm(question);
  const calculated = arithmetic(question);
  if (calculated) return calculated;
  const translated = vocabularyReply(question);
  if (translated) return translated;
  // Exact topic requests only: a specific question containing “API” must not
  // receive a generic definition as if it answered the requested detail.
  const lookup = text.replace(/^(?:cho toi biet |cho minh biet |hay |ban oi )/, '').replace(/ (?:nhe|nha)$/, '');
  const card = COACH_GENERAL_LESSONS.find(item=>[item.title,...item.terms].some(term=>norm(term) === lookup));
  if (card) return knowledgeReply(`${card.title}\n${card.text}`, [card.source], 'grounded', {knowledgeTopics:[card.id], suggestions:card.suggestions});
  if (/^(?:ban co (?:tra loi|biet|giup) (?:cau hoi )?ngoai (?:le|co vua)(?: khong)?|hoi ngoai le(?: duoc khong)?|toi muon hoi ngoai le)$/.test(text)) {
    return reply('Bạn cứ hỏi nhé. Mình có thể trò chuyện và trả lời một số kiến thức cơ bản ngoài cờ vua. Với chủ đề chưa có tài liệu, mình sẽ nói rõ phần chưa kiểm chứng và gợi ý cách tìm tiếp. Tin tức, giá cả hay xếp hạng trực tiếp cần nguồn cập nhật.', 'conversation', {suggestions:['AI là gì?', 'Cách học hiệu quả', 'Kể tên 3 đại kiện tướng']});
  }
  if (/^(?:toi|minh|em) (?:buon|met|chan|co don|cang thang|stress)(?: qua)?$/.test(text) || /^(?:buon qua|chan qua|met qua)$/.test(text)) return reply('Nghe có vẻ hôm nay bạn không thoải mái. Bạn muốn kể điều đang làm mình buồn, hay muốn đổi không khí với một câu chuyện vui? Nếu vừa chơi nhiều ván, bạn có thể nghỉ một chút rồi quay lại khi sẵn sàng.', 'conversation', {suggestions:['Kể chuyện cười', 'Tôi thua hoài', 'Tôi muốn hỏi câu khác']});
  if (/\b(thoi tiet|du bao mua|nhiet do hom nay)\b/.test(text)) return reply('Mình chưa có dữ liệu thời tiết trực tiếp. Hãy xem dự báo cho đúng địa điểm và thời gian trên dịch vụ khí tượng. Khi đọc dự báo, kiểm tra ngày cập nhật và phân biệt dự báo theo giờ với dự báo cả ngày.', 'insufficient', {suggestions:[]});
  if (/\b(gia vang|bitcoin|chung khoan|ty gia|gia co phieu|dau tu|mua coin)\b/.test(text)) return reply('Mình chưa có dữ liệu thị trường trực tiếp hoặc thông tin để đánh giá quyết định đầu tư của bạn. Hãy đối chiếu nguồn niêm yết và thời điểm cập nhật; đừng dùng câu trả lời của chatbot làm cam kết lợi nhuận. Bạn đang muốn hiểu thuật ngữ hay tìm số liệu?', 'clarify', {suggestions:[]});
  if (/\b(uong thuoc|lieu thuoc|chan doan|chua benh|dau nguc|kho tho|tu van y te)\b/.test(text)) return reply('Mình không có dữ liệu y tế hay khả năng khám để xác định bệnh hoặc liều thuốc cho bạn. Hãy hỏi bác sĩ hoặc dược sĩ; nếu có dấu hiệu nguy hiểm hoặc cần giúp ngay, liên hệ cấp cứu tại nơi bạn sống. Bạn có thể ghi lại triệu chứng và thời điểm bắt đầu để trao đổi với họ.', 'conversation', {suggestions:[]});
  if (/\b(tu van phap luat|kien ra toa|hop dong lao dong|co vi pham phap luat|muc phat)\b/.test(text)) return reply('Câu hỏi pháp lý cần quốc gia, hoàn cảnh cụ thể và quy định còn hiệu lực. Mình chưa có nguồn pháp luật cập nhật để kết luận cho trường hợp của bạn. Hãy đối chiếu văn bản chính thức hoặc hỏi người tư vấn pháp lý; tránh gửi giấy tờ có thông tin riêng tư vào chat.', 'insufficient', {suggestions:[]});
  if (/\b(tin tuc|bong da|ty so|tong thong|thu tuong|thoi su|lich thi dau)\b/.test(text)) return reply('Câu này cần nguồn đúng thời điểm. Mình chưa tra cứu tin tức hoặc kết quả trực tiếp trong cuộc trò chuyện này. Hãy kiểm tra trang chính thức của tổ chức hoặc giải đấu; nếu hỏi về một sự kiện, bạn nên nêu tên và ngày để tránh nhầm.', 'insufficient', {suggestions:[]});
  if (/\b(viet code|lap trinh|python|javascript|html|css|debug)\b/.test(text) && !/\b(chessarena|chu web|ai code|nguoi phat trien)\b/.test(text)) return reply('Bạn đang muốn học khái niệm hay sửa một lỗi lập trình? Hãy nêu ngôn ngữ, kết quả mong muốn và một đoạn mã ngắn đã bỏ khóa bí mật. Kho hiện có của mình tập trung vào cờ vua và ChessArena, nên mình sẽ không đưa bản sửa kỹ thuật chưa có cơ sở.', 'clarify', {suggestions:[]});
  if (/\b(nau an|mon an|cong thuc nau|du lich|dat ve|khach san|mua dien thoai)\b/.test(text)) return reply('Bạn muốn tìm ý tưởng chung hay thông tin cụ thể về món ăn, địa điểm hoặc sản phẩm? Mình chưa có tài liệu đã kiểm chứng cho yêu cầu này. Hãy nêu điều kiện quan trọng như sở thích, ngân sách hoặc địa điểm; thông tin giá và tình trạng đặt chỗ cần kiểm tra trực tiếp với nơi cung cấp.', 'clarify', {suggestions:[]});
  if (/\b(dich sang|dich cau|translate|viet tho|viet email|viet thu|soan tin nhan)\b/.test(text)) return reply('Bạn hãy gửi câu cần dịch hoặc nêu mục đích, người nhận và giọng văn mong muốn. Hiện mình chưa có bộ dịch hoặc soạn văn bản tự do; mình có thể hướng dẫn mẫu tin nhắn hỗ trợ ChessArena nếu đó là việc bạn cần.', 'clarify', {suggestions:['Tạo ticket hỗ trợ']});
  return null;
}
