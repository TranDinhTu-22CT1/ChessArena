// Opt-in regression runner. Never deploys SQL or changes application source.
// Tests/builds create only their normal generated output; logs go under reports/.
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const output = path.join(root, 'reports', 'regression', stamp);
await mkdir(output, { recursive: true });

async function snapshot() {
  const { stdout } = await promisify(execFile)('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root, maxBuffer: 10 * 1024 * 1024, windowsHide: true });
  const files = [...new Set(stdout.split('\0').filter(Boolean))].filter(name =>
    !/^(reports\/|backend\/\.next\/|Frontend\/dist\/|Frontend\/test-results\/|Frontend\/playwright-report\/|backend\/\.test-data\/|backend\/logs\/)/.test(name));
  const hashes = {};
  for (const name of files.sort()) {
    try { hashes[name] = createHash('sha256').update(await readFile(path.join(root, name))).digest('hex'); }
    catch (error) { if (error.code === 'ENOENT') hashes[name] = 'MISSING'; else throw error; }
  }
  return hashes;
}

const before = await snapshot();
const tasks = [
  ['backend-unit', 'backend', 'npm.cmd test'],
  ['frontend-unit', 'Frontend', 'npm.cmd test'],
  ['database-integration', 'backend', 'node --test --test-concurrency=1 tests/integration/*.test.js'],
  ['browser', 'Frontend', 'npm.cmd run test:browser'],
  ['backend-lint', 'backend', 'npm.cmd run lint'],
  ['frontend-lint', 'Frontend', 'npm.cmd run lint'],
  ['backend-build', 'backend', 'npm.cmd run build'],
  ['frontend-build', 'Frontend', 'npm.cmd run build'],
  ['local-security-config', 'backend', 'npm.cmd run check:security']
];
const results = [];
for (const [name, directory, windowsCommand] of tasks) {
  const command = process.platform === 'win32' ? windowsCommand : windowsCommand.replaceAll('npm.cmd', 'npm');
  console.log(`START ${name}`);
  const started = Date.now();
  let log = '';
  const child = process.platform === 'win32'
    ? spawn('cmd.exe', ['/d', '/s', '/c', command], { cwd: path.join(root, directory), windowsHide: true })
    : spawn('/bin/sh', ['-c', command], { cwd: path.join(root, directory) });
  child.stdout.on('data', chunk => { log += chunk.toString(); });
  child.stderr.on('data', chunk => { log += chunk.toString(); });
  const code = await new Promise(resolve => {
    child.on('error', error => { log += `\nRunner error: ${error.message}`; resolve(1); });
    child.on('close', value => resolve(value ?? 1));
  });
  await writeFile(path.join(output, `${name}.log`), log, 'utf8');
  const clean = log.replace(/\u001b\[[0-9;]*m/g, '');
  const count = clean.match(/(?:ℹ|#) tests (\d+)/)?.[1] || clean.match(/(\d+) passed \(/)?.[1] || '';
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  results.push({ name, directory, command, code, count, seconds });
  console.log(`${code === 0 ? 'PASS' : 'FAIL'} ${name}${count ? ` (${count} tests)` : ''} ${seconds}s`);
}
const after = await snapshot();
const changes = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(name => before[name] !== after[name]);
await writeFile(path.join(output, 'source-integrity.json'), JSON.stringify({ before, after, changes }, null, 2), 'utf8');
await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2), 'utf8');
const report = `# Kiểm thử hồi quy ChessArena

Thời điểm bắt đầu (UTC): ${stamp}

## Kết quả thực chạy

| Nhóm | Kết quả | Số test | Thời gian | Log |
| --- | --- | --- | --- | --- |
${results.map(r => `| ${r.name} | ${r.code === 0 ? 'PASS' : 'FAIL'} | ${r.count || '—'} | ${r.seconds}s | [Xem log](${r.name}.log) |`).join('\n')}

## Bảo toàn source

Đối chiếu SHA-256 trước/sau cho ${Object.keys(before).length} đường dẫn Git theo dõi hoặc file chưa được theo dõi không bị ignore, ngoài thư mục báo cáo và output sinh tự động. Không đọc nội dung .env vào báo cáo. File vốn đã bị xóa được ghi MISSING, không tự phục hồi.

${changes.length ? `Có ${changes.length} đường dẫn thay đổi trong thời gian chạy, cần xem source-integrity.json. Runner không tự sửa hoặc phục hồi chúng.\n\n${changes.map(name => '- ' + name).join('\n')}` : '**PASS: Không có thay đổi nội dung các file hiện hữu trong phạm vi đối chiếu.**'}

Build tạo .next/dist, trình duyệt tạo test-results, integration tạo rồi dọn database PostgreSQL riêng trong backend/.test-data. Không chạy migration, gửi thư, thanh toán hoặc sửa dữ liệu trên Supabase thật.

## Phạm vi chức năng

| Chức năng | Bằng chứng kiểm thử hiện có | Giới hạn |
| --- | --- | --- |
| Tài khoản, đổi phiên người dùng/admin, khôi phục phiên | firebase-auth, auth-switching, sessionRecovery, account-appeals | Không đăng nhập Firebase/OTP/email thật |
| Chơi bot, chơi cùng máy, bàn cờ, lưu/khôi phục ván | gameplay-reliability, game-persistence, engine-and-puzzles, play-and-support | Engine cục bộ; API trình duyệt giả lập |
| Ghép trận, hủy tìm, lời mời, nước đi, đồng hồ, kết thúc/tái đấu | gameplay, platform, online-hotfix, matchmaking-reconnect, online-realtime, online-terminal-sync | PostgreSQL riêng; không đo độ trễ Internet thực |
| Review, quota, lịch sử, bài tập từ sai lầm | review-storage, review-analysis, review-metrics, review-navigation | Không gọi backend production |
| Puzzle thường, Daily/Rush/Streak/Custom, Battle | security-upgrade, puzzles-and-engine, puzzle-rules, puzzle-battle, puzzles-and-bots | Không chứng nhận toàn bộ dữ liệu puzzle thực tế |
| AI Coach và kiến thức hội thoại | coach-conversation, coach-knowledge, coach-scope, chat-grounding, coach-engine | Tập câu hỏi kiểm thử hữu hạn, không bảo đảm mọi câu trả lời |
| Bạn bè, bộ lọc, presence, tìm kiếm | friendDiscovery, seasons-and-friends, security-upgrade | Giả lập trình duyệt và database kiểm thử |
| Bảng xếp hạng tuần/tháng, Elo | leaderboard-seasons, platform, seasons-and-friends | Không sửa mùa giải/Elo thật |
| Membership, checkout, hủy gia hạn | membership-policy, platform, flows | Không chạy PayPal sandbox/live hoặc webhook thật |
| Thông báo, report, hỗ trợ, khiếu nại, quản trị | reporting, support-workflow, account-appeals, notifications-and-reports, admin-and-refresh | Upload và dịch vụ ngoài chưa kiểm chứng đầu-cuối |
| Cấu hình website, bảo trì, giao diện nhỏ | website-settings, settings-and-navigation, interface | Playwright theo các kích thước/kịch bản trong test |
| CORS/CSRF, quyền dữ liệu, replay, đường dẫn log | cors, signing-secrets, validation, security-upgrade, gameplay-reliability | Không thay thế pentest hay kiểm tra cấu hình production |

## Các bước cần kiểm chứng riêng trên môi trường triển khai

- Xác minh khóa Supabase từng chia sẻ đã bị vô hiệu hóa. check:security chỉ kiểm tra cấu hình local; UNVERIFIED không được hiểu là PASS thu hồi khóa.
- Chạy VerifySecurityUpgrade.sql sau khi áp migration thực tế; kiểm tra RLS/quyền trên database đang dùng.
- Đăng ký, xác minh email, đăng nhập, đặt lại mật khẩu qua Firebase/OTP thật bằng tài khoản thử nghiệm được cho phép.
- PayPal sandbox: duyệt, webhook lặp, hủy gia hạn, hết hạn; không dùng giao dịch thật để test tự động.
- Hai trình duyệt/tài khoản thật: mời, ghép trận, đi nước, mất mạng, reconnect, hết giờ; kiểm tra presence ở trang khác.
- Upload/xem ảnh hỗ trợ, gửi thông báo và quyền quản trị trên staging.
- Kiểm tra job CI thực sự chạy sau khi đẩy code. Lượt này chỉ chạy công cụ cục bộ.

## Cách chạy lại

Từ thư mục gốc: \`node scripts/test-all-readonly.mjs\`. Cần dependencies, Git và trình duyệt Playwright đã cài; runner không tự cài hay cập nhật package. Trên Windows dùng Edge theo cấu hình hiện có, Linux dùng Chromium. Tránh chạy build cùng dev server đang dùng chung thư mục .next; không chạy nhiều lượt runner đồng thời vì browser test dùng cổng 5187.

Mỗi lần chạy tạo thư mục báo cáo riêng. Các lệnh cụ thể và exit code nằm trong results.json. Test thất bại được ghi lại, runner vẫn chạy các nhóm còn lại và trả exit code khác 0. Chỉ ghi nhận lỗi, không tự sửa source.

**Kết luận:** ${results.some(r => r.code !== 0) ? 'Có nhóm kiểm thử thất bại; cần đọc log tương ứng trước bước nâng cấp tiếp theo.' : 'Không phát hiện test thất bại trong các kịch bản đã chạy.'} Không đồng nghĩa mọi chức năng production hoặc mọi trường hợp đều không có lỗi.
`;
await writeFile(path.join(output, 'REPORT.md'), report, 'utf8');
console.log(`REPORT ${path.join(output, 'REPORT.md')}`);
console.log(`SOURCE ${changes.length === 0 ? 'UNCHANGED' : 'CHANGES DETECTED'}`);
process.exitCode = results.some(r => r.code !== 0) || changes.length ? 1 : 0;
