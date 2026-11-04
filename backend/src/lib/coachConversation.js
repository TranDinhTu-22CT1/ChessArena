import { normalizeKnowledgeText as norm } from './chessKnowledge.js';
import { knowledgeReply, matchCoachCards } from './coachKnowledge.js';
import { COACH_FOLLOWUPS } from '../data/coachLessons.js';
import { COACH_EXERCISES } from '../data/coachExercises.js';
import { COACH_LIBRARY } from '../data/coachLibrary.js';
import { isBoardQuestion } from './coachBoardAnswer.js';

const starter = ['Tôi mới bắt đầu', 'Chơi trung cuộc', 'ChessArena có những chức năng gì?'];
const reply = (answer, suggestions = starter, status = 'conversation') => knowledgeReply(answer, [], status, { suggestions });
const plain = question => norm(question).replace(/(?:\s+(?:ak|a|nhe|nha|nhi|oi|ha|ah))+$/g, '').trim();

// Strip only a greeting at the beginning; preserve the rest, including SAN/FEN and names.
export function withoutGreeting(question) {
  return String(question).replace(/^(?:(?:xin\s+)?ch[aà]o(?:\s+(?:b[aạ]n|coach|AI))?|hello(?:\s+(?:coach|there))?|hi(?:\s+coach)?|alo)[\s,!:.👋]+/iu, '').trim() || question;
}

export function conversationReply(question, { gameContext = {}, viewer = {} } = {}) {
  const text = plain(question);
  if (/^(?:toi la ai|ten toi la gi|ban biet ten toi khong|minh la ai)$/.test(text)) return reply(viewer.displayName ? `Tên hiển thị của tài khoản đang đăng nhập là ${viewer.displayName}. Bạn muốn mình giúp gì hôm nay?` : 'Mình chưa có tên hiển thị của bạn ở đây. Bạn có thể giới thiệu cách muốn được gọi, hoặc hỏi ngay điều đang cần.', starter);
  if (/^(?:chan qua|buon qua|ban tra loi sai roi|sai roi|ban khong hieu|ban ngu qua|khong dung y toi)$/.test(text)) return reply('Có vẻ câu trả lời vừa rồi chưa giúp được bạn. Bạn chỉ rõ chỗ chưa đúng hoặc điều muốn giải quyết nhé; mình sẽ kiểm tra lại theo thông tin bạn đưa.', ['Tôi muốn hỏi câu khác', 'Checklist trước khi đi'], 'clarify');
  if (/^(?:(?:xin )?chao|hello|hi|hey|alo|helo|hii+|good morning|good evening)(?: (?:ban|b|coach|ai|ai coach|there))?$/.test(text) || /^\s*[👋😊🙂]+\s*$/u.test(question)) {
    return reply(`Chào bạn! Mình là AI Coach của ChessArena. ${gameContext.hasBoardContext ? 'Bạn có thể nhờ mình phân tích bàn cờ đang mở, hoặc hỏi cách luyện tập.' : 'Mình có thể hướng dẫn học cờ, giải thích chiến thuật và giúp bạn sử dụng website.'} Hôm nay bạn muốn bắt đầu từ đâu?`, gameContext.hasBoardContext ? ['Phân tích thế cờ', 'Checklist trước khi đi', 'Chơi trung cuộc'] : starter);
  }
  if (/^(?:cam on(?: ban| coach| ai| nhieu| rat nhieu)?|thank you|thanks|thank you coach|thank you very much|hay qua|tuyet voi|rat huu ich|ban gioi qua|ban that tuyet)$/.test(text)) return reply('Rất vui vì giúp được bạn! Bạn có thể hỏi tiếp về phần vừa trao đổi, hoặc chuyển sang một chủ đề mới.', ['Cho ví dụ', 'Cho bài tập', 'Tôi muốn hỏi câu khác']);
  if (/^(?:tam biet(?: ban| coach)?|bye|goodbye|hen gap lai|chuc ngu ngon)$/.test(text)) return reply('Hẹn gặp lại bạn! Khi quay lại, bạn có thể mang một thế cờ hoặc một nước chưa hiểu để cùng xem.', []);
  if (/^(?:ok(?:ay)?|oke|oki|uh|uk|u|um|vang|da|dong y|hieu roi|toi hieu roi|ro roi|duoc roi|yes)$/.test(text)) return reply('Được nhé. Bạn muốn thử một bài tập hay hỏi sang phần khác?', ['Cho bài tập', 'Cho ví dụ', 'Tôi muốn hỏi câu khác']);
  if (/^(?:(?:toi|minh|cho toi|cho minh) )?(?:hoi|hoi chut|hoi ti|muon hoi|muon hoi mot cau|co the hoi|co cau hoi|can giup do|can ban giup|can ai giup|giup toi|giup minh|giup voi|help)(?: duoc khong)?$/.test(text)
    || /^(?:ban co do khong|co ai khong|coach|ai|ban|toi muon hoi cau khac|cho minh hoi chut|cho toi hoi chut|cho hoi|hoi di|minh hoi nhe)$/.test(text)) return reply('Mình đây, bạn cứ hỏi nhé. Nếu là một nước cờ, hãy mở bàn cờ hoặc gửi FEN/PGN; nếu là lỗi website, mô tả bạn đang làm gì và thông báo xuất hiện.', starter);
  if (/^(?:ban la ai|ai coach la gi|ban ten (?:la )?gi|ten ban la gi|who are you|ban co phai (?:ai|nguoi that|robot)|ban la nguoi hay may|ban co the (?:lam gi|giup gi)|ban giup duoc gi|ban biet (?:gi|nhung gi)|ban lam duoc gi)$/.test(text)) return reply('Mình là AI Coach, trợ lý cờ vua trong ChessArena. Mình giúp bạn học luật, khai cuộc, trung cuộc, tàn cuộc; giải thích chiến thuật và hướng dẫn dùng website. Khi có thế cờ hợp lệ, mình dùng Stockfish để kiểm tra nước đi. Mình không tự thao tác tài khoản hoặc đoán dữ liệu trực tiếp như Elo mới nhất.', ['Tôi mới bắt đầu', 'Phân tích thế cờ', 'Chủ website là ai?']);
  if (/^(?:ban khoe khong|khoe khong|hom nay the nao|how are you)$/.test(text)) return reply('Mình sẵn sàng giúp bạn. Hôm nay bạn muốn luyện cờ hay có điều gì cần hỏi?', starter);
  if (/^(?:xin loi(?: ban)?|sorry)$/.test(text)) return reply('Không sao đâu. Bạn cứ nói điều muốn hỏi, mình sẽ cùng làm rõ.', starter);
  if (/^(?:ke chuyen cuoi|noi gi vui di|dua chut di)$/.test(text)) return reply('Một câu vui nhé: quân Mã ít khi đi đường thẳng — chắc vì nó luôn thích nghĩ khác mọi người! Bạn muốn quay lại luyện chiến thuật với Mã không?', ['Quân Mã đi thế nào?', 'Đòn đôi là gì?']);
  return null;
}

function followupKind(text) {
  if (/^(?:goi y|cho goi y|hint)$/.test(text)) return 'hint';
  if (/^(?:dap an|xem dap an|cho dap an)$/.test(text)) return 'solution';
  if (/^(?:(?:cho (?:toi|minh)|hay|ban) )?(?:cho )?(?:mot )?vi du(?: cu the| de hieu)?$/.test(text) || text === 'example') return 'example';
  if (/^(?:(?:cho (?:toi|minh)|hay|ban) )?(?:cho )?(?:mot )?bai tap(?: thuc hanh)?$/.test(text) || text === 'practice') return 'practice';
  if (/^(?:giai thich them|giai thich lai|noi ro hon|noi de hieu hon|toi chua hieu|minh chua hieu|chua hieu|noi ngan gon|tom tat|tai sao|vi sao|tiep tuc|noi tiep di|con gi nua)$/.test(text)) return 'explain';
  return null;
}

export function followupReply(question, { messages = [], gameContext = {} } = {}) {
  const kind = followupKind(plain(question));
  // User topic only, within this conversation. Do not treat assistant assertions as facts.
  const previous = messages.filter(m => m.role === 'user').slice(-12).reverse();
  let exerciseAsked = false;
  for (const message of previous) {
    if (followupKind(plain(message.content)) === 'practice') { exerciseAsked = true; continue; }
    if (followupKind(plain(message.content)) || conversationReply(message.content)) continue;
    // A quiz choice is not a new topic; follow it back to the exercise request.
    if (Object.values(COACH_EXERCISES).some(quiz => [...quiz.choices, ...(quiz.accepted || [])].some(choice => norm(choice) === plain(message.content)))) continue;
    const hit = matchCoachCards(message.content)[0]?.card;
    if (isBoardQuestion(message.content, gameContext) && (!hit || /\b(FEN|PGN)\b|\b[a-h][1-8]\b/i.test(message.content)
      || /\b(nuoc vua|nuoc cuoi|nuoc nay|vua roi|duoc khong|the co nay)\b/.test(norm(message.content)))) return null;
    if (!hit) break; // Never revive an older topic after a different substantive question.
    const quiz = COACH_EXERCISES[hit.id];
    if (quiz && exerciseAsked) {
      if (kind === 'hint') return reply(quiz.hint, quiz.choices);
      if (kind === 'solution') return reply(`Đáp án: ${quiz.answer}. ${quiz.explanation}`, ['Cho bài tập', 'Tôi muốn hỏi câu khác']);
      const accepted = [quiz.answer, ...(quiz.accepted || [])].map(norm);
      if (accepted.includes(plain(question)) || quiz.choices.some(choice => norm(choice) === plain(question))) {
        const correct = accepted.includes(plain(question));
        return knowledgeReply(`${correct ? 'Đúng rồi!' : 'Chưa đúng.'} ${quiz.explanation}`, [hit.source], 'grounded', { suggestions: ['Cho bài tập', 'Tôi muốn hỏi câu khác'], exercise: { correct } });
      }
    }
    if (!kind) return null;
    if (kind === 'practice' && quiz) return knowledgeReply(`Bài tập nhỏ · ${hit.title}\n${quiz.question}\nBạn có thể chọn đáp án bên dưới hoặc hỏi “Gợi ý”.`, [hit.source], 'grounded', { suggestions: quiz.choices, knowledgeTopic: hit.id });
    const teaching = { ...COACH_FOLLOWUPS[hit.id], ...hit };
    const summarize = /^(noi ngan gon|tom tat)$/.test(plain(question));
    const material = summarize ? hit.text.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ') : kind === 'practice' ? teaching.practice : teaching.example;
    if (material) return knowledgeReply(`${hit.title} — ${summarize ? 'tóm tắt' : kind === 'practice' ? 'thực hành' : 'ví dụ dễ hiểu'}\n${material}`, [hit.source], 'grounded', {
      suggestions: teaching.suggestions || ['Cho bài tập', 'Checklist trước khi đi', 'Tôi muốn hỏi câu khác'], knowledgeTopic: hit.id
    });
    return reply(`Bạn muốn làm rõ phần nào của “${hit.title}”? Hãy nêu chỗ đang vướng hoặc một tình huống cụ thể để mình giải thích đúng ý bạn.`, [hit.title, 'Tôi muốn hỏi câu khác'], 'clarify');
  }
  if (!kind) return null;
  return reply('Bạn muốn mình giải thích hoặc cho bài tập về chủ đề nào? Ví dụ: cách đi quân Mã, đòn đôi hoặc kế hoạch trung cuộc.', ['Quân Mã đi thế nào?', 'Đòn đôi là gì?', 'Chơi trung cuộc'], 'clarify');
}

export function suggestedQuestions(question, result) {
  if (Array.isArray(result.suggestions)) return result;
  const hit = COACH_LIBRARY.find(card => card.id === result.knowledgeTopics?.[0]) || matchCoachCards(question)[0]?.card;
  const suggestions = result.position ? ['Nước đi tốt nhất?', 'Nước vừa rồi sai ở đâu?', 'Checklist trước khi đi']
    : hit?.suggestions || COACH_FOLLOWUPS[hit?.id]?.suggestions
      || (result.knowledge?.status === 'grounded' && hit ? ['Tôi muốn hỏi câu khác', 'Checklist trước khi đi', 'Lộ trình luyện cờ'] : starter);
  return { ...result, suggestions, ...(hit?.id === 'support' || hit?.id === 'payment-issue' ? { action: 'support' } : {}) };
}

export function guidedFallback(question) {
  const text = norm(question);
  if (/\b(loi|khong duoc|khong chay|bi treo|khong thay|bi lag)\b/.test(text) && /\b(chessarena|web|ban co|review|puzzle|dang nhap|tai khoan|ung dung nay)\b/.test(text)) return reply('Bạn gặp vấn đề ở màn hình nào: bàn cờ, câu đố, Review hay tài khoản? Hãy cho mình biết thao tác ngay trước lỗi và nguyên văn thông báo để hướng dẫn đúng bước.', ['Làm sao sử dụng Review?', 'Không đăng nhập được', 'Tạo ticket hỗ trợ'], 'clarify');
  if (/\b(elo cua toi|rating cua toi|goi cua toi|tai khoan cua toi|toi la ai|ten toi|so du|giao dich cua toi)\b/.test(text)) return reply('Mình chưa có thông tin tài khoản đó trong cuộc trò chuyện. Bạn có thể xem Elo tại Hồ sơ, hoặc gói và giao dịch tại Membership. Bạn muốn mình hướng dẫn mở mục nào?', ['Elo ChessArena', 'Gói Premium mua thế nào?', 'Tạo ticket hỗ trợ'], 'clarify');
  if (/\b(thoi tiet|bong da|gia vang|gia bitcoin|chung khoan|tin tuc|hom nay ngay|may gio)\b/.test(text)) return reply('Mình tập trung hỗ trợ cờ vua và ChessArena, chưa có dữ liệu trực tiếp cho câu hỏi này. Bạn có thể hỏi mình cách học cờ, chiến thuật hoặc cách dùng website.', starter, 'clarify');
  return reply('Mình chưa hiểu đủ câu này để trả lời đúng ý. Bạn có thể nêu rõ chủ đề và điều muốn biết, hoặc gửi một ví dụ? Bạn vẫn có thể hỏi ngoài cờ vua; với phần chưa có tài liệu hay cần dữ liệu mới, mình sẽ nói rõ giới hạn thay vì đoán.', ['Bạn có trả lời ngoài cờ vua không?', ...starter.slice(0,2)], 'clarify');
}
